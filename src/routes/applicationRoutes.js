import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/applicationController.js";

const router = express.Router();
router.use(protect);

router.get("/mine", c.myApplications);
router.get("/owner", authorize(ROLES.PARTNER, ROLES.ADMIN), c.ownerApplications);
router.get("/", authorize(ROLES.ADMIN), c.listApplications);
router.post("/", body("propertyId").notEmpty(), validate, c.startApplication);
router.get("/:id", c.getApplication);
router.post("/:id/documents", upload.single("file"), c.uploadDocument);
router.patch("/:id/review", authorize(ROLES.PARTNER, ROLES.ADMIN), c.reviewApplication);

export default router;
