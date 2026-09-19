import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import path from "path";

import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

app.set("trust proxy", 1);

// ---- Security & parsing ----
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin(origin, cb) {
    // Allow tools without an Origin header (curl, Postman, server-to-server).
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} is not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// ---- Rate limiting ----
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests — please try again shortly." },
}));

// Tighter limit on auth endpoints to slow credential stuffing.
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use("/api/auth/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }));
app.use("/api/auth/forgot-password", rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }));

// ---- Static (local file uploads when Cloudinary isn't configured) ----
app.use("/uploads", express.static(path.resolve("uploads")));

// ---- API ----
app.use("/api", routes);

app.get("/", (req, res) =>
  res.json({ success: true, message: "Nairobi Estate API", docs: "/api/health" })
);

app.use(notFound);
app.use(errorHandler);

export default app;
