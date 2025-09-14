import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import fs from "fs";

const uploadToCloudinary = async (filePath) => {
  const res = await cloudinary.uploader.upload(filePath, { resource_type: "auto" });
  return res.secure_url;
};

const addProduct = async (req, res) => {
  try {
    // Debugging: show what arrived
    console.log("=== addProduct req.body keys:", Object.keys(req.body || {}));
    console.log("=== addProduct req.files keys:", req.files ? Object.keys(req.files) : "no req.files");

    // If multer.fields was used, req.files is an object:
    // { "images[]": [fileObj,...], "images": [fileObj,...], ... }
    // Collect all uploaded file objects into a single array preserving order by field group
    let files = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        files = req.files; // in case upload.array used elsewhere
      } else {
        // flatten object (order per property may vary — we will pair by index later)
        const fieldNames = Object.keys(req.files);
        fieldNames.forEach((fn) => {
          if (Array.isArray(req.files[fn])) {
            req.files[fn].forEach((f) => files.push(f));
          }
        });
      }
    }

    console.log("=== flattened files count:", files.length);
    console.log(files.map(f => ({ originalname: f.originalname, fieldname: f.fieldname, mimetype: f.mimetype })));

    // parse product fields
    const { name, price, category, subcategory, stock, bestseller, description, size } = req.body;

    // parse colors from req.body.colors (client likely JSON string)
    let colorArray = [];
    if (req.body.colors) {
      try { colorArray = JSON.parse(req.body.colors); }
      catch {
        if (Array.isArray(req.body.colors)) colorArray = req.body.colors;
        else colorArray = [req.body.colors];
      }
    }

    // parse imageColors[] if frontend sent mapping
    let imageColors = [];
    if (req.body["imageColors[]"]) {
      imageColors = Array.isArray(req.body["imageColors[]"]) ? req.body["imageColors[]"] : [req.body["imageColors[]"]];
    } else if (req.body.imageColors) {
      imageColors = Array.isArray(req.body.imageColors) ? req.body.imageColors : [req.body.imageColors];
    }

    // Decide which color mapping to use:
    // Prefer imageColors (explicit mapping), else colorArray, else fallback to unnamed colors by index
    let finalColors = [];
    if (imageColors.length === files.length) finalColors = imageColors;
    else if (colorArray.length === files.length) finalColors = colorArray;
    else {
      // fallback: create placeholder color names
      finalColors = files.map((_, i) => (colorArray[i] || imageColors[i] || `color-${i}`));
      console.warn("Color-file count mismatch; falling back to index-based color names");
    }

    // Upload files to Cloudinary
    const uploads = await Promise.all(files.map(f => uploadToCloudinary(f.path)));

    // cleanup tmp files
    files.forEach(f => {
      try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
    });

    // Build variants pairing uploads with finalColors by index
    const variants = uploads.map((url, i) => ({ color: finalColors[i] || `color-${i}`, images: [url] }));

    // parse details & faqs
    let parsedDetails = [];
    if (req.body.details) {
      try { parsedDetails = JSON.parse(req.body.details); } catch { parsedDetails = Array.isArray(req.body.details) ? req.body.details : [req.body.details]; }
    }
    let parsedFaqs = [];
    if (req.body.faqs) {
      try { parsedFaqs = JSON.parse(req.body.faqs); } catch { parsedFaqs = Array.isArray(req.body.faqs) ? req.body.faqs : []; }
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
    return res.status(201).json({ success: true, message: "Product added successfully." });
  } catch (err) {
    console.error("Error in addProduct:", err);
    return res.status(500).json({ success: false, message: "Server error while adding product." });
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