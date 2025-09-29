import express from "express";
import { addCategory, listCategories, addSubcategory , deleteCategory , deleteSubcategory } from "../controller/categoryController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const categoryRouter = express.Router();

categoryRouter.post("/add", verifyAdminToken, addCategory);
categoryRouter.get("/list", listCategories); // No admin token required for listing categories
categoryRouter.post("/add-subcategory", verifyAdminToken, addSubcategory);
categoryRouter.delete("/:id", verifyAdminToken, deleteCategory);
categoryRouter.post("/delete-subcategory", verifyAdminToken, deleteSubcategory);


export default categoryRouter;