import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import ApiError from "../utils/ApiError.js";

const useCloudinary = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const UPLOAD_DIR = path.resolve("uploads");
if (!useCloudinary && !fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
    });

function fileFilter(req, file, cb) {
  const allowed = /jpeg|jpg|png|webp|pdf/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(ApiError.badRequest("Only JPEG, PNG, WEBP or PDF files are allowed"));
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Normalises a multer file into { url, publicId } regardless of backend.
export async function persistFile(file, folder = "nairobi-estate") {
  if (!file) return null;
  if (useCloudinary) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, (err, res) =>
        err ? reject(err) : resolve(res)
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }
  return { url: `/uploads/${file.filename}`, publicId: file.filename };
}

export async function destroyFile(publicId) {
  if (!publicId) return;
  if (useCloudinary) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
    return;
  }
  const filePath = path.join(UPLOAD_DIR, publicId);
  fs.promises.unlink(filePath).catch(() => {});
}

export { useCloudinary };
