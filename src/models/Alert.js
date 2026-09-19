import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: String,
    county: String,
    propertyTypes: [String],
    minBeds: Number,
    maxPrice: Number,
    maxMonthlyPayment: Number,
    frequency: { type: String, enum: ["Instant", "Daily Digest", "Weekly Summary"], default: "Daily Digest" },
    active: { type: Boolean, default: true },
    lastMatchedAt: Date,
    matchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Turns a saved alert into a Property query — also used to notify buyers when
// a new listing goes live (see notificationService.matchAlertsForProperty).
alertSchema.methods.toPropertyQuery = function () {
  const q = { status: "LIVE" };
  if (this.county) q.county = this.county;
  if (this.location) q.$or = [{ suburb: new RegExp(this.location, "i") }, { county: new RegExp(this.location, "i") }];
  if (this.propertyTypes?.length) q.type = { $in: this.propertyTypes };
  if (this.minBeds) q.beds = { $gte: this.minBeds };
  if (this.maxPrice) q.price = { $lte: this.maxPrice };
  if (this.maxMonthlyPayment) q.monthlyPayment = { $lte: this.maxMonthlyPayment };
  return q;
};

export default mongoose.model("Alert", alertSchema);
