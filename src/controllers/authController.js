import crypto from "crypto";
import User from "../models/User.js";
import Application from "../models/Application.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendTokenResponse } from "../utils/token.js";
import sendEmail from "../utils/sendEmail.js";
import { notify } from "../services/notificationService.js";
import { persistFile, destroyFile } from "../middleware/upload.js";
import { ROLES } from "../config/constants.js";

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, role, companyName } = req.body;

  // Admin accounts are never self-served; they're created by another admin.
  if (role === ROLES.ADMIN) throw ApiError.forbidden("Admin accounts cannot be created through registration");

  if (await User.findOne({ email: email.toLowerCase() })) {
    throw ApiError.conflict("An account with that email already exists");
  }

  const user = await User.create({
    fullName,
    email,
    phone,
    password,
    role: role === ROLES.PARTNER ? ROLES.PARTNER : ROLES.BUYER,
    companyName: role === ROLES.PARTNER ? companyName : undefined,
    partnerStatus: role === ROLES.PARTNER ? "PENDING_VERIFICATION" : undefined,
  });

  await notify({
    user: user._id,
    title: "Welcome to Nairobi Estate",
    body:
      user.role === ROLES.PARTNER
        ? "Your partner account is pending verification. You can start adding listings in the meantime."
        : "Your account is ready. Get pre-qualified to unlock personalized home recommendations.",
    icon: "waving_hand",
    type: "system",
    link: user.role === ROLES.PARTNER ? "/partner/dashboard" : "/prequalify",
  });

  await sendEmail({
    to: user.email,
    subject: "Welcome to Nairobi Estate",
    text: `Hi ${user.fullName}, your Nairobi Estate account is ready.`,
  }).catch(() => {});

  sendTokenResponse(user, 201, res);
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user) throw ApiError.unauthorized("No account found with that email");
  if (!(await user.matchPassword(password))) throw ApiError.unauthorized("Incorrect password. Please try again.");
  if (user.accountState !== "ACTIVE") throw ApiError.forbidden("This account is no longer active. Contact support.");

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
  res.json({ success: true, message: "Logged out" });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("savedHomes", "title slug price monthlyPayment images location");
  res.json({ success: true, user });
});

// PATCH /api/auth/me
export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ["fullName", "phone", "companyName", "avatarUrl"];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, user });
});

// POST /api/auth/me/avatar  (any signed-in user — buyer, partner or admin)
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image was uploaded");
  const user = await User.findById(req.user._id);
  const previousPublicId = user.avatarPublicId;

  const saved = await persistFile(req.file, "nairobi-estate/avatars");
  user.avatarUrl = saved.url;
  user.avatarPublicId = saved.publicId;
  await user.save({ validateBeforeSave: false });

  if (previousPublicId) await destroyFile(previousPublicId);

  const safeUser = user.toObject();
  delete safeUser.password;
  res.json({ success: true, user: safeUser });
});

// PATCH /api/auth/password
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) throw ApiError.unauthorized("Your current password is incorrect");
  user.password = newPassword;
  await user.save();
  sendTokenResponse(user, 200, res);
});

// POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() });
  // Always respond the same way so the endpoint can't be used to enumerate accounts.
  if (user) {
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your Nairobi Estate password",
      text: `Reset your password using this link (valid 15 minutes): ${resetUrl}`,
    }).catch(() => {});
  }
  res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
});

// POST /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: Date.now() } });
  if (!user) throw ApiError.badRequest("That reset link is invalid or has expired");
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  sendTokenResponse(user, 200, res);
});
