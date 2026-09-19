import Property from "../models/Property.js";
import Lead from "../models/Lead.js";
import Viewing from "../models/Viewing.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { PROPERTY_STATUS } from "../config/constants.js";

// GET /api/partner/dashboard
export const partnerDashboard = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const [activeListings, pendingListings, newLeads, scheduledViewings, viewAgg, listings, leads] = await Promise.all([
    Property.countDocuments({ owner, status: PROPERTY_STATUS.LIVE }),
    Property.countDocuments({ owner, status: PROPERTY_STATUS.PENDING }),
    Lead.countDocuments({ partner: owner, status: "new" }),
    Viewing.countDocuments({ agent: owner, status: { $in: ["Pending Confirmation", "Confirmed"] } }),
    Property.aggregate([
      { $match: { owner: req.user._id } },
      { $group: { _id: null, views: { $sum: "$views" }, saves: { $sum: "$saveCount" } } },
    ]),
    Property.find({ owner }).sort({ createdAt: -1 }).limit(5).lean(),
    Lead.find({ partner: owner }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const totalReach = viewAgg[0]?.views || 0;
  const totalSaves = viewAgg[0]?.saves || 0;
  const conversionRate = totalReach ? Math.round((newLeads / totalReach) * 1000) / 10 : 0;

  res.json({
    success: true,
    data: {
      kpis: { totalReach, totalSaves, conversionRate, activeListings, pendingListings, newLeads, scheduledViewings },
      recentListings: listings,
      recentLeads: leads,
    },
  });
});

// GET /api/partner/leads ?status=
export const listLeads = asyncHandler(async (req, res) => {
  const filter = { partner: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const items = await Lead.find(filter).sort({ createdAt: -1 }).populate("property", "slug title");
  res.json({ success: true, count: items.length, data: items });
});

// PATCH /api/partner/leads/:id  { status }
export const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found");
  if (String(lead.partner) !== String(req.user._id)) throw ApiError.forbidden("That lead belongs to another partner");
  if (req.body.status) lead.status = req.body.status;
  await lead.save();
  res.json({ success: true, data: lead });
});

// GET /api/partner/listings/:id/insights
export const listingInsights = asyncHandler(async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) throw ApiError.notFound("Property not found");
  if (String(property.owner) !== String(req.user._id)) throw ApiError.forbidden("That listing belongs to another partner");

  const [leads, viewings] = await Promise.all([
    Lead.countDocuments({ property: property._id }),
    Viewing.countDocuments({ property: property._id }),
  ]);
  res.json({
    success: true,
    data: { views: property.views, saves: property.saveCount, leads, viewings, status: property.status },
  });
});
