import Notification from "../models/Notification.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildPagination, paginatedResponse } from "../utils/apiFeatures.js";

// GET /api/notifications
export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query, 20);
  const filter = { user: req.user._id };
  if (req.query.unread === "true") filter.read = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ ...paginatedResponse({ items, total, page, limit }), unreadCount });
});

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw ApiError.notFound("Notification not found");
  n.read = true;
  n.readAt = new Date();
  await n.save();
  res.json({ success: true, data: n });
});

// PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true, readAt: new Date() });
  res.json({ success: true, message: "All notifications marked as read" });
});

// DELETE /api/notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!n) throw ApiError.notFound("Notification not found");
  res.json({ success: true, message: "Notification deleted" });
});
