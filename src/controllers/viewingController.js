import Viewing from "../models/Viewing.js";
import Property from "../models/Property.js";
import Lead from "../models/Lead.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notify } from "../services/notificationService.js";
import { VIEWING_STATUS, ROLES } from "../config/constants.js";

// POST /api/viewings  (buyer)
export const bookViewing = asyncHandler(async (req, res) => {
  const { propertyId, scheduledFor, timeLabel, format, contactName, contactEmail, contactPhone, comments } = req.body;
  const property = await Property.findById(propertyId).populate("owner", "_id fullName companyName");
  if (!property) throw ApiError.notFound("Property not found");

  const viewing = await Viewing.create({
    property: property._id,
    buyer: req.user._id,
    propertyTitle: property.title,
    location: property.location,
    scheduledFor,
    timeLabel,
    format,
    status: VIEWING_STATUS.PENDING,
    contactName: contactName || req.user.fullName,
    contactEmail: contactEmail || req.user.email,
    contactPhone: contactPhone || req.user.phone,
    comments,
    agent: property.owner?._id,
    agentName: property.partnerName,
  });

  // A viewing request is also a lead for the owning partner.
  if (property.ownerType === "partner") {
    await Lead.create({
      partner: property.owner._id,
      property: property._id,
      buyer: req.user._id,
      name: viewing.contactName,
      email: viewing.contactEmail,
      phone: viewing.contactPhone,
      source: "viewing",
      detail: `Viewing: ${property.title}`,
    });
  }

  await notify({
    user: property.owner._id,
    title: "New Viewing Request",
    body: `${viewing.contactName} requested a ${viewing.format} viewing of ${property.title}.`,
    icon: "event_available",
    type: "viewing",
    link: "/partner/dashboard",
  });
  await notify({
    user: req.user._id,
    title: "Viewing Requested",
    body: `Your viewing request for ${property.title} has been sent. We'll confirm shortly.`,
    icon: "calendar_month",
    type: "viewing",
    link: "/buyer/viewings",
  });

  res.status(201).json({ success: true, data: viewing });
});

// GET /api/viewings/mine  (buyer) ?status=
export const myViewings = asyncHandler(async (req, res) => {
  const filter = { buyer: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const items = await Viewing.find(filter).sort({ scheduledFor: 1 }).populate("property", "slug title images location");
  res.json({ success: true, count: items.length, data: items });
});

// GET /api/viewings/owner — every viewing booked on MY listings.
// Resolved from property ownership (not the denormalised agent field) so it
// works identically whether the listing belongs to a partner or to an admin.
export const ownerViewings = asyncHandler(async (req, res) => {
  const myPropertyIds = await Property.find({ owner: req.user._id }).distinct("_id");
  const filter = { property: { $in: myPropertyIds } };
  if (req.query.status) filter.status = req.query.status;
  const items = await Viewing.find(filter)
    .sort({ scheduledFor: 1 })
    .populate("buyer", "fullName email phone")
    .populate("property", "slug title images location");
  res.json({ success: true, count: items.length, data: items });
});

// GET /api/viewings/all  (admin) — every viewing on the platform
export const allViewings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await Viewing.find(filter)
    .sort({ scheduledFor: -1 })
    .populate("buyer", "fullName email phone")
    .populate("property", "slug title location partnerName");
  res.json({ success: true, count: items.length, data: items });
});

async function assertCanManage(viewing, user) {
  const isBuyer = String(viewing.buyer) === String(user._id);
  const isAgent = viewing.agent && String(viewing.agent) === String(user._id);
  let isOwner = false;
  if (!isBuyer && !isAgent) {
    const prop = await Property.findById(viewing.property).select("owner");
    isOwner = prop && String(prop.owner) === String(user._id);
  }
  if (!isBuyer && !isAgent && !isOwner && user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden("You cannot modify this viewing");
  }
}

// PATCH /api/viewings/:id  (reschedule / change format)
export const updateViewing = asyncHandler(async (req, res) => {
  const viewing = await Viewing.findById(req.params.id);
  if (!viewing) throw ApiError.notFound("Viewing not found");
  await assertCanManage(viewing, req.user);

  ["scheduledFor", "timeLabel", "format", "comments"].forEach((k) => {
    if (req.body[k] !== undefined) viewing[k] = req.body[k];
  });
  viewing.status = VIEWING_STATUS.PENDING; // re-confirm after any change
  await viewing.save();
  res.json({ success: true, data: viewing });
});

// PATCH /api/viewings/:id/status  (partner/admin confirm or complete)
export const setViewingStatus = asyncHandler(async (req, res) => {
  const viewing = await Viewing.findById(req.params.id);
  if (!viewing) throw ApiError.notFound("Viewing not found");
  const prop = await Property.findById(viewing.property).select("owner");
  const isOwner = prop && String(prop.owner) === String(req.user._id);
  const isAgent = viewing.agent && String(viewing.agent) === String(req.user._id);
  if (!isOwner && !isAgent && req.user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden("Only the listing owner can update this viewing");
  }

  const { status } = req.body;
  if (!Object.values(VIEWING_STATUS).includes(status)) throw ApiError.badRequest("Invalid viewing status");
  viewing.status = status;
  await viewing.save();

  await notify({
    user: viewing.buyer,
    title: `Viewing ${status}`,
    body: `Your viewing of ${viewing.propertyTitle} is now ${status.toLowerCase()}.`,
    icon: "event_available",
    type: "viewing",
    link: "/buyer/viewings",
  });

  res.json({ success: true, data: viewing });
});

// DELETE /api/viewings/:id  (cancel)
export const cancelViewing = asyncHandler(async (req, res) => {
  const viewing = await Viewing.findById(req.params.id);
  if (!viewing) throw ApiError.notFound("Viewing not found");
  await assertCanManage(viewing, req.user);

  viewing.status = VIEWING_STATUS.CANCELLED;
  viewing.cancelledBy = req.user._id;
  viewing.cancelledAt = new Date();
  await viewing.save();

  const notifyUser = String(viewing.buyer) === String(req.user._id) ? viewing.agent : viewing.buyer;
  if (notifyUser) {
    await notify({
      user: notifyUser,
      title: "Viewing Cancelled",
      body: `The viewing of ${viewing.propertyTitle} was cancelled.`,
      icon: "event_busy",
      type: "viewing",
    });
  }
  res.json({ success: true, data: viewing });
});
