import express from "express";
import multer from "multer";
import {
  createManualOrder,
  uploadProof,
  adminUpdatePayment,
  getAllOrders,
} from "../controller/orderController.js";

const orderRouter = express.Router();

// Use memory storage for Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or PDF files are allowed"));
    }
  },
});

orderRouter.post("/place-manual", createManualOrder);
orderRouter.post("/upload-proof", upload.single("proof"), uploadProof);
orderRouter.post("/admin/confirm-payment", adminUpdatePayment);
orderRouter.get("/all", getAllOrders);

export default orderRouter;

// // routes/orderRoute.js
// import express from "express";
// import multer from "multer";
// import path from "path";
// import fs from "fs";
// import {
//   createManualOrder,
//   uploadProof,
//   adminUpdatePayment,
//   getAllOrders,
// } from "../controller/orderController.js";

// const orderRouter = express.Router();

// const uploadDir = path.join(process.cwd(), "uploads");
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadDir),
//   filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
// });
// const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// orderRouter.post("/place-manual", createManualOrder);
// orderRouter.post("/upload-proof", upload.single("proof"), uploadProof);
// orderRouter.post("/admin/confirm-payment", adminUpdatePayment);
// orderRouter.get("/all", getAllOrders);

// export default orderRouter;
