import mongoose from "mongoose";

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    preferences: {
      homesInBudget: { type: Boolean, default: false },
      buyingTips: { type: Boolean, default: true },
      consultationRequested: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Subscriber", subscriberSchema);
