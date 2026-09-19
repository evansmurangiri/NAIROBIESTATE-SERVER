import mongoose from "mongoose";
import { APPLICATION_STAGES } from "../config/constants.js";

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    detail: String,
    status: { type: String, enum: ["required", "uploaded", "verified", "action-required"], default: "required" },
    fileUrl: String,
    publicId: String,
    reviewerNote: String,
    uploadedAt: Date,
    verifiedAt: Date,
  },
  { _id: false }
);

const REQUIRED_DOCS = [
  { name: "Proof of Identity", detail: "National ID or Passport" },
  { name: "Proof of Income", detail: "Recent payslips or business records" },
  { name: "Bank Statements", detail: "Last 6 months" },
  { name: "KRA Pin Certificate", detail: "Valid KRA PIN" },
];

const applicationSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", index: true },
    propertyTitle: String,

    stage: { type: String, enum: APPLICATION_STAGES, default: "started", index: true },
    documents: { type: [documentSchema], default: () => REQUIRED_DOCS.map((d) => ({ ...d, status: "required" })) },

    reviewerNote: String,
    decision: { type: String, enum: ["pending", "approved", "declined"], default: "pending" },
    decisionReason: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    requestedAmount: Number,
    approvedAmount: Number,
    startedOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicationSchema.statics.REQUIRED_DOCS = REQUIRED_DOCS;

export default mongoose.model("Application", applicationSchema);
