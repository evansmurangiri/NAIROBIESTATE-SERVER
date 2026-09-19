import Property from "../models/Property.js";
import User from "../models/User.js";
import Application from "../models/Application.js";
import Viewing from "../models/Viewing.js";
import Article from "../models/Article.js";
import Lead from "../models/Lead.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildPagination, paginatedResponse } from "../utils/apiFeatures.js";
import { notify, matchAlertsForProperty } from "../services/notificationService.js";
import { PROPERTY_STATUS, ROLES, ARTICLE_STATUS } from "../config/constants.js";

// GET /api/admin/properties  ?status=&county=&flagged=
export const listAllProperties = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query, 20);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.county) filter.county = req.query.county;
  if (req.query.flagged === "true") filter.flagged = true;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [items, total] = await Promise.all([
    Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("owner", "fullName companyName email").lean(),
    Property.countDocuments(filter),
  ]);
  res.json(paginatedResponse({ items, total, page, limit }));
});

// PATCH /api/admin/properties/:id/status  { status, reason }
export const setPropertyStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!Object.values(PROPERTY_STATUS).includes(status)) throw ApiError.badRequest("Invalid property status");

  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");

  const wasLive = property.status === PROPERTY_STATUS.LIVE;
  property.status = status;
  property.reviewedBy = req.user._id;
  property.reviewedAt = new Date();
  property.flagged = false;
  if (status === PROPERTY_STATUS.REJECTED) property.rejectionReason = reason;
  if (status === PROPERTY_STATUS.LIVE && !property.publishedAt) property.publishedAt = new Date();
  await property.save();

  // Newly live → fan out to matching buyer alerts.
  if (status === PROPERTY_STATUS.LIVE && !wasLive) await matchAlertsForProperty(property);

  await notify({
    user: property.owner,
    title: `Listing ${status}`,
    body: reason
      ? `${property.title}: ${reason}`
      : `Your listing "${property.title}" is now ${status.toLowerCase()}.`,
    icon: status === PROPERTY_STATUS.LIVE ? "check_circle" : "info",
    type: "listing",
    link: "/partner/listings",
  });

  res.json({ success: true, data: property });
});

// PATCH /api/admin/properties/:id/flag  { flagged, flagReason }
export const flagProperty = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");
  property.flagged = Boolean(req.body.flagged);
  property.flagReason = req.body.flagReason;
  await property.save();
  res.json({ success: true, data: property });
});

// GET /api/admin/users ?role=&search=
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query, 20);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const re = new RegExp(req.query.search, "i");
    filter.$or = [{ fullName: re }, { email: re }, { companyName: re }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json(paginatedResponse({ items, total, page, limit }));
});

// PATCH /api/admin/users/:id  { accountState, partnerStatus, role }
export const updateUser = asyncHandler(async (req, res) => {
  const { accountState, partnerStatus, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  if (String(user._id) === String(req.user._id) && accountState && accountState !== "ACTIVE") {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }
  if (accountState) user.accountState = accountState;
  if (partnerStatus) user.partnerStatus = partnerStatus;
  if (role) user.role = role;
  await user.save({ validateBeforeSave: false });

  if (partnerStatus === "VERIFIED") {
    await notify({ user: user._id, title: "Partner Account Verified",
      body: "Your partner account has been verified. Your listings can now go live.",
      icon: "verified", type: "system", link: "/partner/dashboard" });
  }
  res.json({ success: true, data: user });
});

// POST /api/admin/users  — admins create other staff accounts
export const createStaffUser = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, role } = req.body;
  if (await User.findOne({ email: email.toLowerCase() })) throw ApiError.conflict("That email is already in use");
  const user = await User.create({
    fullName, email, phone, password,
    role: role || ROLES.ADMIN,
    accountState: "ACTIVE",
    partnerStatus: role === ROLES.PARTNER ? "VERIFIED" : undefined,
  });
  res.status(201).json({ success: true, data: user });
});

// GET /api/admin/analytics
export const analytics = asyncHandler(async (req, res) => {
  const [
    totalProperties, liveProperties, pendingProperties,
    totalBuyers, totalPartners,
    applicationsStarted, applicationsApproved,
    viewingRequests, totalLeads,
    publishedArticles, articleAgg, inventoryAgg, pipelineAgg,
  ] = await Promise.all([
    Property.countDocuments(),
    Property.countDocuments({ status: PROPERTY_STATUS.LIVE }),
    Property.countDocuments({ status: PROPERTY_STATUS.PENDING }),
    User.countDocuments({ role: ROLES.BUYER }),
    User.countDocuments({ role: ROLES.PARTNER }),
    Application.countDocuments(),
    Application.countDocuments({ decision: "approved" }),
    Viewing.countDocuments(),
    Lead.countDocuments(),
    Article.countDocuments({ status: ARTICLE_STATUS.PUBLISHED }),
    Article.aggregate([{ $group: { _id: null, reads: { $sum: "$reads" }, downloads: { $sum: "$downloads" } } }]),
    Property.aggregate([{ $match: { status: PROPERTY_STATUS.LIVE } }, { $group: { _id: null, value: { $sum: "$price" } } }]),
    Application.aggregate([{ $group: { _id: null, value: { $sum: "$requestedAmount" } } }]),
  ]);

  const leadConversion = totalLeads ? Math.round((applicationsStarted / totalLeads) * 1000) / 10 : 0;

  res.json({
    success: true,
    data: {
      totalProperties, liveProperties, pendingProperties,
      totalBuyers, totalPartners,
      applicationsStarted, applicationsApproved,
      viewingRequests, totalLeads,
      leadConversionPercent: leadConversion,
      publishedArticles,
      totalArticleReads: articleAgg[0]?.reads || 0,
      totalGuideDownloads: articleAgg[0]?.downloads || 0,
      totalPropertyInventoryValue: inventoryAgg[0]?.value || 0,
      totalMortgagePipeline: pipelineAgg[0]?.value || 0,
    },
  });
});

// GET /api/admin/activity — recent cross-entity feed for the dashboard
export const recentActivity = asyncHandler(async (req, res) => {
  const [properties, users, applications] = await Promise.all([
    Property.find().sort({ createdAt: -1 }).limit(5).select("title location partnerName createdAt").lean(),
    User.find().sort({ createdAt: -1 }).limit(5).select("fullName role companyName createdAt").lean(),
    Application.find().sort({ createdAt: -1 }).limit(5).select("propertyTitle stage createdAt").lean(),
  ]);

  const feed = [
    ...properties.map((p) => ({ type: "listing", icon: "home", at: p.createdAt,
      text: `New property listed in ${p.location} by ${p.partnerName || "a partner"}.` })),
    ...users.map((u) => ({ type: "user", icon: "person_add", at: u.createdAt,
      text: `New ${u.role} registration: ${u.companyName || u.fullName}.` })),
    ...applications.map((a) => ({ type: "application", icon: "assignment", at: a.createdAt,
      text: `Application for ${a.propertyTitle} is at "${a.stage}".` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);

  res.json({ success: true, data: feed });
});

// GET /api/admin/system-health
export const systemHealth = asyncHandler(async (req, res) => {
  const pendingApprovals = await Property.countDocuments({ status: PROPERTY_STATUS.PENDING });
  const flagged = await Property.countDocuments({ flagged: true });
  res.json({
    success: true,
    data: {
      serverStatus: "Optimal",
      uptimeSeconds: Math.round(process.uptime()),
      pendingApprovals,
      flaggedListings: flagged,
    },
  });
});
