import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";

// Add new product


// Add new product with color variants and images
const addProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      category,
      stock,
      bestseller,
      details,
      description,
      size,
    } = req.body;

    // Parse colors array (sent as JSON string from frontend)
    const colors = req.body.colors ? JSON.parse(req.body.colors) : [];

    if (!name || !price || !category || !stock || !details || colors.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const images = [
      req.files?.image1?.[0],
      req.files?.image2?.[0],
      req.files?.image3?.[0],
      req.files?.image4?.[0],
    ].filter(Boolean);

    if (colors.length > images.length) {
      return res.status(400).json({ success: false, message: "One image per color is required." });
    }

    // Upload all images to Cloudinary
    const uploadedImages = await Promise.all(
      images.map((file) =>
        cloudinary.uploader.upload(file.path, { resource_type: "image" })
      )
    );

    // Build variant array
    const variants = colors.map((color, index) => ({
      color,
      images: [uploadedImages[index].secure_url],
    }));

    const newProduct = new productModel({
      name,
      price,
      category,
      stock,
      bestseller: bestseller === "true",
      details,
      description: description || undefined,
      size,
      variants,
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Product added successfully with variants.",
    });
  } catch (error) {
    console.error("Error in addProduct:", error);
    res.status(500).json({ success: false, message: "Failed to add product." });
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