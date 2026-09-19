import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import * as c from "../controllers/authController.js";

const router = express.Router();

router.post("/register",
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("role").optional().isIn(["buyer", "partner"]).withMessage("Role must be buyer or partner"),
  validate, c.register);

router.post("/login",
  body("email").isEmail().withMessage("A valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  validate, c.login);

router.post("/logout", c.logout);
router.post("/forgot-password", body("email").isEmail().normalizeEmail(), validate, c.forgotPassword);
router.post("/reset-password/:token",
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  validate, c.resetPassword);

router.get("/me", protect, c.getMe);
router.patch("/me", protect, c.updateMe);
router.post("/me/avatar", protect, upload.single("avatar"), c.uploadAvatar);
router.patch("/password", protect,
  body("currentPassword").notEmpty(),
  body("newPassword").isLength({ min: 6 }),
  validate, c.updatePassword);

export default router;
