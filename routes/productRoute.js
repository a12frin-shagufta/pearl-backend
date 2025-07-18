import express from "express";
import multer from "multer";
import {
  addProduct,
  listProduct,
  removeProduct,
  singleProduct,
} from "../controller/productController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const productRouter = express.Router();
const storage = multer.diskStorage({});
const upload = multer({ storage });

// ✅ Route to add a new product
productRouter.post("/add", verifyAdminToken, upload.any(), addProduct);

// ✅ Route to get all products (used on homepage/shop)
productRouter.get("/list", listProduct);

// ✅ Route to get a single product by ID
productRouter.post("/single", singleProduct);

// ✅ Route to delete a product
productRouter.post("/remove", verifyAdminToken, removeProduct);

export default productRouter;
