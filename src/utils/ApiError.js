export default class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
  static badRequest(m = "Bad request", d) { return new ApiError(400, m, d); }
  static unauthorized(m = "Not authenticated") { return new ApiError(401, m); }
  static forbidden(m = "You do not have permission to do that") { return new ApiError(403, m); }
  static notFound(m = "Resource not found") { return new ApiError(404, m); }
  static conflict(m = "Conflict") { return new ApiError(409, m); }
}
