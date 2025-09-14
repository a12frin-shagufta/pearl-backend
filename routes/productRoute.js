// routes/productRoute.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  addProduct,
  listProduct,
  removeProduct,
  singleProduct,
  updateProduct,
} from "../controller/productController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const productRouter = express.Router();

// tmp upload dir
const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer storage (safe filenames)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // keep original extension but prefix with timestamp/random
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`);
  },
});

// ✅ Accept any image mimetype (jpg, jpeg, png, webp, gif, svg, bmp, tiff, etc.)
const imageFileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file (increase if needed)
    files: 60, // overall file count limit (adjust to suit)
  },
});

// Build fields array: image1..image4 + variantImage0..variantImage29 + compatibility names
const variantFields = Array.from({ length: 30 }, (_, i) => ({ name: `variantImage${i}`, maxCount: 1 }));
const uploadFields = [
  { name: "image1", maxCount: 1 },
  { name: "image2", maxCount: 1 },
  { name: "image3", maxCount: 1 },
  { name: "image4", maxCount: 1 },
  ...variantFields,
  // optional compatibility: if some clients send images[] or media[]
  { name: "images[]", maxCount: 30 },
  { name: "images", maxCount: 30 },
  { name: "media[]", maxCount: 30 },
  { name: "media", maxCount: 30 },
];

productRouter.post("/add", verifyAdminToken, upload.fields(uploadFields), addProduct);
productRouter.post("/update", verifyAdminToken, upload.fields(uploadFields), updateProduct);

productRouter.get("/list", listProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);

export default productRouter;
