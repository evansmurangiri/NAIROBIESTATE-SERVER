import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ROLES, PREQUAL_STATUS } from "../config/constants.js";

const prequalSchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(PREQUAL_STATUS), default: PREQUAL_STATUS.NOT_STARTED },
    step: { type: Number, default: 0 },
    answers: {
      income: Number,
      debt: Number,
      deposit: Number,
      propertyType: String,
      timeline: String,
      employment: String,
      location: String,
    },
    resultAmount: Number,
    monthlyBudget: Number,
    qualifiedUntil: Date,
    completedAt: Date,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, "Full name is required"], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: { type: String, trim: true },
    password: { type: String, required: [true, "Password is required"], minlength: 6, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.BUYER },
    accountState: { type: String, enum: ["ACTIVE", "SUSPENDED", "DISABLED"], default: "ACTIVE" },

    // Partner-only fields
    partnerStatus: { type: String, enum: ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"] },
    companyName: String,

    // Buyer-only
    prequalification: { type: prequalSchema, default: () => ({}) },
    savedHomes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Property" }],
    academyProgress: {
      overallPercent: { type: Number, default: 0 },
      articlesRead: { type: Number, default: 0 },
      guidesDownloaded: { type: Number, default: 0 },
      completedModules: [Number],
    },

    avatarUrl: String,
    avatarPublicId: String,
    lastLoginAt: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetToken;
};

export default mongoose.model("User", userSchema);
