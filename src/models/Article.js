import mongoose from "mongoose";
import slugify from "slugify";
import { ARTICLE_STATUS } from "../config/constants.js";

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, index: true },
    excerpt: { type: String, maxlength: 400 },
    body: { type: String, required: true },
    category: { type: String, required: true, index: true },
    icon: { type: String, default: "article" },
    coverImage: { url: String, publicId: String, alt: String },

    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorName: String,
    authorRole: String,

    status: { type: String, enum: Object.values(ARTICLE_STATUS), default: ARTICLE_STATUS.DRAFT, index: true },
    publishedAt: Date,
    scheduledFor: Date,

    readingTimeMinutes: Number,
    reads: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    tags: [String],
  },
  { timestamps: true }
);

articleSchema.index({ title: "text", excerpt: "text", body: "text" });

articleSchema.pre("save", async function (next) {
  if (this.isModified("title") || !this.slug) {
    const base = slugify(this.title, { lower: true, strict: true });
    let candidate = base;
    let n = 1;
    while (await mongoose.models.Article.exists({ slug: candidate, _id: { $ne: this._id } })) {
      candidate = `${base}-${n++}`;
    }
    this.slug = candidate;
  }
  if (this.isModified("body")) {
    const words = this.body.trim().split(/\s+/).length;
    this.readingTimeMinutes = Math.max(1, Math.round(words / 200));
  }
  if (this.isModified("status") && this.status === ARTICLE_STATUS.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

export default mongoose.model("Article", articleSchema);
