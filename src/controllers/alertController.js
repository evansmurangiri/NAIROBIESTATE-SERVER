import Alert from "../models/Alert.js";
import Property from "../models/Property.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const own = async (id, userId) => {
  const alert = await Alert.findById(id);
  if (!alert) throw ApiError.notFound("Alert not found");
  if (String(alert.user) !== String(userId)) throw ApiError.forbidden("That alert belongs to another account");
  return alert;
};

// GET /api/alerts
export const listAlerts = asyncHandler(async (req, res) => {
  const items = await Alert.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, count: items.length, data: items });
});

// POST /api/alerts
export const createAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.create({ ...req.body, user: req.user._id });
  res.status(201).json({ success: true, data: alert });
});

// PATCH /api/alerts/:id
export const updateAlert = asyncHandler(async (req, res) => {
  const alert = await own(req.params.id, req.user._id);
  delete req.body.user;
  Object.assign(alert, req.body);
  await alert.save();
  res.json({ success: true, data: alert });
});

// PATCH /api/alerts/:id/toggle
export const toggleAlert = asyncHandler(async (req, res) => {
  const alert = await own(req.params.id, req.user._id);
  alert.active = !alert.active;
  await alert.save();
  res.json({ success: true, data: alert });
});

// DELETE /api/alerts/:id
export const deleteAlert = asyncHandler(async (req, res) => {
  const alert = await own(req.params.id, req.user._id);
  await alert.deleteOne();
  res.json({ success: true, message: "Alert deleted" });
});

// GET /api/alerts/:id/matches — preview what this alert currently matches
export const alertMatches = asyncHandler(async (req, res) => {
  const alert = await own(req.params.id, req.user._id);
  const items = await Property.find(alert.toPropertyQuery()).limit(20).lean();
  res.json({ success: true, count: items.length, data: items });
});
