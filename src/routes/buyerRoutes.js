import express from "express";
import { body } from "express-validator";
import validate from "../middleware/validate.js";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/buyerController.js";

const router = express.Router();
router.use(protect, authorize(ROLES.BUYER, ROLES.ADMIN));

router.get("/saved-homes", c.getSavedHomes);
router.post("/saved-homes/:propertyId", c.toggleSavedHome);
router.delete("/saved-homes", c.removeSavedHomes);

router.get("/prequalification", c.getPrequalification);
router.patch("/prequalification", body("key").notEmpty(), validate, c.savePrequalAnswer);
router.post("/prequalification/complete", c.completePrequalification);
router.delete("/prequalification", c.resetPrequalification);

router.get("/recommendations", c.getRecommendations);

router.get("/academy-progress", c.getAcademyProgress);
router.patch("/academy-progress", c.updateAcademyProgress);

export default router;
