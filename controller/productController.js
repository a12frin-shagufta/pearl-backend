// controllers/productController.js
import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import fs from "fs";
import mongoose from "mongoose";

/**
 * Upload helper to Cloudinary with retries.
 * Accepts any resource type; for videos we explicitly pass resource_type: 'video' when calling if desired.
 */
const uploadToCloudinary = async (filePath, originalName, resourceType = "auto", retries = 3, delay = 1000) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const options = {
        resource_type: resourceType,
        transformation: [
          // For images this will resize if large; for videos Cloudinary ignores transform ops that don't apply.
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      };
      // For large video uploads you may want chunk_size & eager transformations; omitted for brevity
      const res = await cloudinary.uploader.upload(filePath, options);
      return res.secure_url;
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

/**
 * Helper: safe unlink
 */
const safeUnlink = (path) => {
  try {
    if (fs.existsSync(path)) fs.unlinkSync(path);
  } catch (e) {
    console.warn("Failed to delete temp file", path, e.message);
  }
};

/**
 * Parse array-like fields from multipart/form-data (strings may be JSON or single value)
 */
const parseMaybeJsonArray = (value) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return [value];
};

/**
 * Add Product
 * Expects:
 *  - req.body.colors  -> JSON string or array of color names (length N)
 *  - For each i in [0..N-1]:
 *      - file field 'variantImage{i}' (required) - image file
 *      - file field 'variantVideo{i}' (optional) - video file
 */
const addProduct = async (req, res) => {
  try {
    // Basic fields
    const { name, price, category, subcategory, stock, bestseller, description, size } = req.body;

    if (!name || !price || !category || !stock) {
      return res.status(400).json({ success: false, message: "Required fields missing (name, price, category, stock)." });
    }

    // parse colors array
    let colorArray = parseMaybeJsonArray(req.body.colors);
    colorArray = colorArray.map((c) => String(c).trim()).filter(Boolean);

    if (!colorArray.length) {
      return res.status(400).json({ success: false, message: "At least one color variant is required (colors)." });
    }

    // Collect files for each color
    const variantImageEntries = []; // index -> file
    const variantVideoEntries = []; // index -> file (optional)

    for (let i = 0; i < colorArray.length; i++) {
      const imgKey = `variantImage${i}`;
      const vidKey = `variantVideo${i}`;

      // image required
      if (!req.files || !req.files[imgKey] || !req.files[imgKey][0]) {
        return res.status(400).json({ success: false, message: `Missing image for color "${colorArray[i]}" (field ${imgKey}).` });
      }
      const imgFile = req.files[imgKey][0];
      if (!imgFile.mimetype || !imgFile.mimetype.startsWith("image/")) {
        return res.status(400).json({ success: false, message: `File ${imgFile.originalname} is not a valid image.` });
      }
      variantImageEntries.push({ file: imgFile, index: i });

      // optional video
      if (req.files && req.files[vidKey] && req.files[vidKey][0]) {
        const vidFile = req.files[vidKey][0];
        if (!vidFile.mimetype || !vidFile.mimetype.startsWith("video/")) {
          return res.status(400).json({ success: false, message: `File ${vidFile.originalname} is not a valid video.` });
        }
        variantVideoEntries.push({ file: vidFile, index: i });
      }
    }

    // Upload images (parallel)
    const uploadedImageUrls = await Promise.all(
      variantImageEntries.map((entry) => uploadToCloudinary(entry.file.path, entry.file.originalname, "image"))
    );

    // Upload videos (parallel) - if none, this step is skipped
    const uploadedVideoUrlsForIndex = {}; // map index -> [urls]
    if (variantVideoEntries.length > 0) {
      const uploadedVideos = await Promise.all(
        variantVideoEntries.map((entry) =>
          // Pass explicit resource_type 'video' — Cloudinary will handle encoding
          cloudinary.uploader.upload(entry.file.path, { resource_type: "video" }).then((r) => r.secure_url)
        )
      );
      variantVideoEntries.forEach((entry, idx) => {
        uploadedVideoUrlsForIndex[entry.index] = uploadedVideoUrlsForIndex[entry.index] || [];
        uploadedVideoUrlsForIndex[entry.index].push(uploadedVideos[idx]);
      });
    }

    // Cleanup temp files
    [...variantImageEntries, ...variantVideoEntries].forEach(({ file }) => safeUnlink(file.path));

    // Build variants array
    const variants = colorArray.map((color, i) => {
      // find image URL that corresponds to index i
      const imgEntryIndex = variantImageEntries.findIndex((v) => v.index === i);
      const imageUrl = imgEntryIndex !== -1 ? uploadedImageUrls[imgEntryIndex] : null;
      const videos = uploadedVideoUrlsForIndex[i] || [];
      return {
        color: String(color).trim(),
        images: imageUrl ? [imageUrl] : [],
        videos,
      };
    });

    // parse details/faqs if provided
    const parsedDetails = parseMaybeJsonArray(req.body.details);
    const parsedFaqs = parseMaybeJsonArray(req.body.faqs);

    // Normalize category/subcategory
    const normalizedCategory = (category || "").toString().trim().toLowerCase();
    const normalizedSubcategory = (subcategory || "").toString().trim().toLowerCase();

    // Create product doc
    const newProduct = new productModel({
      name,
      price: Number(price),
      category: normalizedCategory,
      subcategory: normalizedSubcategory,
      stock: Number(stock),
      bestseller: bestseller === "true" || bestseller === true,
      description,
      details: parsedDetails,
      size,
      variants,
      faqs: parsedFaqs,
    });

    await newProduct.save();

    return res.status(201).json({ success: true, message: "Product added successfully.", product: newProduct });
  } catch (err) {
    console.error("addProduct error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error while adding product." });
  }
};

/**
 * Update product
 * Behavior:
 *  - Expects 'id' in body.
 *  - Accepts colors (parsedColors) to replace variants (or you can change to smarter merge).
 *  - Accepts variantImage{i} and variantVideo{i} for those indexes.
 *  - If a new image/video provided for index i, it will replace that variant's media (current code replaces whole variants if colors passed).
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Valid product ID is required." });
    }

    const existing = await productModel.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found." });

    // Parse fields (similar parsing helpers)
    const parsedDetails = parseMaybeJsonArray(req.body.details);
    const parsedFaqs = parseMaybeJsonArray(req.body.faqs);

    // Parse colors (if provided, we will rebuild variants from provided files)
    let parsedColors = parseMaybeJsonArray(req.body.colors).map((c) => String(c).trim()).filter(Boolean);

    let variants;
    if (parsedColors.length > 0) {
      // Similar logic to addProduct: collect image/video files per index
      const variantImageEntries = [];
      const variantVideoEntries = [];

      for (let i = 0; i < parsedColors.length; i++) {
        const imgKey = `variantImage${i}`;
        const vidKey = `variantVideo${i}`;

        if (!req.files || !req.files[imgKey] || !req.files[imgKey][0]) {
          return res.status(400).json({ success: false, message: `Missing image for color "${parsedColors[i]}" (field ${imgKey}).` });
        }
        const imgFile = req.files[imgKey][0];
        if (!imgFile.mimetype || !imgFile.mimetype.startsWith("image/")) {
          return res.status(400).json({ success: false, message: `File ${imgFile.originalname} is not a valid image.` });
        }
        variantImageEntries.push({ file: imgFile, index: i });

        if (req.files && req.files[vidKey] && req.files[vidKey][0]) {
          const vidFile = req.files[vidKey][0];
          if (!vidFile.mimetype || !vidFile.mimetype.startsWith("video/")) {
            return res.status(400).json({ success: false, message: `File ${vidFile.originalname} is not a valid video.` });
          }
          variantVideoEntries.push({ file: vidFile, index: i });
        }
      }

      // Upload images
      const uploadedImageUrls = await Promise.all(
        variantImageEntries.map((entry) => uploadToCloudinary(entry.file.path, entry.file.originalname, "image"))
      );

      // Upload videos
      const uploadedVideoUrlsForIndex = {};
      if (variantVideoEntries.length > 0) {
        const uploadedVideos = await Promise.all(
          variantVideoEntries.map((entry) =>
            cloudinary.uploader.upload(entry.file.path, { resource_type: "video" }).then((r) => r.secure_url)
          )
        );
        variantVideoEntries.forEach((entry, idx) => {
          uploadedVideoUrlsForIndex[entry.index] = uploadedVideoUrlsForIndex[entry.index] || [];
          uploadedVideoUrlsForIndex[entry.index].push(uploadedVideos[idx]);
        });
      }

      // Cleanup temp files
      [...variantImageEntries, ...variantVideoEntries].forEach(({ file }) => safeUnlink(file.path));

      variants = parsedColors.map((color, i) => {
        const imgEntryIndex = variantImageEntries.findIndex((v) => v.index === i);
        const imageUrl = imgEntryIndex !== -1 ? uploadedImageUrls[imgEntryIndex] : null;
        const videos = uploadedVideoUrlsForIndex[i] || [];
        return {
          color,
          images: imageUrl ? [imageUrl] : [],
          videos,
        };
      });
    }

    // Build update object
    const updateData = {
      name: req.body.name,
      price: req.body.price ? Number(req.body.price) : existing.price,
      category: req.body.category ? String(req.body.category).trim().toLowerCase() : existing.category,
      subcategory: req.body.subcategory ? String(req.body.subcategory).trim().toLowerCase() : existing.subcategory,
      stock: req.body.stock ? Number(req.body.stock) : existing.stock,
      bestseller: req.body.bestseller === "true" || req.body.bestseller === true ? true : existing.bestseller,
      description: req.body.description ?? existing.description,
      details: parsedDetails.length ? parsedDetails : existing.details,
      faqs: parsedFaqs.length ? parsedFaqs : existing.faqs,
    };

    if (variants) updateData.variants = variants;
    if (req.body.size !== undefined) updateData.size = req.body.size;

    const updated = await productModel.findByIdAndUpdate(id, updateData, { new: true });

    return res.status(200).json({ success: true, message: "Product updated successfully", product: updated });
  } catch (err) {
    console.error("updateProduct error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update product" });
  }
};

const listProduct = async (req, res) => {
  try {
    // Optionally you may want to populate or project specific fields — here we return everything
    const products = await productModel.find({});
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error("listProduct error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products." });
  }
};

const removeProduct = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "Product ID is required." });

    const product = await productModel.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    await productModel.findByIdAndDelete(id);
    // Consider removing associated Cloudinary assets if you want to free storage (not implemented here).
    return res.status(200).json({ success: true, message: "Product removed successfully." });
  } catch (error) {
    console.error("removeProduct error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete product." });
  }
};

const singleProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: "Product ID is required." });

    const product = await productModel.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("singleProduct error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product." });
  }
};

export { addProduct, updateProduct, listProduct, removeProduct, singleProduct };

// import { v2 as cloudinary } from "cloudinary";
// import productModel from "../models/productModel.js";
// import fs from "fs";

// const uploadToCloudinary = async (filePath) => {
//   // resource_type: "auto" is safe (images + other media)
//   const res = await cloudinary.uploader.upload(filePath, { resource_type: "auto" });
//   return res.secure_url;
// };

// const addProduct = async (req, res) => {
//   try {
//     console.log("=== addProduct req.body keys:", Object.keys(req.body || {}));
//     console.log("=== addProduct req.files keys:", req.files ? Object.keys(req.files) : "no req.files");

//     // --- 1) Collect general gallery images (image1..image4) deterministically ---
//     const otherImagesFiles = [];
//     for (let i = 1; i <= 4; i++) {
//       const key = `image${i}`;
//       if (req.files && req.files[key] && req.files[key][0]) {
//         otherImagesFiles.push(req.files[key][0]);
//       }
//     }

//     // --- 2) Collect variant images in deterministic order variantImage0..variantImage29 ---
//     const variantFiles = [];
//     const maxVariants = 30; // same as route uploadFields
//     for (let i = 0; i < maxVariants; i++) {
//       const key = `variantImage${i}`;
//       if (req.files && req.files[key] && req.files[key][0]) {
//         variantFiles.push({ index: i, file: req.files[key][0] });
//       }
//     }

//     // --- 3) Also include any compatibility arrays (images[] / images / media...) AFTER deterministic ones ---
//     ["images[]", "images", "media[]", "media"].forEach((k) => {
//       if (req.files && req.files[k]) {
//         req.files[k].forEach((f) => {
//           // treat them as variant-like images appended after the above
//           variantFiles.push({ index: variantFiles.length, file: f });
//         });
//       }
//     });

//     console.log("otherImagesFiles count:", otherImagesFiles.length);
//     console.log("variantFiles count:", variantFiles.length);

//     // --- 4) Upload gallery images to Cloudinary (if any) ---
//     let galleryUrls = [];
//     if (otherImagesFiles.length > 0) {
//       const uploadedOther = await Promise.all(
//         otherImagesFiles.map((f) => uploadToCloudinary(f.path))
//       );
//       galleryUrls = uploadedOther;
//     }

//     // --- 5) Parse colors / imageColors mapping from req.body ---
//     let colorArray = [];
//     if (req.body.colors) {
//       try { colorArray = JSON.parse(req.body.colors); }
//       catch {
//         colorArray = Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors];
//       }
//     }

//     let imageColors = [];
//     if (req.body["imageColors[]"]) {
//       imageColors = Array.isArray(req.body["imageColors[]"]) ? req.body["imageColors[]"] : [req.body["imageColors[]"]];
//     } else if (req.body.imageColors) {
//       imageColors = Array.isArray(req.body.imageColors) ? req.body.imageColors : [req.body.imageColors];
//     }

//     // --- 6) Upload variant images to Cloudinary and build variants array ---
//     const uploadedVariantUrls = await Promise.all(variantFiles.map(v => uploadToCloudinary(v.file.path)));

//     // cleanup temp files for both gallery + variant files
//     [...otherImagesFiles, ...variantFiles.map(v => v.file)].forEach(f => {
//       try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
//     });

//     // Decide final colors mapping for variants:
//     // Prefer explicit imageColors (if equal length), else prefer colorArray (if equal), else fallback by index
//     let finalColors = [];
//     if (imageColors.length === uploadedVariantUrls.length) finalColors = imageColors;
//     else if (colorArray.length === uploadedVariantUrls.length) finalColors = colorArray;
//     else finalColors = uploadedVariantUrls.map((_, i) => (colorArray[i] || imageColors[i] || `color-${i}`));

//     const variants = uploadedVariantUrls.map((url, i) => ({
//       color: finalColors[i] || `color-${i}`,
//       images: [url],
//     }));

//     // --- 7) parse other fields & arrays (details/faqs) ---
//     let parsedDetails = [];
//     if (req.body.details) {
//       try { parsedDetails = JSON.parse(req.body.details); }
//       catch { parsedDetails = Array.isArray(req.body.details) ? req.body.details : [req.body.details]; }
//     }

//     let parsedFaqs = [];
//     if (req.body.faqs) {
//       try { parsedFaqs = JSON.parse(req.body.faqs); }
//       catch { parsedFaqs = Array.isArray(req.body.faqs) ? req.body.faqs : []; }
//     }

//     // --- 8) Create and save product (include galleryUrls as image array) ---
//     const {
//       name, price, category, subcategory, stock, bestseller, description, size
//     } = req.body;

//     const newProduct = new productModel({
//       name,
//       price,
//       category,
//       subcategory,
//       stock,
//       bestseller: bestseller === "true" || bestseller === true,
//       description,
//       details: parsedDetails,
//       size,
//       variants,
//       faqs: parsedFaqs,
//       // Save gallery images here:
//       image: galleryUrls,
//     });

//     await newProduct.save();
//     return res.status(201).json({ success: true, message: "Product added successfully." });
//   } catch (err) {
//     console.error("Error in addProduct:", err);
//     return res.status(500).json({ success: false, message: "Server error while adding product." });
//   }
// };

// // Get all products
// const listProduct = async (req, res) => {
//   try {
//     const products = await productModel.find({});
//     res.status(200).json({ success: true, products });
//   } catch (error) {
//     console.error("Error in listProduct:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch products." });
//   }
// };

// // Delete product
// const removeProduct = async (req, res) => {
//   try {
//     const { id } = req.body;
//     if (!id) return res.status(400).json({ success: false, message: "Product ID is required." });

//     await productModel.findByIdAndDelete(id);
//     res.status(200).json({ success: true, message: "Product removed successfully." });

//   } catch (error) {
//     console.error("Error in removeProduct:", error);
//     res.status(500).json({ success: false, message: "Failed to delete product." });
//   }
// };

// // Get single product
// const singleProduct = async (req, res) => {
//   try {
//     const { productId } = req.body;
//     if (!productId) return res.status(400).json({ success: false, message: "Product ID is required." });

//     const product = await productModel.findById(productId);
//     if (!product) return res.status(404).json({ success: false, message: "Product not found." });

//     res.status(200).json({ success: true, product });

//   } catch (error) {
//     console.error("Error in singleProduct:", error);
//     res.status(500).json({ success: false, message: "Failed to fetch product." });
//   }
// };
// const updateProduct = async (req, res) => {
//   try {
//     const { id, name, price, category, subcategory, stock, bestseller, description, details, faqs } = req.body;

//     if (!id) return res.status(400).json({ success: false, message: "Product ID required" });

//     // ✅ Parse details
//     let parsedDetails = [];
//     if (typeof details === "string") {
//       try {
//         parsedDetails = JSON.parse(details);
//       } catch {
//         parsedDetails = details ? [details] : [];
//       }
//     } else if (Array.isArray(details)) {
//       parsedDetails = details;
//     }

//     // ✅ Parse faqs
//     let parsedFaqs = [];
//     if (typeof faqs === "string") {
//       try {
//         parsedFaqs = JSON.parse(faqs);
//       } catch {
//         parsedFaqs = [];
//       }
//     } else if (Array.isArray(faqs)) {
//       parsedFaqs = faqs;
//     }

//     const updatedProduct = await productModel.findByIdAndUpdate(
//       id,
//       {
//         name,
//         price,
//         category,
//         subcategory,
//         stock,
//         bestseller,
//         description,
//         details: parsedDetails,
//         faqs: parsedFaqs,
//       },
//       { new: true }
//     );

//     if (!updatedProduct) {
//       return res.status(404).json({ success: false, message: "Product not found" });
//     }

//     res.status(200).json({ success: true, message: "Product updated successfully", product: updatedProduct });
//   } catch (error) {
//     console.error("Error in updateProduct:", error);
//     res.status(500).json({ success: false, message: "Failed to update product" });
//   }
// };




// export { addProduct, listProduct, removeProduct, singleProduct, updateProduct };