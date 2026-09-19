import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/articleController.js";

const router = express.Router();

router.get("/", c.listArticles);
router.get("/categories", c.listCategories);
router.get("/admin/all", protect, authorize(ROLES.ADMIN), c.adminListArticles);

router.post("/", protect, authorize(ROLES.ADMIN),
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("body").trim().notEmpty().withMessage("Body is required"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  validate, c.createArticle);

router.post("/:id/cover", protect, authorize(ROLES.ADMIN), upload.single("image"), c.uploadCover);
router.patch("/:id", protect, authorize(ROLES.ADMIN), c.updateArticle);
router.delete("/:id", protect, authorize(ROLES.ADMIN), c.deleteArticle);

router.post("/:slug/download", c.trackDownload);
router.get("/:slug", optionalAuth, c.getArticle);

export default router;
