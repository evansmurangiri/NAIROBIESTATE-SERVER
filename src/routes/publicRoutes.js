import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import * as c from "../controllers/publicController.js";

const router = express.Router();

router.get("/config", c.getConfig);
router.get("/testimonials", c.listTestimonials);

router.post("/contact",
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("message").trim().notEmpty(),
  validate, c.submitContact);

router.post("/consultations", optionalAuth,
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  validate, c.bookConsultation);

router.post("/subscribe", body("email").isEmail().normalizeEmail(), validate, c.subscribe);

router.post("/calculators/monthly-payment", c.calcMonthlyPayment);
router.post("/calculators/affordability", c.calcAffordability);
router.post("/calculators/rent-vs-buy", c.calcRentVsBuy);
router.post("/calculators/deposit", c.calcDeposit);
router.post("/calculators/buying-costs", c.calcBuyingCosts);

export default router;
