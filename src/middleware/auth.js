import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// Requires a valid JWT. Accepts either the httpOnly cookie or an
// `Authorization: Bearer <token>` header.
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) throw ApiError.unauthorized("Please log in to access this resource");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized("Your session is invalid or has expired. Please log in again.");
  }

  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized("The account for this session no longer exists");
  if (user.accountState !== "ACTIVE") throw ApiError.forbidden("This account is no longer active");

  req.user = user;
  next();
});

// Role gate. This is the real enforcement point — the frontend guard is UX only.
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`A ${req.user.role} account cannot perform this action`));
  }
  next();
};

// Attaches req.user when a token is present but never rejects. Used on public
// endpoints that personalise output (e.g. marking which listings are saved).
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer ")) token = req.headers.authorization.split(" ")[1];
  else if (req.cookies?.token) token = req.cookies.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.accountState === "ACTIVE") req.user = user;
  } catch (err) {
    // ignore — treated as anonymous
  }
  next();
});
