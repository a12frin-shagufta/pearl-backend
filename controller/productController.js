// controllers/productController.js
import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import fs from "fs";
import mongoose from "mongoose";

/**
 * Upload helper to Cloudinary with retries.
 * Accepts any resource type; for videos we explicitly pass resource_type: 'video' when calling if desired.
 */
// controllers/productController.js

// controllers/productController.js
const uploadToCloudinary = async (filePath, originalName, resourceType = "auto", retries = 3, delay = 1000) => {
  const ext = originalName?.split(".").pop()?.toLowerCase() || "";
  const supportedImageExts = ["jpg", "jpeg", "png", "webp", "gif", "heic", "bmp", "tiff"];

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let options;

      if (resourceType === "video") {
        options = { resource_type: "video" };
      } else if (supportedImageExts.includes(ext)) {
        // ✅ All image formats handled here
        options = {
          resource_type: "image",
          format: ext, // use same format as original
          transformation: [
            { width: 1200, height: 1200, crop: "limit" },
            { quality: "auto", fetch_format: "auto" }, // Cloudinary will auto-optimize output
          ],
        };
      } else {
        // fallback for unknown types (Cloudinary detects automatically)
        options = {
          resource_type: "auto",
          transformation: [{ quality: "auto" }],
        };
      }

      const res = await cloudinary.uploader.upload(filePath, options);
      console.log(`✅ Uploaded ${originalName} (${ext}) to Cloudinary`);
      return res.secure_url;
    } catch (err) {
      console.error(`❌ Cloudinary upload failed for ${originalName} (attempt ${attempt + 1}): ${err.message}`);
      if (attempt === retries - 1) throw err;
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
 * Helper: read per-variant stocks from either:
 *  - fields variantStock0, variantStock1, ...
 *  - or a JSON array field 'variantStocks'
 * Returns array of numbers (may be shorter than colorArray)
 */
const readVariantStocks = (req, colorArrayLength) => {
  // attempt variantStocks JSON first
  const variantStocksFromJson = req.body.variantStocks ? parseMaybeJsonArray(req.body.variantStocks) : null;
  const stocks = new Array(colorArrayLength).fill(undefined);

  if (variantStocksFromJson && variantStocksFromJson.length > 0) {
    for (let i = 0; i < Math.min(colorArrayLength, variantStocksFromJson.length); i++) {
      const s = variantStocksFromJson[i];
      const n = Number(s);
      stocks[i] = Number.isFinite(n) ? Math.max(0, n) : undefined;
    }
    return stocks;
  }

  // fall back to individual fields
  for (let i = 0; i < colorArrayLength; i++) {
    const key = `variantStock${i}`;
    if (req.body[key] !== undefined) {
      const n = Number(req.body[key]);
      stocks[i] = Number.isFinite(n) ? Math.max(0, n) : undefined;
    }
  }

  return stocks;
};

/**
 * Add Product
 * Expects:
 *  - req.body.colors  -> JSON string or array of color names (length N)
 *  - Optionally: variantStock0, variantStock1, ... OR variantStocks (JSON array)
 *  - For each i in [0..N-1]:
 *      - file field 'variantImage{i}' (required) - image file
 *      - file field 'variantVideo{i}' (optional) - video file
 */
const addProduct = async (req, res) => {
  try {
    const { name, price, category, subcategory, stock, bestseller, description, size, difficulty } = req.body;

    if (!name || !price || !category || stock === undefined) {
      return res.status(400).json({ success: false, message: "Required fields missing (name, price, category, stock)." });
    }

    let colorArray = parseMaybeJsonArray(req.body.colors).map((c) => String(c).trim()).filter(Boolean);
    if (!colorArray.length) {
      return res.status(400).json({ success: false, message: "At least one color variant is required (colors)." });
    }

    const variantStocks = readVariantStocks(req, colorArray.length);

   // inside addProduct, after you build colorArray etc.

const variantImageEntries = [];
const variantVideoEntries = [];

for (let i = 0; i < colorArray.length; i++) {
  const imgKey = `variantImage${i}`;
  const vidKey = `variantVideo${i}`;

  if (req.files?.[imgKey]?.[0]) variantImageEntries.push({ file: req.files[imgKey][0], index: i });
  if (req.files?.[vidKey]?.[0]) variantVideoEntries.push({ file: req.files[vidKey][0], index: i });

  // ✅ validate at least one media exists for this index
  if (!req.files?.[imgKey]?.[0] && !req.files?.[vidKey]?.[0]) {
    return res.status(400).json({
      success: false,
      message: `Provide an image or a video for color "${colorArray[i]}" (fields ${imgKey} or ${vidKey}).`,
    });
  }
}

// Upload what we actually have
const uploadedImageUrlsForIndex = {};
if (variantImageEntries.length) {
  const uploaded = await Promise.all(
    variantImageEntries.map((entry) =>
      uploadToCloudinary(entry.file.path, entry.file.originalname, "image")
    )
  );
  variantImageEntries.forEach((entry, idx) => {
    uploadedImageUrlsForIndex[entry.index] = [uploaded[idx]];
  });
}

const uploadedVideoUrlsForIndex = {};
if (variantVideoEntries.length) {
  const uploaded = await Promise.all(
    variantVideoEntries.map((entry) =>
      uploadToCloudinary(entry.file.path, entry.file.originalname, "video")
    )
  );
  variantVideoEntries.forEach((entry, idx) => {
    uploadedVideoUrlsForIndex[entry.index] = [uploaded[idx]];
  });
}

// cleanup temps
[...variantImageEntries, ...variantVideoEntries].forEach(({ file }) => safeUnlink(file.path));

const globalStockNumber = Number(stock) || 0;

const variants = colorArray.map((color, i) => ({
  color: String(color).trim(),
  images: uploadedImageUrlsForIndex[i] || [],  // ✅ can be empty
  videos: uploadedVideoUrlsForIndex[i] || [],  // ✅ can be only video
  stock: typeof variantStocks[i] === "number" ? variantStocks[i] : globalStockNumber,
}));


    const parsedDetails = parseMaybeJsonArray(req.body.details);
    const parsedFaqs = parseMaybeJsonArray(req.body.faqs);

    const newProduct = new productModel({
      name,
      price: Number(price),
      category: (category || "").trim().toLowerCase(),
      subcategory: (subcategory || "").trim().toLowerCase(),
      stock: globalStockNumber,
      bestseller: bestseller === "true" || bestseller === true,
      description,
      details: parsedDetails,
      size,
      variants,
      faqs: parsedFaqs,
       difficulty: (difficulty || "easy").toLowerCase(),
    });

    await newProduct.save();
    return res.status(201).json({ success: true, message: "Product added successfully.", product: newProduct });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Server error while adding product." });
  }
};

/**
 * Update product
 * Behavior:
 *  - Expects 'id' in body.
 *  - Accepts colors (parsedColors) to replace variants (or you can change to smarter merge).
 *  - Accepts variantImage{i} and variantVideo{i} for those indexes.
 *  - Accepts per-variant stock via variantStock{i} fields or variantStocks JSON array.
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Valid product ID is required." });
    }

    const existing = await productModel.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Product not found." });

    const parsedDetails = parseMaybeJsonArray(req.body.details);
    const parsedFaqs = parseMaybeJsonArray(req.body.faqs);
    let parsedColors = parseMaybeJsonArray(req.body.colors).map((c) => String(c).trim()).filter(Boolean);

    let variants;
    if (parsedColors.length > 0) {
      const variantStocks = readVariantStocks(req, parsedColors.length);

      const variantImageEntries = [];
      const variantVideoEntries = [];

      for (let i = 0; i < parsedColors.length; i++) {
        const imgKey = `variantImage${i}`;
        const vidKey = `variantVideo${i}`;

        if (req.files && req.files[imgKey] && req.files[imgKey][0]) {
          variantImageEntries.push({ file: req.files[imgKey][0], index: i });
        }
        if (req.files && req.files[vidKey] && req.files[vidKey][0]) {
          variantVideoEntries.push({ file: req.files[vidKey][0], index: i });
        }
      }

      const uploadedImageUrls = variantImageEntries.length
        ? await Promise.all(
            variantImageEntries.map((entry) => uploadToCloudinary(entry.file.path, entry.file.originalname, "image"))
          )
        : [];

      const uploadedVideoUrlsForIndex = {};
      if (variantVideoEntries.length > 0) {
        const uploadedVideos = await Promise.all(
          variantVideoEntries.map((entry) =>
            cloudinary.uploader.upload(entry.file.path, { resource_type: "video" }).then((r) => r.secure_url)
          )
        );
        variantVideoEntries.forEach((entry, idx) => {
          uploadedVideoUrlsForIndex[entry.index] = [uploadedVideos[idx]];
        });
      }

      [...variantImageEntries, ...variantVideoEntries].forEach(({ file }) => safeUnlink(file.path));

      const fallbackStock = req.body.stock ? Number(req.body.stock) : existing.stock || 0;

      variants = parsedColors.map((color, i) => {
        const colorNorm = String(color).trim();
        const imgEntryIndex = variantImageEntries.findIndex((v) => v.index === i);
        const imageUrl = imgEntryIndex !== -1 ? uploadedImageUrls[imgEntryIndex] : null;
        const videosFromUpload = uploadedVideoUrlsForIndex[i] || [];

        const existingMatch = (existing.variants || []).find(
          (v) => String(v.color || "").toLowerCase() === colorNorm.toLowerCase()
        );

        const images = imageUrl ? [imageUrl] : existingMatch?.images || [];
        const videos = videosFromUpload.length ? videosFromUpload : existingMatch?.videos || [];

        const perVariantStock =
          typeof variantStocks[i] === "number"
            ? variantStocks[i]
            : existingMatch?.stock ?? fallbackStock;

        return {
          color: colorNorm,
          images,
          videos,
          stock: perVariantStock,
        };
      });
    }

    const updateData = {
      name: req.body.name ?? existing.name,
      price: req.body.price ? Number(req.body.price) : existing.price,
      category: req.body.category ? String(req.body.category).trim().toLowerCase() : existing.category,
      subcategory: req.body.subcategory ? String(req.body.subcategory).trim().toLowerCase() : existing.subcategory,
      stock: req.body.stock ? Number(req.body.stock) : existing.stock,
      bestseller: req.body.bestseller === "true" || req.body.bestseller === true ? true : existing.bestseller,
      description: req.body.description ?? existing.description,
      details: parsedDetails.length ? parsedDetails : existing.details,
      faqs: parsedFaqs.length ? parsedFaqs : existing.faqs,
       difficulty: req.body.difficulty || existing.difficulty
    };

    if (variants) updateData.variants = variants;
    if (req.body.size !== undefined) updateData.size = req.body.size;

   const updated = await productModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    return res.status(200).json({ success: true, message: "Product updated successfully", product: updated });
  } catch (err) {
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

const decrementStock = async (req, res) => {
  try {
    const { productId, color, quantity } = req.body;
    if (!productId || !color || !quantity) {
      return res.status(400).json({ success: false, message: "productId, color, and quantity are required." });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const variant = product.variants.find((v) => v.color.toLowerCase() === color.toLowerCase());
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found." });
    }

    const newStock = Math.max(0, variant.stock - quantity);
    if (newStock < 0) {
      return res.status(400).json({ success: false, message: "Insufficient stock." });
    }

    variant.stock = newStock;
    await product.save();

    return res.status(200).json({ success: true, message: "Stock updated.", stock: newStock });
  } catch (err) {
    console.error("decrementStock error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update stock." });
  }
};

export { addProduct, updateProduct, listProduct, removeProduct, singleProduct , decrementStock };


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