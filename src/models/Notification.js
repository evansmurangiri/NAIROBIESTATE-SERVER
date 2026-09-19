import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    icon: { type: String, default: "notifications" },
    type: {
      type: String,
      enum: ["application", "listing", "viewing", "alert", "academy", "system", "lead"],
      default: "system",
    },
    link: String, // frontend route to open on click
    read: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
