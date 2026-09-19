import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/alertController.js";

const router = express.Router();
router.use(protect, authorize(ROLES.BUYER, ROLES.ADMIN));

router.get("/", c.listAlerts);
router.post("/", body("name").trim().notEmpty().withMessage("Alert name is required"), validate, c.createAlert);
router.get("/:id/matches", c.alertMatches);
router.patch("/:id", c.updateAlert);
router.patch("/:id/toggle", c.toggleAlert);
router.delete("/:id", c.deleteAlert);

export default router;
