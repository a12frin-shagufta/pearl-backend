import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";

 const addProduct = async (req, res) => {
  try {
    const {
      name, price, category, stock, bestseller,
      description, size, colors , details
    } = req.body;

    const colorArray = JSON.parse(colors); // parse stringified array
    const files = req.files || [];

    if (colorArray.length !== files.length) {
      return res.status(400).json({ success: false, message: "Color count and image count must match." });
    }

    const uploads = await Promise.all(
      files.map(file => cloudinary.uploader.upload(file.path, { resource_type: "image" }))
    );

    const variants = colorArray.map((color, i) => ({
      color,
      images: [uploads[i].secure_url],
    }));

    const newProduct = new productModel({
      name,
      price,
      category,
      stock,
      bestseller: bestseller === "true",
      description,
      details,
      size,
      variants,
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

export { addProduct, listProduct, removeProduct, singleProduct };