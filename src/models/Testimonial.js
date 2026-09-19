import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    headline: { type: String, required: true },
    quote: { type: String, required: true },
    author: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Testimonial", testimonialSchema);
