import categoryModel from "../models/categoryModel.js";

// Add new category
const addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }

    const existingCategory = await categoryModel.findOne({ name: name.toLowerCase() });
    if (existingCategory) {
      return res.status(400).json({ success: false, message: "Category already exists." });
    }

    const newCategory = new categoryModel({ name });
    await newCategory.save();

    res.status(201).json({ success: true, message: "Category added successfully.", category: newCategory });
  } catch (error) {
    console.error("Error in addCategory:", error);
    res.status(500).json({ success: false, message: "Failed to add category." });
  }
};

// Get all categories
const listCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find({});
    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("Error in listCategories:", error);
    res.status(500).json({ success: false, message: "Failed to fetch categories." });
  }
};

export { addCategory, listCategories };