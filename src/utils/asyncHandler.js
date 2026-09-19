// Wraps async handlers so rejected promises reach the error middleware without
// a try/catch in every controller.
export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
