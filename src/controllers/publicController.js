import ContactMessage from "../models/ContactMessage.js";
import Consultation from "../models/Consultation.js";
import Subscriber from "../models/Subscriber.js";
import Testimonial from "../models/Testimonial.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import sendEmail from "../utils/sendEmail.js";
import { notify } from "../services/notificationService.js";
import { affordability, buyingCosts, monthlyPayment, minimumDeposit, rentVsBuy } from "../utils/loan.js";
import { ROLES, KMRC_MAX_FINANCED, MAX_LISTING_PRICE } from "../config/constants.js";

// POST /api/public/contact
export const submitContact = asyncHandler(async (req, res) => {
  const msg = await ContactMessage.create(req.body);
  const admins = await User.find({ role: ROLES.ADMIN }).select("_id");
  await Promise.all(admins.map((a) => notify({
    user: a._id, title: "New Contact Message",
    body: `${msg.name} sent an enquiry (${msg.enquiryType}).`,
    icon: "mail", type: "system",
  })));
  await sendEmail({ to: msg.email, subject: "We received your message",
    text: `Hi ${msg.name}, thanks for contacting Nairobi Estate. Our team will reply shortly.` }).catch(() => {});
  res.status(201).json({ success: true, message: "Thanks — a member of our team will reach out shortly." });
});

// POST /api/public/consultations
export const bookConsultation = asyncHandler(async (req, res) => {
  const consultation = await Consultation.create({ ...req.body, user: req.user?._id });
  const admins = await User.find({ role: ROLES.ADMIN }).select("_id");
  await Promise.all(admins.map((a) => notify({
    user: a._id, title: "Consultation Requested",
    body: `${consultation.name} requested a ${consultation.method}.`,
    icon: "support_agent", type: "system",
  })));
  res.status(201).json({ success: true, message: "Consultation requested! We'll confirm your slot by email." });
});

// POST /api/public/subscribe
export const subscribe = asyncHandler(async (req, res) => {
  const { email, name, preferences } = req.body;
  const sub = await Subscriber.findOneAndUpdate(
    { email: email.toLowerCase() },
    { email: email.toLowerCase(), name, preferences, active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true, data: sub, message: "You're subscribed." });
});

// GET /api/public/testimonials
export const listTestimonials = asyncHandler(async (req, res) => {
  const items = await Testimonial.find({ published: true }).sort({ createdAt: -1 }).limit(12).lean();
  res.json({ success: true, count: items.length, data: items });
});

// GET /api/public/config — business rules the frontend needs for its calculators
export const getConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      maxListingPrice: MAX_LISTING_PRICE,
      kmrcMaxFinanced: KMRC_MAX_FINANCED,
      defaultInterestRate: Number(process.env.DEFAULT_INTEREST_RATE) || 9.5,
      defaultLoanTermYears: Number(process.env.DEFAULT_LOAN_TERM_YEARS) || 25,
    },
  });
});

// ---- Calculators (server-side so results are consistent everywhere) ----

// POST /api/public/calculators/monthly-payment
export const calcMonthlyPayment = asyncHandler(async (req, res) => {
  const { price = 0, downPayment = 0, rate, years } = req.body;
  const principal = Math.max(Number(price) - Number(downPayment), 0);
  const payment = monthlyPayment(principal, rate, years);
  const n = (Number(years) || 25) * 12;
  const totalPaid = payment * n;
  res.json({
    success: true,
    data: {
      monthlyPayment: Math.round(payment),
      amountFinanced: Math.round(principal),
      totalInterest: Math.round(totalPaid - principal),
      totalPaid: Math.round(totalPaid),
    },
  });
});

// POST /api/public/calculators/affordability
export const calcAffordability = asyncHandler(async (req, res) => {
  res.json({ success: true, data: affordability(req.body) });
});

// POST /api/public/calculators/rent-vs-buy
export const calcRentVsBuy = asyncHandler(async (req, res) => {
  res.json({ success: true, data: rentVsBuy(req.body) });
});

// POST /api/public/calculators/deposit
export const calcDeposit = asyncHandler(async (req, res) => {
  const price = Number(req.body.price) || 0;
  const deposit = minimumDeposit(price);
  res.json({
    success: true,
    data: {
      price,
      minimumDeposit: deposit,
      kmrcMaxFinanced: KMRC_MAX_FINANCED,
      note: deposit > 0
        ? `This home is above the KES ${KMRC_MAX_FINANCED.toLocaleString()} KMRC financing limit, so a deposit covering the difference is required.`
        : `This home is within the KES ${KMRC_MAX_FINANCED.toLocaleString()} KMRC financing limit, so no deposit is required by default.`,
    },
  });
});

// POST /api/public/calculators/buying-costs
export const calcBuyingCosts = asyncHandler(async (req, res) => {
  res.json({ success: true, data: buyingCosts(Number(req.body.price) || 0) });
});
