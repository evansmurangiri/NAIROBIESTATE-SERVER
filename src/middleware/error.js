import ApiError from "../utils/ApiError.js";

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err;

  // Mongoose: bad ObjectId
  if (err.name === "CastError") {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }
  // Mongoose: duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    error = ApiError.conflict(`That ${field} is already in use`);
  }
  // Mongoose: validation
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    error = ApiError.badRequest("Validation failed", details);
  }

  const statusCode = error.statusCode || 500;
  const payload = {
    success: false,
    message: error.message || "Something went wrong on our end",
  };
  if (error.details) payload.details = error.details;
  if (process.env.NODE_ENV !== "production") payload.stack = err.stack;

  if (statusCode >= 500) console.error("SERVER ERROR:", err);

  res.status(statusCode).json(payload);
}
