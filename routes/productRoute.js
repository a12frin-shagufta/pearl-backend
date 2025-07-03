import express from "express";
import multer from "multer";
import { addProduct, listProduct, removeProduct, singleProduct } from "../controller/productController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

// ✅ Setup multer with diskStorage for valid file paths
const storage = multer.diskStorage({});
const upload = multer({ storage });

const productRouter = express.Router();

const uploadFields = upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 },
]);

// Routes
productRouter.post("/add", verifyAdminToken, uploadFields, addProduct);
productRouter.get("/list", listProduct);
productRouter.post("/remove", verifyAdminToken, removeProduct);
productRouter.post("/single", singleProduct);

export default productRouter;
