// routes/productRouter.js
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
  decrementStock
} from "../controller/productController.js"; // adjust path if necessary
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const productRouter = express.Router();

// Temporary uploads dir
const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage
const storage = multer.diskStorage({ 
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
  // sanitize original name: keep alphanumerics, dot, dash and underscore
  const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeOriginal}`;
  cb(null, name);
},

});

// Accept image OR video mimetypes
// productRouter.js
const mediaFileFilter = (req, file, cb) => {
  console.log(`Received file: ${file.originalname}, fieldname: ${file.fieldname}, mimetype: ${file.mimetype}, size: ${file.size} bytes`);
  if (file && file.mimetype && (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/"))) {
    cb(null, true);
  } else {
    console.error(`Invalid file: ${file.originalname}, mimetype: ${file.mimetype}`);
    cb(new Error(`File "${file.originalname}" is not a valid image or video`), false);
  }
};


const MAX_VARIANTS = 30;
const uploadFields = [
  ...Array.from({ length: MAX_VARIANTS }, (_, i) => ({ name: `variantImage${i}`, maxCount: 1 })),
  ...Array.from({ length: MAX_VARIANTS }, (_, i) => ({ name: `variantVideo${i}`, maxCount: 1 })),
];

const upload = multer({
  storage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file (adjust if needed)
    files: MAX_VARIANTS * 2,
  },
}).fields(uploadFields);

// multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("MulterError:", err);
    return res.status(400).json({ success: false, message: `Multer error: ${err.message}` });
  } else if (err) {
    console.error("Upload error:", err);
    return res.status(400).json({ success: false, message: err.message || "Upload error" });
  }
  next();
};

// optional logger to help debugging
const logFormFields = (req, res, next) => {
  console.log("Incoming product request:", {
    method: req.method,
    url: req.originalUrl,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    filesKeys: req.files ? Object.keys(req.files) : [],
  });
  next();
};

productRouter.post("/add", verifyAdminToken, logFormFields, upload, handleMulterError, addProduct);
productRouter.post("/update", verifyAdminToken, logFormFields, upload, handleMulterError, updateProduct);

productRouter.get("/list", listProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);
productRouter.post("/decrement-stock", verifyAdminToken, decrementStock);


export default productRouter;
