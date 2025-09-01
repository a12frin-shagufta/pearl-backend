import express from "express";
import { addCategory, listCategories, addSubcategory } from "../controller/categoryController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const categoryRouter = express.Router();

categoryRouter.post("/add", verifyAdminToken, addCategory);
categoryRouter.get("/list", listCategories); // No admin token required for listing categories
categoryRouter.post("/add-subcategory", verifyAdminToken, addSubcategory);

export default categoryRouter;