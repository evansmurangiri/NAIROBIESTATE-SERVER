import mongoose from "mongoose";
import { VIEWING_STATUS, VIEWING_FORMATS } from "../config/constants.js";

const viewingSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Denormalised so a cancelled/removed listing still renders in history.
    propertyTitle: String,
    location: String,

    scheduledFor: { type: Date, required: true },
    timeLabel: String, // e.g. "11:30"
    format: { type: String, enum: VIEWING_FORMATS, default: "In-Person" },
    status: { type: String, enum: Object.values(VIEWING_STATUS), default: VIEWING_STATUS.PENDING, index: true },

    // Contact details captured on the booking form
    contactName: String,
    contactEmail: String,
    contactPhone: String,
    comments: String,

    agent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    agentName: String,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Viewing", viewingSchema);
