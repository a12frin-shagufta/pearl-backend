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

// ensure tmp dir
const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`
    );
  },
});

// ✅ Define the image file filter
const imageFileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg", // covers .jpeg
    "image/jpg",  // covers .jpg
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, webp, gif)"));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 10,
  },
});

// Routes
productRouter.post(
  "/add",
  verifyAdminToken,
  upload.array("images", 10), // expects field name "images"
  addProduct
);

productRouter.post(
  "/update",
  verifyAdminToken,
  upload.array("images", 10),
  updateProduct
);

productRouter.get("/list", listProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);

export default productRouter;
