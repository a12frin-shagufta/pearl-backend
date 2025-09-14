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

// Multer storage (safe filenames)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`);
  },
});

// Accept any image mimetype
const imageFileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error(`File "${file.originalname}" is not a valid image`), false);
  }
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 30, // Max 30 variant images
  },
});

// Only variant images
const uploadFields = Array.from({ length: 30 }, (_, i) => ({ name: `variantImage${i}`, maxCount: 1 }));

productRouter.post("/add", verifyAdminToken, upload.fields(uploadFields), addProduct);
productRouter.post("/update", verifyAdminToken, upload.fields(uploadFields), updateProduct);

productRouter.get("/list", listProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);

export default productRouter;