import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

// Fail fast on missing critical config rather than misbehaving at runtime.
["MONGO_URI", "JWT_SECRET"].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
});

await connectDB();

const server = app.listen(PORT, () => {
  console.log(`Nairobi Estate API running in ${process.env.NODE_ENV || "development"} on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  server.close(() => process.exit(1));
});
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down gracefully");
  server.close(() => process.exit(0));
});
