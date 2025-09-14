import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import fs from "fs";

const uploadToCloudinary = async (filePath) => {
  const res = await cloudinary.uploader.upload(filePath, { resource_type: "image" });
  return res.secure_url;
};

const addProduct = async (req, res) => {
  try {
    const {
      name, price, category, subcategory, stock, bestseller,
      description, size, colors, details, faqs
    } = req.body;

    // parse color array (client should send JSON string)
    let colorArray = [];
    try { colorArray = JSON.parse(colors || "[]"); } catch { colorArray = colors ? [colors] : []; }

    // collect files from req.files (multer.fields returns object)
    let files = [];
    if (req.files) {
      if (Array.isArray(req.files)) files = req.files;
      else files = Object.values(req.files).flat();
    }

    if (colorArray.length !== files.length) {
      return res.status(400).json({ success: false, message: "Color count and image count must match." });
    }

    // upload files to cloudinary
    const uploads = await Promise.all(files.map(f => uploadToCloudinary(f.path)));

    // optionally delete temp files
    files.forEach(f => {
      try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
    });

    const variants = colorArray.map((color, i) => ({
      color,
      images: [uploads[i]]
    }));

    // parse details & faqs robustly
    let parsedDetails = [];
    if (details) {
      try { parsedDetails = JSON.parse(details); } catch { parsedDetails = Array.isArray(details) ? details : [details]; }
    }

    let parsedFaqs = [];
    if (faqs) {
      try { parsedFaqs = JSON.parse(faqs); } catch { parsedFaqs = Array.isArray(faqs) ? faqs : []; }
    }

    const newProduct = new productModel({
      name,
      price,
      category,
      subcategory,
      stock,
      bestseller: bestseller === "true" || bestseller === true,
      description,
      details: parsedDetails,
      size,
      variants,
      faqs: parsedFaqs
    });

    await newProduct.save();
    res.status(201).json({ success: true, message: "Product added successfully." });
  } catch (err) {
    console.error("Error in addProduct:", err);
    res.status(500).json({ success: false, message: "Server error while adding product." });
  }
};





// Get all products
const listProduct = async (req, res) => {
  try {
    const products = await productModel.find({});
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error("Error in listProduct:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products." });
  }
};

// Delete product
const removeProduct = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "Product ID is required." });

    await productModel.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Product removed successfully." });

  } catch (error) {
    console.error("Error in removeProduct:", error);
    res.status(500).json({ success: false, message: "Failed to delete product." });
  }
};

// Get single product
const singleProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "Product ID is required." });

    const product = await productModel.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    res.status(200).json({ success: true, product });

  } catch (error) {
    console.error("Error in singleProduct:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product." });
  }
};
const updateProduct = async (req, res) => {
  try {
    const { id, name, price, category, subcategory, stock, bestseller, description, details, faqs } = req.body;

    if (!id) return res.status(400).json({ success: false, message: "Product ID required" });

    // ✅ Parse details
    let parsedDetails = [];
    if (typeof details === "string") {
      try {
        parsedDetails = JSON.parse(details);
      } catch {
        parsedDetails = details ? [details] : [];
      }
    } else if (Array.isArray(details)) {
      parsedDetails = details;
    }

    // ✅ Parse faqs
    let parsedFaqs = [];
    if (typeof faqs === "string") {
      try {
        parsedFaqs = JSON.parse(faqs);
      } catch {
        parsedFaqs = [];
      }
    } else if (Array.isArray(faqs)) {
      parsedFaqs = faqs;
    }

    const updatedProduct = await productModel.findByIdAndUpdate(
      id,
      {
        name,
        price,
        category,
        subcategory,
        stock,
        bestseller,
        description,
        details: parsedDetails,
        faqs: parsedFaqs,
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("Error in updateProduct:", error);
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
};




export { addProduct, listProduct, removeProduct, singleProduct, updateProduct };