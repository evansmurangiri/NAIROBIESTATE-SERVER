// Business rules live server-side so the frontend is never the source of truth
// for pricing or financing limits.
export const MAX_LISTING_PRICE = Number(process.env.MAX_LISTING_PRICE) || 15000000;
export const KMRC_MAX_FINANCED = Number(process.env.KMRC_MAX_FINANCED) || 10500000;
export const DEFAULT_INTEREST_RATE = Number(process.env.DEFAULT_INTEREST_RATE) || 9.5;
export const DEFAULT_LOAN_TERM_YEARS = Number(process.env.DEFAULT_LOAN_TERM_YEARS) || 25;

export const ROLES = { BUYER: "buyer", PARTNER: "partner", ADMIN: "admin" };

export const PROPERTY_STATUS = {
  DRAFT: "DRAFT",
  PENDING: "PENDING APPROVAL",
  LIVE: "LIVE",
  REJECTED: "REJECTED",
  UNDER_OFFER: "UNDER OFFER",
  SOLD: "SOLD",
  TAKEN_DOWN: "TAKEN DOWN",
};

export const PROPERTY_TYPES = ["House / Villa", "Apartment", "Townhouse", "Land / Plot", "Commercial"];

export const VIEWING_STATUS = {
  PENDING: "Pending Confirmation",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const VIEWING_FORMATS = ["In-Person", "Virtual Tour", "Online Guided"];
export const APPLICATION_STAGES = ["started", "documents", "review", "decision"];
export const ARTICLE_STATUS = { DRAFT: "Draft", PUBLISHED: "Published", SCHEDULED: "Scheduled" };
export const PREQUAL_STATUS = { NOT_STARTED: "not_started", IN_PROGRESS: "in_progress", COMPLETE: "complete" };
