import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

// Run after an express-validator chain to turn failures into a 400.
export default function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.badRequest("Validation failed", details));
}
