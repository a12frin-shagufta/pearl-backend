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

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.originalname}`);
  },
});

// allow common images including .jpeg
const imageFileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed (jpeg/jpg/png/webp/gif)"));
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25MB, max 10 files
});

/*
  Option B: accept literal field names such as:
   - "images[]" (if frontend uses images[]),
   - "media[]" (if frontend uses media[]),
   - also accept "images" and "media" just in case.

  multer.fields expects an array of { name, maxCount } objects.
  It will populate req.files as an object: { "images[]": [...], "images": [...], ... }
*/
const acceptedFields = [
  { name: "images[]", maxCount: 10 },
  { name: "media[]", maxCount: 10 },
  { name: "images", maxCount: 10 },
  { name: "media", maxCount: 10 },
];

productRouter.post("/add", verifyAdminToken, upload.fields(acceptedFields), addProduct);
productRouter.post("/update", verifyAdminToken, upload.fields(acceptedFields), updateProduct);

productRouter.get("/list", listProduct);
productRouter.post("/single", singleProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);

export default productRouter;
