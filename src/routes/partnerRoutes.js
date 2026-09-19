import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/partnerController.js";

const router = express.Router();
router.use(protect, authorize(ROLES.PARTNER, ROLES.ADMIN));

router.get("/dashboard", c.partnerDashboard);
router.get("/leads", c.listLeads);
router.patch("/leads/:id", c.updateLead);
router.get("/listings/:id/insights", c.listingInsights);

export default router;
