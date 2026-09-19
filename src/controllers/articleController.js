import Article from "../models/Article.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildPagination, paginatedResponse } from "../utils/apiFeatures.js";
import { persistFile } from "../middleware/upload.js";
import { ARTICLE_STATUS } from "../config/constants.js";

// GET /api/articles  (public — published only)
export const listArticles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query, 12);
  const filter = { status: ARTICLE_STATUS.PUBLISHED };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [items, total] = await Promise.all([
    Article.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).select("-body").lean(),
    Article.countDocuments(filter),
  ]);
  res.json(paginatedResponse({ items, total, page, limit }));
});

// GET /api/articles/categories
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Article.distinct("category", { status: ARTICLE_STATUS.PUBLISHED });
  res.json({ success: true, data: categories });
});

// GET /api/articles/:slug  (public)
export const getArticle = asyncHandler(async (req, res) => {
  const article = await Article.findOne({ slug: req.params.slug });
  if (!article) throw ApiError.notFound("Article not found");
  if (article.status !== ARTICLE_STATUS.PUBLISHED && req.user?.role !== "admin") {
    throw ApiError.notFound("Article not found");
  }
  await Article.updateOne({ _id: article._id }, { $inc: { reads: 1 } });

  const related = await Article.find({
    _id: { $ne: article._id },
    status: ARTICLE_STATUS.PUBLISHED,
    category: article.category,
  }).limit(3).select("title slug category icon coverImage").lean();

  res.json({ success: true, data: article, related });
});

// ---- Admin CMS ----

// GET /api/articles/admin/all
export const adminListArticles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query, 20);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Article.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-body").lean(),
    Article.countDocuments(filter),
  ]);
  res.json(paginatedResponse({ items, total, page, limit }));
});

// POST /api/articles
export const createArticle = asyncHandler(async (req, res) => {
  const article = await Article.create({
    ...req.body,
    author: req.user._id,
    authorName: req.body.authorName || req.user.fullName,
    authorRole: req.body.authorRole || "Nairobi Estate Team",
  });
  res.status(201).json({ success: true, data: article });
});

// PATCH /api/articles/:id
export const updateArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) throw ApiError.notFound("Article not found");
  Object.assign(article, req.body);
  await article.save();
  res.json({ success: true, data: article });
});

// DELETE /api/articles/:id
export const deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) throw ApiError.notFound("Article not found");
  res.json({ success: true, message: "Article deleted" });
});

// POST /api/articles/:id/cover
export const uploadCover = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) throw ApiError.notFound("Article not found");
  if (!req.file) throw ApiError.badRequest("No image was uploaded");
  const saved = await persistFile(req.file, "nairobi-estate/articles");
  article.coverImage = { ...saved, alt: req.body.alt || article.title };
  await article.save();
  res.json({ success: true, data: article.coverImage });
});

// POST /api/articles/:slug/download  — track guide downloads
export const trackDownload = asyncHandler(async (req, res) => {
  await Article.updateOne({ slug: req.params.slug }, { $inc: { downloads: 1 } });
  res.json({ success: true });
});
