import Application from "../models/Application.js";
import Property from "../models/Property.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { persistFile } from "../middleware/upload.js";
import { notify } from "../services/notificationService.js";
import { ROLES } from "../config/constants.js";

async function isPropertyOwner(propertyId, userId) {
  if (!propertyId) return false;
  const prop = await Property.findById(propertyId).select("owner");
  return prop && String(prop.owner) === String(userId);
}

// GET /api/applications/mine  (buyer)
export const myApplications = asyncHandler(async (req, res) => {
  const items = await Application.find({ buyer: req.user._id })
    .sort({ createdAt: -1 })
    .populate("property", "slug title images location price");
  res.json({ success: true, count: items.length, data: items });
});

// GET /api/applications/:id
export const getApplication = asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id)
    .populate("property", "slug title images location price owner")
    .populate("buyer", "fullName email phone");
  if (!app) throw ApiError.notFound("Application not found");

  const isBuyer = String(app.buyer._id) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  const isOwner = app.property?.owner && String(app.property.owner) === String(req.user._id);
  if (!isBuyer && !isAdmin && !isOwner) {
    throw ApiError.forbidden("That application belongs to another account");
  }
  res.json({ success: true, data: app });
});

// POST /api/applications  (buyer starts an application on a property)
export const startApplication = asyncHandler(async (req, res) => {
  const { propertyId, requestedAmount } = req.body;
  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound("Property not found");

  const existing = await Application.findOne({ buyer: req.user._id, property: propertyId, decision: "pending" });
  if (existing) throw ApiError.conflict("You already have an open application on this property");

  const app = await Application.create({
    buyer: req.user._id,
    property: property._id,
    propertyTitle: property.title,
    requestedAmount: requestedAmount || property.price,
  });

  const admins = await User.find({ role: ROLES.ADMIN }).select("_id");
  await Promise.all(admins.map((a) => notify({
    user: a._id,
    title: "New Mortgage Application",
    body: `${req.user.fullName} started an application for ${property.title}.`,
    icon: "assignment",
    type: "application",
    link: "/admin/dashboard",
  })));

  // Also notify whoever posted the property — partner or admin — so they can
  // track it from their own dashboard, not just the global admin view.
  if (String(property.owner) !== String(req.user._id) && property.ownerType === "partner") {
    await notify({
      user: property.owner,
      title: "New Mortgage Application",
      body: `${req.user.fullName} applied for a mortgage on ${property.title}.`,
      icon: "assignment",
      type: "application",
      link: "/partner/applications",
    });
  }

  res.status(201).json({ success: true, data: app });
});

// POST /api/applications/:id/documents  (multipart: name + file)
export const uploadDocument = asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) throw ApiError.notFound("Application not found");
  if (String(app.buyer) !== String(req.user._id)) throw ApiError.forbidden("That application belongs to another account");
  if (!req.file) throw ApiError.badRequest("No file was uploaded");

  const { name } = req.body;
  const doc = app.documents.find((d) => d.name === name);
  if (!doc) throw ApiError.badRequest(`Unknown document type: ${name}`);

  const saved = await persistFile(req.file, "nairobi-estate/documents");
  doc.fileUrl = saved.url;
  doc.publicId = saved.publicId;
  doc.status = "uploaded";
  doc.uploadedAt = new Date();
  doc.reviewerNote = undefined;

  // Advance the stage once everything has been supplied.
  const allSupplied = app.documents.every((d) => d.status === "uploaded" || d.status === "verified");
  if (allSupplied && app.stage === "started") app.stage = "documents";
  if (allSupplied && app.stage === "documents") app.stage = "review";
  await app.save();

  res.json({ success: true, data: app });
});

// PATCH /api/applications/:id/review  (admin)
export const reviewApplication = asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) throw ApiError.notFound("Application not found");

  if (req.user.role !== ROLES.ADMIN) {
    const owns = await isPropertyOwner(app.property, req.user._id);
    if (!owns) throw ApiError.forbidden("You can only review applications on your own listings");
  }

  const { stage, decision, decisionReason, reviewerNote, approvedAmount, documentUpdates } = req.body;
  if (stage) app.stage = stage;
  if (reviewerNote !== undefined) app.reviewerNote = reviewerNote;
  if (decision) {
    app.decision = decision;
    app.decisionReason = decisionReason;
    if (decision !== "pending") app.stage = "decision";
  }
  if (approvedAmount !== undefined) app.approvedAmount = approvedAmount;

  // documentUpdates: [{ name, status, reviewerNote }]
  (documentUpdates || []).forEach((u) => {
    const doc = app.documents.find((d) => d.name === u.name);
    if (!doc) return;
    if (u.status) doc.status = u.status;
    if (u.reviewerNote !== undefined) doc.reviewerNote = u.reviewerNote;
    if (u.status === "verified") doc.verifiedAt = new Date();
  });

  app.reviewedBy = req.user._id;
  await app.save();

  await notify({
    user: app.buyer,
    title: decision && decision !== "pending" ? `Application ${decision}` : "Application Updated",
    body: decisionReason || reviewerNote || `Your application for ${app.propertyTitle} has been updated.`,
    icon: "assignment",
    type: "application",
    link: "/buyer/applications",
  });

  res.json({ success: true, data: app });
});

// GET /api/applications/owner  (partner, admin) — every application on MY
// listings, so whoever posted the property (partner or admin) can review it.
export const ownerApplications = asyncHandler(async (req, res) => {
  const myPropertyIds = await Property.find({ owner: req.user._id }).distinct("_id");
  const items = await Application.find({ property: { $in: myPropertyIds } })
    .sort({ createdAt: -1 })
    .populate("buyer", "fullName email phone")
    .populate("property", "slug title images location price");
  res.json({ success: true, count: items.length, data: items });
});

// GET /api/applications  (admin) ?stage=&decision=
export const listApplications = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.decision) filter.decision = req.query.decision;
  const items = await Application.find(filter)
    .sort({ createdAt: -1 })
    .populate("buyer", "fullName email phone")
    .populate("property", "slug title price");
  res.json({ success: true, count: items.length, data: items });
});
