import express from "express";
import { protect } from "../middleware/auth.js";
import * as c from "../controllers/notificationController.js";

const router = express.Router();
router.use(protect);

router.get("/", c.listNotifications);
router.patch("/read-all", c.markAllRead);
router.patch("/:id/read", c.markRead);
router.delete("/:id", c.deleteNotification);

export default router;
