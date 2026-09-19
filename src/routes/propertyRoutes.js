import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { PROPERTY_TYPES, ROLES } from "../config/constants.js";
import * as c from "../controllers/propertyController.js";

const router = express.Router();

// Partner's own listings — declared before /:slug so it isn't captured by it.
router.get("/mine", protect, authorize(ROLES.PARTNER, ROLES.ADMIN), c.myListings);

router.get("/", optionalAuth, c.listProperties);
router.get("/similar/:slug", c.similarProperties);
router.get("/:slug", optionalAuth, c.getProperty);
router.get("/:id/financing", c.financingBreakdown);

router.post("/", protect, authorize(ROLES.PARTNER, ROLES.ADMIN),
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("type").isIn(PROPERTY_TYPES).withMessage("Invalid property type"),
  body("county").trim().notEmpty().withMessage("County is required"),
  body("suburb").trim().notEmpty().withMessage("Suburb is required"),
  body("price").isFloat({ gt: 0 }).withMessage("Price must be a positive number"),
  validate, c.createProperty);

router.patch("/:id", protect, authorize(ROLES.PARTNER, ROLES.ADMIN), c.updateProperty);
router.delete("/:id", protect, authorize(ROLES.PARTNER, ROLES.ADMIN), c.deleteProperty);

router.post("/:id/images", protect, authorize(ROLES.PARTNER, ROLES.ADMIN), upload.array("images", 12), c.uploadImages);
router.delete("/:id/images/:publicId", protect, authorize(ROLES.PARTNER, ROLES.ADMIN), c.deleteImage);

router.post("/:id/enquire", protect, c.enquire);

export default router;
