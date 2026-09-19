import Property from "../models/Property.js";
import User from "../models/User.js";
import Lead from "../models/Lead.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildPagination, paginatedResponse } from "../utils/apiFeatures.js";
import { persistFile, destroyFile } from "../middleware/upload.js";
import { notify, matchAlertsForProperty } from "../services/notificationService.js";
import { PROPERTY_STATUS, ROLES, MAX_LISTING_PRICE } from "../config/constants.js";
import { minimumDeposit, monthlyPayment } from "../utils/loan.js";

const SORT_MAP = {
  "payment-asc": { monthlyPayment: 1 },
  "payment-desc": { monthlyPayment: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  newest: { createdAt: -1 },
  popular: { views: -1 },
};

function buildPublicFilter(query) {
  const filter = { status: PROPERTY_STATUS.LIVE };
  if (query.county) filter.county = query.county;
  if (query.location) {
    const re = new RegExp(query.location, "i");
    filter.$or = [{ suburb: re }, { county: re }, { location: re }];
  }
  if (query.type) filter.type = { $in: String(query.type).split(",") };
  if (query.intent) filter.intent = query.intent;
  if (query.minBeds) filter.beds = { $gte: Number(query.minBeds) };
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.minMonthly || query.maxMonthly) {
    filter.monthlyPayment = {};
    if (query.minMonthly) filter.monthlyPayment.$gte = Number(query.minMonthly);
    if (query.maxMonthly) filter.monthlyPayment.$lte = Number(query.maxMonthly);
  }
  if (query.search) filter.$text = { $search: query.search };
  return filter;
}

// GET /api/properties  (public)
export const listProperties = asyncHandler(async (req, res) => {
  const filter = buildPublicFilter(req.query);
  const { page, limit, skip } = buildPagination(req.query);
  const sort = SORT_MAP[req.query.sort] || SORT_MAP["payment-asc"];

  const [items, total] = await Promise.all([
    Property.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);

  // Flag which ones the signed-in buyer has saved.
  if (req.user?.role === ROLES.BUYER) {
    const saved = new Set(req.user.savedHomes.map(String));
    items.forEach((p) => { p.isSaved = saved.has(String(p._id)); });
  }

  res.json(paginatedResponse({ items, total, page, limit }));
});

// GET /api/properties/:slug  (public)
export const getProperty = asyncHandler(async (req, res) => {
  const property = await Property.findOne({ slug: req.params.slug }).populate("owner", "fullName companyName email phone role");
  if (!property) throw ApiError.notFound("Property not found");

  // Only owners/admins may view a listing that isn't live.
  const isOwner = req.user && String(property.owner?._id) === String(req.user._id);
  const isAdmin = req.user?.role === ROLES.ADMIN;
  if (property.status !== PROPERTY_STATUS.LIVE && !isOwner && !isAdmin) {
    throw ApiError.notFound("Property not found");
  }

  await Property.updateOne({ _id: property._id }, { $inc: { views: 1 } });

  const obj = property.toObject();
  obj.financing = {
    minimumDeposit: minimumDeposit(property.price),
    estimatedMonthlyPayment: property.monthlyPayment,
  };
  if (req.user?.role === ROLES.BUYER) {
    obj.isSaved = req.user.savedHomes.map(String).includes(String(property._id));
  }
  res.json({ success: true, data: obj });
});

// GET /api/properties/similar/:slug (public)
export const similarProperties = asyncHandler(async (req, res) => {
  const base = await Property.findOne({ slug: req.params.slug });
  if (!base) throw ApiError.notFound("Property not found");
  const items = await Property.find({
    _id: { $ne: base._id },
    status: PROPERTY_STATUS.LIVE,
    $or: [{ type: base.type }, { county: base.county }],
  }).limit(3).lean();
  res.json({ success: true, data: items });
});

// POST /api/properties  (partner or admin)
export const createProperty = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (Number(req.body.price) > MAX_LISTING_PRICE) {
    throw ApiError.badRequest(`Nairobi Estate lists homes up to KES ${MAX_LISTING_PRICE.toLocaleString()}`);
  }

  // An admin may publish straight to LIVE; a partner's listing always enters
  // the moderation queue regardless of what the client sends.
  const requested = req.body.status;
  const status = isAdmin
    ? (requested === PROPERTY_STATUS.LIVE ? PROPERTY_STATUS.LIVE : PROPERTY_STATUS.PENDING)
    : (requested === PROPERTY_STATUS.DRAFT ? PROPERTY_STATUS.DRAFT : PROPERTY_STATUS.PENDING);

  const property = await Property.create({
    ...req.body,
    status,
    owner: req.user._id,
    ownerType: isAdmin ? "admin" : "partner",
    partnerName: isAdmin ? "Nairobi Estate (Admin)" : (req.user.companyName || req.user.fullName),
    publishedAt: status === PROPERTY_STATUS.LIVE ? new Date() : undefined,
  });

  if (status === PROPERTY_STATUS.LIVE) await matchAlertsForProperty(property);

  if (!isAdmin) {
    const admins = await User.find({ role: ROLES.ADMIN }).select("_id");
    await Promise.all(admins.map((a) => notify({
      user: a._id,
      title: "New Listing Awaiting Approval",
      body: `${property.title} was submitted by ${property.partnerName}.`,
      icon: "pending_actions",
      type: "listing",
      link: "/admin/properties",
    })));
  }

  res.status(201).json({ success: true, data: property });
});

// PATCH /api/properties/:id  (owner or admin)
export const updateProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");

  const isOwner = String(property.owner) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) throw ApiError.forbidden("You can only edit your own listings");

  // Only admins change status directly — partners go through the queue.
  const blocked = ["owner", "ownerType", "views", "saveCount"];
  if (!isAdmin) blocked.push("status", "flagged", "flagReason");
  blocked.forEach((k) => delete req.body[k]);

  Object.assign(property, req.body);

  // A partner editing a live listing sends it back for re-approval.
  if (isOwner && !isAdmin && property.status === PROPERTY_STATUS.LIVE) {
    property.status = PROPERTY_STATUS.PENDING;
  }
  await property.save();
  res.json({ success: true, data: property });
});

// DELETE /api/properties/:id  (owner or admin)
export const deleteProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");
  const isOwner = String(property.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden("You can only delete your own listings");

  await Promise.all((property.images || []).map((img) => destroyFile(img.publicId)));
  await property.deleteOne();
  res.json({ success: true, message: "Listing deleted" });
});

// POST /api/properties/:id/images  (owner or admin)
export const uploadImages = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");
  const isOwner = String(property.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden("You can only edit your own listings");
  if (!req.files?.length) throw ApiError.badRequest("No images were uploaded");

  const saved = await Promise.all(req.files.map((f) => persistFile(f, "nairobi-estate/properties")));
  saved.forEach((img, i) => property.images.push({ ...img, isCover: property.images.length === 0 && i === 0 }));
  await property.save();
  res.status(201).json({ success: true, data: property.images });
});

// DELETE /api/properties/:id/images/:publicId
export const deleteImage = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");
  const isOwner = String(property.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden("You can only edit your own listings");

  const publicId = decodeURIComponent(req.params.publicId);
  property.images = property.images.filter((i) => i.publicId !== publicId);
  await destroyFile(publicId);
  await property.save();
  res.json({ success: true, data: property.images });
});

// GET /api/properties/mine  (partner)
export const myListings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query, 20);
  const filter = { owner: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  res.json(paginatedResponse({ items, total, page, limit }));
});

// POST /api/properties/:id/enquire  (buyer) — creates a Lead for the partner
export const enquire = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id).populate("owner", "_id role");
  if (!property) throw ApiError.notFound("Property not found");

  const lead = await Lead.create({
    partner: property.owner._id,
    property: property._id,
    buyer: req.user?._id,
    name: req.body.name || req.user?.fullName,
    email: req.body.email || req.user?.email,
    phone: req.body.phone || req.user?.phone,
    message: req.body.message,
    source: "enquiry",
    detail: `Inquiry: ${property.title}`,
  });

  await notify({
    user: property.owner._id,
    title: "New Enquiry",
    body: `${lead.name} enquired about ${property.title}.`,
    icon: "forward_to_inbox",
    type: "lead",
    link: "/partner/dashboard",
  });

  res.status(201).json({ success: true, data: lead });
});

// GET /api/properties/:id/financing?downPayment=&rate=&years=
export const financingBreakdown = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");

  const minDeposit = minimumDeposit(property.price);
  const down = Math.max(Number(req.query.downPayment) || minDeposit, minDeposit);
  const rate = Number(req.query.rate) || undefined;
  const years = Number(req.query.years) || undefined;
  const principal = Math.max(property.price - down, 0);
  const payment = monthlyPayment(principal, rate, years);
  const totalPaid = payment * (years || 25) * 12;

  res.json({
    success: true,
    data: {
      price: property.price,
      minimumDeposit: minDeposit,
      downPayment: down,
      amountFinanced: principal,
      monthlyPayment: Math.round(payment),
      totalInterest: Math.round(totalPaid - principal),
      totalPaid: Math.round(totalPaid),
      note: "Estimates only. Not a loan offer or approval.",
    },
  });
});
