import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES, VIEWING_FORMATS } from "../config/constants.js";
import * as c from "../controllers/viewingController.js";

const router = express.Router();
router.use(protect);

router.post("/",
  body("propertyId").notEmpty().withMessage("propertyId is required"),
  body("scheduledFor").notEmpty().withMessage("A date is required"),
  body("format").optional().isIn(VIEWING_FORMATS),
  validate, c.bookViewing);

router.get("/mine", c.myViewings);
router.get("/owner", authorize(ROLES.PARTNER, ROLES.ADMIN), c.ownerViewings);
router.get("/partner", authorize(ROLES.PARTNER, ROLES.ADMIN), c.ownerViewings); // legacy alias
router.get("/all", authorize(ROLES.ADMIN), c.allViewings);

router.patch("/:id", c.updateViewing);
router.patch("/:id/status", authorize(ROLES.PARTNER, ROLES.ADMIN), c.setViewingStatus);
router.delete("/:id", c.cancelViewing);

export default router;
