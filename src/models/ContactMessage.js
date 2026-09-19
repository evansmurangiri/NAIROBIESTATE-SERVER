import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    enquiryType: { type: String, default: "General Enquiry" },
    message: { type: String, required: true },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("ContactMessage", contactMessageSchema);
