import express from "express";
import multer from "multer";
import { addProduct } from "../controller/productController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const router = express.Router();
const storage = multer.diskStorage({});
const upload = multer({ storage });

router.post("/add", verifyAdminToken, upload.any(), addProduct);

export default router;
