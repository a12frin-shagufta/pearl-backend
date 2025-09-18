// routes/orderRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  createManualOrder,
  uploadProof,
  adminUpdatePayment,
  getAllOrders,
} from "../controller/orderController.js";

const orderRouter = express.Router();

// local uploads (for prod move to S3/Cloudinary)
const uploadDir = path.join(process.cwd(), "uploads"); // safer for ESM
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public endpoints
orderRouter.post("/place-manual", createManualOrder);
orderRouter.post("/upload-proof", upload.single("proof"), uploadProof);

// Admin endpoints (protect these with your admin middleware)
orderRouter.post("/admin/confirm-payment", /* adminAuthMiddleware, */ adminUpdatePayment);
orderRouter.get("/all", /* adminAuthMiddleware, */ getAllOrders);

export default orderRouter;
