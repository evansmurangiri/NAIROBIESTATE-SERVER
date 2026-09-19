import mongoose from "mongoose";

const consultationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    scheduledFor: Date,
    method: { type: String, enum: ["Phone Call", "WhatsApp", "Video Meeting", "Office Meeting"], default: "Phone Call" },
    status: { type: String, enum: ["requested", "confirmed", "completed", "cancelled"], default: "requested" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("Consultation", consultationSchema);
