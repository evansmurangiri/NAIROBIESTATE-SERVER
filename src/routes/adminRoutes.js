import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/adminController.js";

const router = express.Router();
router.use(protect, authorize(ROLES.ADMIN));

router.get("/properties", c.listAllProperties);
router.patch("/properties/:id/status", body("status").notEmpty(), validate, c.setPropertyStatus);
router.patch("/properties/:id/flag", c.flagProperty);

router.get("/users", c.listUsers);
router.post("/users",
  body("fullName").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  validate, c.createStaffUser);
router.patch("/users/:id", c.updateUser);

router.get("/analytics", c.analytics);
router.get("/activity", c.recentActivity);
router.get("/system-health", c.systemHealth);

export default router;
