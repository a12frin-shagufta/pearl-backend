// routes/productRoute.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  addProduct, listProduct, removeProduct, singleProduct, updateProduct
} from "../controller/productController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const productRouter = express.Router();

// ensure tmp dir
const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 10
  }
});

// Expect client to send files under key "images[]" (and optionally imageColors[] for mapping)
productRouter.post("/add", verifyAdminToken, upload.fields([{ name: "images[]", maxCount: 10 }]), addProduct);
productRouter.post("/update", verifyAdminToken, upload.fields([{ name: "images[]", maxCount: 10 }]), updateProduct);

productRouter.get("/list", listProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);

export default productRouter;
