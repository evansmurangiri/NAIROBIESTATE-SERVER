import User from "../models/User.js";
import Property from "../models/Property.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { affordability } from "../utils/loan.js";
import { PREQUAL_STATUS, PROPERTY_STATUS } from "../config/constants.js";

// ---------- Saved homes ----------

// GET /api/buyer/saved-homes
export const getSavedHomes = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("savedHomes");
  res.json({ success: true, count: user.savedHomes.length, data: user.savedHomes });
});

// POST /api/buyer/saved-homes/:propertyId  (toggle)
export const toggleSavedHome = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound("Property not found");

  const user = await User.findById(req.user._id);
  const idx = user.savedHomes.findIndex((id) => String(id) === String(propertyId));
  let saved;
  if (idx >= 0) {
    user.savedHomes.splice(idx, 1);
    await Property.updateOne({ _id: propertyId }, { $inc: { saveCount: -1 } });
    saved = false;
  } else {
    user.savedHomes.push(propertyId);
    await Property.updateOne({ _id: propertyId }, { $inc: { saveCount: 1 } });
    saved = true;
  }
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, saved, savedHomeIds: user.savedHomes });
});

// DELETE /api/buyer/saved-homes  body: { propertyIds: [] }  (bulk remove)
export const removeSavedHomes = asyncHandler(async (req, res) => {
  const ids = (req.body.propertyIds || []).map(String);
  if (!ids.length) throw ApiError.badRequest("Provide propertyIds to remove");
  const user = await User.findById(req.user._id);
  user.savedHomes = user.savedHomes.filter((id) => !ids.includes(String(id)));
  await user.save({ validateBeforeSave: false });
  await Property.updateMany({ _id: { $in: ids } }, { $inc: { saveCount: -1 } });
  res.json({ success: true, savedHomeIds: user.savedHomes });
});

// ---------- Pre-qualification ----------

// GET /api/buyer/prequalification
export const getPrequalification = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.prequalification });
});

// PATCH /api/buyer/prequalification  { key, value, step }  — saves one answer
export const savePrequalAnswer = asyncHandler(async (req, res) => {
  const { key, value, step } = req.body;
  const allowed = ["income", "debt", "deposit", "propertyType", "timeline", "employment", "location"];
  if (!allowed.includes(key)) throw ApiError.badRequest(`Unknown pre-qualification field: ${key}`);

  const user = await User.findById(req.user._id);
  user.prequalification.answers[key] = value;
  if (typeof step === "number") user.prequalification.step = step;
  if (user.prequalification.status !== PREQUAL_STATUS.COMPLETE) {
    user.prequalification.status = PREQUAL_STATUS.IN_PROGRESS;
  }
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, data: user.prequalification });
});

// POST /api/buyer/prequalification/complete
export const completePrequalification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const a = user.prequalification.answers || {};
  if (a.income == null) throw ApiError.badRequest("Monthly income is required to complete pre-qualification");

  const { monthlyBudget, resultAmount } = affordability({
    income: Number(a.income) || 0,
    debt: Number(a.debt) || 0,
    deposit: Number(a.deposit) || 0,
  });

  user.prequalification.status = PREQUAL_STATUS.COMPLETE;
  user.prequalification.monthlyBudget = monthlyBudget;
  user.prequalification.resultAmount = resultAmount;
  user.prequalification.qualifiedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  user.prequalification.completedAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, data: user.prequalification });
});

// DELETE /api/buyer/prequalification  (redo)
export const resetPrequalification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.prequalification = { status: PREQUAL_STATUS.NOT_STARTED, step: 0, answers: {} };
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, data: user.prequalification });
});

// GET /api/buyer/recommendations
export const getRecommendations = asyncHandler(async (req, res) => {
  const pq = req.user.prequalification;
  const filter = { status: PROPERTY_STATUS.LIVE };
  if (pq?.status === PREQUAL_STATUS.COMPLETE && pq.resultAmount) filter.price = { $lte: pq.resultAmount };
  if (pq?.answers?.propertyType) filter.type = pq.answers.propertyType;

  let items = await Property.find(filter).sort({ price: -1 }).limit(6).lean();
  // Fall back to popular listings rather than returning an empty shelf.
  if (!items.length) items = await Property.find({ status: PROPERTY_STATUS.LIVE }).sort({ views: -1 }).limit(6).lean();

  res.json({ success: true, personalised: pq?.status === PREQUAL_STATUS.COMPLETE, data: items });
});

// ---------- Academy progress ----------

// GET /api/buyer/academy-progress
export const getAcademyProgress = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.academyProgress });
});

// PATCH /api/buyer/academy-progress
export const updateAcademyProgress = asyncHandler(async (req, res) => {
  const { overallPercent, articlesRead, guidesDownloaded, completedModuleId } = req.body;
  const user = await User.findById(req.user._id);
  const p = user.academyProgress;
  if (typeof overallPercent === "number") p.overallPercent = Math.min(Math.max(overallPercent, 0), 100);
  if (typeof articlesRead === "number") p.articlesRead = articlesRead;
  if (typeof guidesDownloaded === "number") p.guidesDownloaded = guidesDownloaded;
  if (completedModuleId && !p.completedModules.includes(completedModuleId)) p.completedModules.push(completedModuleId);
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, data: user.academyProgress });
});
