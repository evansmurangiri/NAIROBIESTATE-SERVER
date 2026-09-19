import mongoose from "mongoose";
import slugify from "slugify";
import { PROPERTY_STATUS, PROPERTY_TYPES, MAX_LISTING_PRICE } from "../config/constants.js";
import { estimateMonthlyPayment, minimumDeposit } from "../utils/loan.js";

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 150 },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: [true, "Description is required"] },

    type: { type: String, enum: PROPERTY_TYPES, required: true },
    intent: { type: String, enum: ["sale", "rent"], default: "sale" },

    county: { type: String, required: true, trim: true, index: true },
    suburb: { type: String, required: true, trim: true, index: true },
    location: { type: String }, // "Suburb, County" convenience field
    coordinates: { lat: Number, lng: Number },

    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [1, "Price must be positive"],
      max: [MAX_LISTING_PRICE, `Nairobi Estate lists homes up to KES ${MAX_LISTING_PRICE.toLocaleString()}`],
      index: true,
    },
    // Derived server-side from price so buyers can filter/sort by affordability.
    monthlyPayment: { type: Number, index: true },
    minimumDeposit: { type: Number },

    beds: { type: Number, default: 0, index: true },
    baths: { type: Number, default: 0 },
    landSize: String,
    parking: Number,

    amenities: [String],
    features: [String],
    images: [{ url: String, publicId: String, isCover: Boolean }],
    virtualTourUrl: String,

    badge: String, // "Just Listed", "Price Reduced", etc.
    status: { type: String, enum: Object.values(PROPERTY_STATUS), default: PROPERTY_STATUS.PENDING, index: true },

    // Ownership / attribution
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ownerType: { type: String, enum: ["partner", "admin"], required: true },
    partnerName: String, // denormalised for fast admin listing tables

    // Moderation
    flagged: { type: Boolean, default: false },
    flagReason: String,
    rejectionReason: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    publishedAt: Date,

    views: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

propertySchema.index({ title: "text", description: "text", suburb: "text", county: "text" });

propertySchema.pre("save", async function (next) {
  if (this.isModified("title") || !this.slug) {
    const base = slugify(this.title, { lower: true, strict: true });
    let candidate = base;
    let n = 1;
    // Guarantee uniqueness without relying on a failed insert.
    while (await mongoose.models.Property.exists({ slug: candidate, _id: { $ne: this._id } })) {
      candidate = `${base}-${n++}`;
    }
    this.slug = candidate;
  }
  if (this.isModified("price")) {
    this.monthlyPayment = estimateMonthlyPayment(this.price);
    this.minimumDeposit = minimumDeposit(this.price);
  }
  if (this.isModified("suburb") || this.isModified("county")) {
    this.location = `${this.suburb}, ${this.county}`;
  }
  next();
});

export default mongoose.model("Property", propertySchema);
