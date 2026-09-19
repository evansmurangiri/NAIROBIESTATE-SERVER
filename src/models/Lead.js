import mongoose from "mongoose";

// A buyer enquiry routed to the property's owning partner.
const leadSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    email: String,
    phone: String,
    message: String,
    source: { type: String, enum: ["enquiry", "viewing", "general"], default: "enquiry" },
    detail: String,
    status: { type: String, enum: ["new", "contacted", "qualified", "closed"], default: "new", index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Lead", leadSchema);
