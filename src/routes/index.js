import express from "express";
import authRoutes from "./authRoutes.js";
import propertyRoutes from "./propertyRoutes.js";
import buyerRoutes from "./buyerRoutes.js";
import viewingRoutes from "./viewingRoutes.js";
import alertRoutes from "./alertRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import applicationRoutes from "./applicationRoutes.js";
import articleRoutes from "./articleRoutes.js";
import partnerRoutes from "./partnerRoutes.js";
import adminRoutes from "./adminRoutes.js";
import publicRoutes from "./publicRoutes.js";

const router = express.Router();

router.get("/health", (req, res) =>
  res.json({ success: true, status: "ok", uptime: Math.round(process.uptime()), env: process.env.NODE_ENV })
);

router.use("/auth", authRoutes);
router.use("/properties", propertyRoutes);
router.use("/buyer", buyerRoutes);
router.use("/viewings", viewingRoutes);
router.use("/alerts", alertRoutes);
router.use("/notifications", notificationRoutes);
router.use("/applications", applicationRoutes);
router.use("/articles", articleRoutes);
router.use("/partner", partnerRoutes);
router.use("/admin", adminRoutes);
router.use("/public", publicRoutes);

export default router;
