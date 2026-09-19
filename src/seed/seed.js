import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import Article from "../models/Article.js";
import Testimonial from "../models/Testimonial.js";
import Alert from "../models/Alert.js";
import Notification from "../models/Notification.js";
import Viewing from "../models/Viewing.js";
import Application from "../models/Application.js";
import Lead from "../models/Lead.js";
import { PROPERTY_STATUS, ARTICLE_STATUS, VIEWING_STATUS } from "../config/constants.js";

const IMG = {
  azure: "https://lh3.googleusercontent.com/aida-public/AB6AXuBjcrGLs-NY3DtqpeSj1IvlrzXyDziUEBJuk5r7H8KDSa9TtTMmLMMWCGdJ73WGkfK_RvrhBfyZNccZVRrAPqiFWrPlJGwLG6bbv2NNnOAM6Kmz8TdOdcS3XmMOAmgwOGD4Vef1MXO5-43cLEdeES6UoBSeGXvune7CBM_fow1rX3yURFK5WBb0CrfRxVlseg-dmt-Qxn5fzJNCKo_35b5HgWrHN6IL5KQJyz94kxnJ1syZnklZXB07",
  karen: "https://lh3.googleusercontent.com/aida-public/AB6AXuArm95aQPho9TbIVICWtSnLg39A5BIpx_V40QhS5OuSyJLYcl-xknlmxU_bAUFrXnxZRiaKJ7ZhSB_2rP-8A0xcG9GYzLsbmRDtchEqdojoD5hWc_X1GCikbHSrIqltSseEMN_u60zwcRyozTs66qe9hwDmaEfKtKg-S69xGqJd5gMyxZEatTLMOL0s3Fv_c9LMx_4pJSXO012A34ZWL-V6fX_EB-a_s05gHbnjo5DpmrMpelyoVyOi",
  crest: "https://lh3.googleusercontent.com/aida-public/AB6AXuANepIE8EDmTSTpqCjrFVQ3HR_C7dUVNhhYTfpCzgwlqymAyMlW8x6geqkEJ14h_K4m0vUlHkgrmL_j3iFax13ABE-hDe3bepVNzRay9o7P3M3FLoKEmJmE5EabzJg2vra14eaeuvMTbvM0e-gA_wz11bEY8lBX4afIa3MIZFARiIiyvMHeUuePvPDSabiNdLA2U3I30T2UoNWIIdvBFi_A0cHLKudJG7rNBLszlvz6_TTs0v6H9hNG",
  spring: "https://lh3.googleusercontent.com/aida-public/AB6AXuA9YzDMdKrAGN_-dgHItcsFqZMrhK-IDQmy2h3U8ao0jIzrQCDxgECYHhZiovC_sN9oY7MCLQuJUEfChVlX6LIdVMrf9mqlOWA8L096JKHr56bNBevjveusSX5wbb7iTYtiZ3RaZ1sjmcQATTFhb1Z0PuQJKXc3JTWSbtM3-kdZ0Cr-tZdoQ7-B--8zH7h0FFEtYQqRmggwdyrGd3ATD2TR7NoT5ih4y4o1RSPImhWuUAlisFnwHcL6",
  kileleshwa: "https://lh3.googleusercontent.com/aida-public/AB6AXuAA586ZcOT6TpxsL_bUOXtLI06m4pr8NkJCqEMjfrw9-7KF_gvGN_cmkV149jkMeR_5lpGMmZ_lNksNULVEmEAAFJse8AmYEr3-Pcau6bS_zsAiOClO8-pppJOVxvlGxwcrFeUzh7iiaNP-sflCEvE0cz8QirULg5YoSHr1GSXrWeeUfiTOpwsfX2cEECxuqB40Gjcaf-ow511lL03Zq829JHd8xiBp8LwqNqpvsV7qEKBdEbtchGB9",
  lavington: "https://lh3.googleusercontent.com/aida-public/AB6AXuAZxUyQ35vh71hzuOYD5NtSOxZge9V-1l54Qnfq2gy1mDaMyFgeGwfIWhLB_bOPIGPviHflX2P8UEmdyGcMcw_ZmiJHT0-rWYNnvXZDg5UNFdFqbWzGX1zwJKKKzAkMkbVAi8TZxTwMT0rtN0nprm1lw2lUiZkZF4drZHWdLqSbM1WyILWmckg_bcv7Tasy2U485v6-EWcjLV29c6d0QJnBb70uNVNuW7FhQrXZOBHwHtp4UGj0LJYp",
};

const img = (url, alt) => [{ url, publicId: null, isCover: true }];

async function destroy() {
  await Promise.all([
    User.deleteMany({}), Property.deleteMany({}), Article.deleteMany({}),
    Testimonial.deleteMany({}), Alert.deleteMany({}), Notification.deleteMany({}),
    Viewing.deleteMany({}), Application.deleteMany({}), Lead.deleteMany({}),
  ]);
  console.log("All collections cleared.");
}

async function seed() {
  await destroy();

  // ---- Users ----
  const [admin, partner, partner2, buyer] = await User.create([
    { fullName: "Nairobi Estate Admin", email: "admin@demo.com", phone: "+254 700 000003", password: "demo1234", role: "admin" },
    { fullName: "Estate Partner", email: "partner@demo.com", phone: "+254 700 000002", password: "demo1234", role: "partner", partnerStatus: "VERIFIED", companyName: "Horizon Real Estate Group" },
    { fullName: "Pam Golding", email: "partner2@demo.com", phone: "+254 700 000004", password: "demo1234", role: "partner", partnerStatus: "VERIFIED", companyName: "Pam Golding Properties" },
    { fullName: "Philip Otieno", email: "buyer@demo.com", phone: "+254 700 000001", password: "demo1234", role: "buyer" },
  ]);
  console.log("Users seeded (password for all: demo1234)");

  // ---- Properties ----
  // Every price respects the KES 15,000,000 listing ceiling.
  const propertyDefs = [
    { title: "The Karen Contemporary", type: "House / Villa", county: "Nairobi", suburb: "Karen", price: 14_800_000, beds: 4, baths: 4.5, landSize: "0.5 Acres", badge: "Available Now", owner: partner, image: IMG.karen,
      description: "Set on half an acre of mature gardens in Miotoni, Karen. Four bedrooms, double-volume lounge, and a fitted kitchen with a central island.",
      features: ["Solar water heating & backup inverter", "24/7 manned security", "Clubhouse with heated pool & gym", "0.5-acre landscaped garden"],
      amenities: ["Gated Community", "24/7 Security", "Swimming Pool", "Borehole Water"] },
    { title: "The Crest Apartments", type: "Apartment", county: "Nairobi", suburb: "Kilimani", price: 13_500_000, beds: 3, baths: 2, badge: "Open for Viewing", owner: partner, image: IMG.crest,
      description: "Crisp white balconies and dark wood accents in a clean, modern building minutes from Yaya Centre.",
      features: ["Gym", "Backup generator", "Ample visitor parking", "Children's play area"],
      amenities: ["Gym", "Backup Generator", "Covered Parking", "Children's Play Area"] },
    { title: "Spring Valley Townhouse", type: "Townhouse", county: "Nairobi", suburb: "Spring Valley", price: 14_200_000, beds: 3, baths: 2.5, badge: "Most Popular", owner: partner2, image: IMG.spring,
      description: "Warm stone cladding and dark grey roofing in a professional, stately architectural style.",
      features: ["Rooftop terrace", "Smart home wiring", "Double garage", "Estate clubhouse"],
      amenities: ["Gated Community", "Covered Parking", "Fibre Internet Ready"] },
    { title: "Kileleshwa Heights", type: "Apartment", county: "Nairobi", suburb: "Kileleshwa", price: 11_500_000, beds: 3, baths: 2, badge: "Limited Availability", owner: partner2, image: IMG.kileleshwa,
      description: "Sharp geometric architecture with expansive glass balustrades, captured in soft morning light.",
      features: ["Elevator access", "Rooftop lounge", "24hr concierge", "EV charging bay"],
      amenities: ["24/7 Security", "Gym", "Covered Parking"] },
    { title: "The Azure Residences", type: "Apartment", county: "Nairobi", suburb: "Kilimani", price: 9_800_000, beds: 2, baths: 2, badge: "Just Listed", owner: partner, image: IMG.azure,
      description: "A bright, spacious apartment with floor-to-ceiling windows overlooking the Kilimani skyline.",
      features: ["Rooftop pool", "24/7 backup power", "Covered parking", "Fibre internet ready"],
      amenities: ["Swimming Pool", "Backup Generator", "Fibre Internet Ready"] },
    { title: "Lavington Green Villa", type: "House / Villa", county: "Nairobi", suburb: "Lavington", price: 14_950_000, beds: 4, baths: 3.5, landSize: "0.3 Acres", badge: "Price Reduced", owner: partner2, image: IMG.lavington,
      description: "A modern luxury villa featuring expansive glass windows, warm exterior lighting, and lush manicured gardens.",
      features: ["Home office", "Landscaped garden", "Borehole water", "CCTV coverage"],
      amenities: ["Gated Community", "Borehole Water", "CCTV Coverage", "Servant Quarters"] },
    { title: "Ruaka Starter Home", type: "Apartment", county: "Kiambu", suburb: "Ruaka", price: 6_500_000, beds: 2, baths: 1, badge: "0% Down", owner: partner, image: IMG.crest,
      description: "An affordable two-bedroom ideal for first-time buyers, close to the Northern Bypass.",
      features: ["Borehole water", "Secure parking", "Playground"],
      amenities: ["24/7 Security", "Covered Parking", "Children's Play Area"] },
    { title: "Syokimau Family Maisonette", type: "Townhouse", county: "Machakos", suburb: "Syokimau", price: 8_900_000, beds: 3, baths: 2, badge: "Available Now", owner: partner2, image: IMG.spring,
      description: "A three-bedroom maisonette in a gated court, minutes from the SGR terminus.",
      features: ["Gated court", "Solar water heating", "Private garden"],
      amenities: ["Gated Community", "Solar Water Heating", "Borehole Water"] },
  ];

  const properties = [];
  for (const d of propertyDefs) {
    const p = await Property.create({
      title: d.title, description: d.description, type: d.type,
      county: d.county, suburb: d.suburb, price: d.price,
      beds: d.beds, baths: d.baths, landSize: d.landSize, parking: 2,
      amenities: d.amenities, features: d.features,
      images: img(d.image), badge: d.badge,
      status: PROPERTY_STATUS.LIVE, publishedAt: new Date(),
      owner: d.owner._id, ownerType: "partner",
      partnerName: d.owner.companyName,
      views: Math.floor(Math.random() * 1500),
    });
    properties.push(p);
  }

  // One pending + one admin-owned listing so the moderation queue isn't empty.
  await Property.create({
    title: "The Riverside Villas, Lavington", description: "Awaiting documentation review before going live.",
    type: "Townhouse", county: "Nairobi", suburb: "Lavington", price: 14_000_000, beds: 4, baths: 3,
    images: img(IMG.lavington), status: PROPERTY_STATUS.PENDING,
    owner: partner._id, ownerType: "partner", partnerName: partner.companyName,
    flagged: true, flagReason: "Incomplete documentation",
  });
  await Property.create({
    title: "Nairobi Estate Show Home", description: "Our flagship show home, listed directly by Nairobi Estate.",
    type: "House / Villa", county: "Nairobi", suburb: "Runda", price: 15_000_000, beds: 5, baths: 4,
    images: img(IMG.karen), status: PROPERTY_STATUS.LIVE, publishedAt: new Date(),
    owner: admin._id, ownerType: "admin", partnerName: "Nairobi Estate (Admin)",
  });
  console.log(`Properties seeded: ${properties.length + 2}`);

  // ---- Articles ----
  const articleDefs = [
    ["The Complete First-Time Home Buyer's Guide in Kenya", "First-Time Home Buyers", "menu_book"],
    ["How to Calculate the Monthly Payment You Can Comfortably Afford", "Mortgage Education", "calculate"],
    ["What Does Mortgage Pre-Qualification Mean?", "Mortgage Education", "fact_check"],
    ["Rent-to-Own vs Renting: Which Is Right for You?", "Rent-to-Own", "compare_arrows"],
    ["How Much Deposit Do You Really Need to Buy a Home?", "Personal Finance", "savings"],
    ["Best Areas for First-Time Home Buyers in Nairobi", "Property Guides", "map"],
    ["The Hidden Costs of Buying a Home", "Home Buying Tips", "receipt_long"],
    ["How to Improve Your Mortgage Approval Chances", "Mortgage Education", "trending_up"],
    ["Renting vs Buying in Kenya", "Property Investment", "balance"],
  ];
  for (const [title, category, icon] of articleDefs) {
    await Article.create({
      title, category, icon,
      excerpt: `${title} — a practical guide for Kenyan home buyers, covering what to check, what it costs, and how to prepare.`,
      body: `## Introduction\n\n${title} is one of the most common questions we hear from first-time buyers in Kenya.\n\n### Know what you can afford\nBefore you fall in love with a home, work out your realistic monthly budget. Lenders generally want your total monthly debt, including a new mortgage, to stay under about a third of your gross income.\n\n### Get pre-qualified early\nPre-qualification tells you, in minutes, roughly what a lender may be willing to offer. It costs nothing and does not affect your credit score.\n\n### Budget for the extras\nStamp duty, legal fees, valuation fees, and registration typically add several percentage points on top of the purchase price.\n\n### Choose the right neighbourhood\nBeyond price, think about commute times, schools, security, and how the area is trending.\n\n## Conclusion\nBuying a first home is a process, not a single decision. Take it one step at a time and use the calculators to stay grounded in real numbers.`,
      status: ARTICLE_STATUS.PUBLISHED, publishedAt: new Date(),
      author: admin._id, authorName: "Achieng Otieno", authorRole: "Senior Home Buying Advisor",
      reads: Math.floor(Math.random() * 5000), downloads: Math.floor(Math.random() * 400),
    });
  }
  await Article.create({
    title: "Navigating Mortgages in Kenya", category: "Mortgage Education", icon: "account_balance",
    excerpt: "A draft guide to lender selection.", body: "Draft content pending review.",
    status: ARTICLE_STATUS.DRAFT, author: admin._id, authorName: "Finance Team",
  });
  console.log(`Articles seeded: ${articleDefs.length + 1}`);

  // ---- Testimonials ----
  await Testimonial.insertMany([
    { headline: "We thought buying a home was years away.", quote: "Nairobi Estate helped us understand what we could comfortably afford each month and showed us homes within our budget.", author: "James & Faith, First-Time Home Buyers" },
    { headline: "Browsing by monthly payment changed everything.", quote: "Every other site only showed purchase prices. Seeing estimated monthly payments made it much easier to compare.", author: "Brian O., Nairobi" },
    { headline: "The pre-qualification gave us confidence.", quote: "Completing the pre-qualification helped us understand our options before submitting a full application.", author: "Kevin N., Nakuru" },
    { headline: "We stopped wasting time on homes we couldn't afford.", quote: "Once we knew our estimated monthly payment, we focused only on homes that matched our finances.", author: "David & Mercy, Nairobi" },
    { headline: "One expert guided us the whole way.", quote: "One advisor explained everything from finding a home to preparing our application.", author: "Grace A., Kisumu" },
    { headline: "We finally understood the real cost of owning.", quote: "After using the affordability calculator, we realized homeownership was within reach.", author: "Peter & Anne, Nairobi" },
  ]);

  // ---- Buyer demo data ----
  buyer.savedHomes = [properties[0]._id, properties[1]._id, properties[2]._id];
  buyer.prequalification = {
    status: "complete", step: 7,
    answers: { income: 250000, debt: 15000, deposit: 1000000, propertyType: "Apartment", timeline: "Short Term (3–6 months)", employment: "Employed (salaried)", location: "Nairobi" },
    monthlyBudget: 60000, resultAmount: 8100000,
    qualifiedUntil: new Date(Date.now() + 90 * 864e5), completedAt: new Date(),
  };
  buyer.academyProgress = { overallPercent: 65, articlesRead: 12, guidesDownloaded: 4, completedModules: [1] };
  await buyer.save();

  await Alert.insertMany([
    { user: buyer._id, name: "Kilimani Apartments", location: "Kilimani", county: "Nairobi", propertyTypes: ["Apartment"], minBeds: 2, maxPrice: 14000000, frequency: "Daily Digest", active: true },
    { user: buyer._id, name: "Westlands Villas", location: "Westlands", county: "Nairobi", minBeds: 4, frequency: "Weekly Summary", active: false },
  ]);

  const viewing = await Viewing.create({
    property: properties[0]._id, buyer: buyer._id,
    propertyTitle: properties[0].title, location: properties[0].location,
    scheduledFor: new Date(Date.now() + 7 * 864e5), timeLabel: "10:00 AM",
    format: "In-Person", status: VIEWING_STATUS.CONFIRMED,
    contactName: buyer.fullName, contactEmail: buyer.email, contactPhone: buyer.phone,
    agent: partner._id, agentName: partner.companyName,
  });

  const application = await Application.create({
    buyer: buyer._id, property: properties[0]._id, propertyTitle: properties[0].title,
    stage: "review", requestedAmount: properties[0].price,
    reviewerNote: "Your KRA Pin document appears blurry. Please re-upload a high-resolution PDF.",
  });
  application.documents[0].status = "verified";
  application.documents[1].status = "verified";
  application.documents[2].status = "verified";
  application.documents[3].status = "action-required";
  application.documents[3].reviewerNote = "Re-upload required (blurry)";
  await application.save();

  await Lead.insertMany([
    { partner: partner._id, property: properties[0]._id, buyer: buyer._id, name: "David Kamau", email: "david@example.com", phone: "+254 711 111111", source: "enquiry", detail: `Inquiry: ${properties[0].title}` },
    { partner: partner._id, property: properties[1]._id, name: "Sarah Ochieng", email: "sarah@example.com", phone: "+254 722 222222", source: "viewing", detail: `Viewing: ${properties[1].title}` },
    { partner: partner2._id, name: "James Mutua", email: "james@example.com", phone: "+254 733 333333", source: "general", detail: "General Inquiry" },
  ]);

  await Notification.insertMany([
    { user: buyer._id, title: "Application Under Review", body: `Your application for ${properties[0].title} is being reviewed.`, icon: "assignment", type: "application", link: "/buyer/applications" },
    { user: buyer._id, title: "New Listing Match", body: `${properties[4].title} matches your "Kilimani Apartments" alert.`, icon: "home_work", type: "alert", link: `/properties/${properties[4].slug}` },
    { user: buyer._id, title: "Viewing Confirmed", body: `Your viewing of ${properties[0].title} is confirmed.`, icon: "event_available", type: "viewing", read: true, link: "/buyer/viewings" },
    { user: partner._id, title: "New Enquiry", body: "David Kamau enquired about one of your listings.", icon: "forward_to_inbox", type: "lead", link: "/partner/dashboard" },
    { user: admin._id, title: "Listing Awaiting Approval", body: "The Riverside Villas, Lavington was submitted for review.", icon: "pending_actions", type: "listing", link: "/admin/properties" },
  ]);

  console.log("\n--- Seed complete ---");
  console.log("Demo accounts (password: demo1234)");
  console.log("  buyer@demo.com     (buyer)");
  console.log("  partner@demo.com   (partner)");
  console.log("  partner2@demo.com  (partner)");
  console.log("  admin@demo.com     (admin)");
}

await connectDB();
try {
  if (process.argv.includes("--destroy")) await destroy();
  else await seed();
  await mongoose.connection.close();
  process.exit(0);
} catch (err) {
  console.error("Seed failed:", err);
  await mongoose.connection.close();
  process.exit(1);
}
