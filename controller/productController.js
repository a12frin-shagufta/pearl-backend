import cloudinary from "../config/cloudinary.js";

import productModel from "../models/productModel.js";
import fs from "fs";
import mongoose from "mongoose";
import { uploadToB2, getSignedVideoUrl } from "../utils/uploadVideoB2.js"
import { deleteFromB2 } from "../utils/deleteVideoB2.js";

/**
 * Upload helper to Cloudinary
 * - resource_type: "auto" => works for images AND videos
 */
// controllers/productController.js
const uploadToCloudinary = async (filePath, type = "image") => {
  try {
    const options =
      type === "video"
        ? { resource_type: "video" }
        : {
            resource_type: "image",
            format: "jpg", // convert any image to JPG
          };

    const res = await cloudinary.uploader.upload(filePath, options);
    console.log("✅ Uploaded to Cloudinary:", {
      public_id: res.public_id,
      resource_type: res.resource_type,
      format: res.format,
      url: res.secure_url,
    });
    return res.secure_url;
  } catch (err) {
    console.error("❌ Cloudinary upload error:", err.message);
    throw err;
  }
};



/**
 * Helper: safe file delete
 */
const safeUnlink = (path) => {
  try {
    if (fs.existsSync(path)) fs.unlinkSync(path);
  } catch (e) {
    console.warn("Failed to delete temp file", path, e.message);
  }
};

/**
 * Parse array-like fields from multipart/form-data
 * - Accepts: JSON string, single string, array
 * - Returns: array
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
  const variantStocksFromJson = req.body.variantStocks
    ? parseMaybeJsonArray(req.body.variantStocks)
    : null;

  const stocks = new Array(colorArrayLength).fill(undefined);

  if (variantStocksFromJson && variantStocksFromJson.length > 0) {
    for (let i = 0; i < Math.min(colorArrayLength, variantStocksFromJson.length); i++) {
      const n = Number(variantStocksFromJson[i]);
      stocks[i] = Number.isFinite(n) ? Math.max(0, n) : undefined;
    }
    return stocks;
  }

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
    const {
      name,
      price,
      category,
      subcategory,
      stock,
      bestseller,
      description,
      size,
      difficulty,
    } = req.body;

    if (!name || !price || !category || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing (name, price, category, stock).",
      });
    }

    let colorArray = parseMaybeJsonArray(req.body.colors)
      .map((c) => String(c).trim())
      .filter(Boolean);

    if (!colorArray.length) {
      return res.status(400).json({
        success: false,
        message: "At least one color variant is required (colors).",
      });
    }

    const variantStocks = readVariantStocks(req, colorArray.length);

    // ✅ DECLARE uploadedByIndex HERE (at the beginning)
    const uploadedByIndex = {};
    
    // Initialize structure for all indices
    for (let i = 0; i < colorArray.length; i++) {
      uploadedByIndex[i] = { images: [], videos: [] };
    }

    // Collect files per index
    const perIndexFiles = {};

    for (let i = 0; i < colorArray.length; i++) {
      // Safe individual access - no array indexing crash
      const imageFile = req.files?.[`variantImage${i}`]?.[0] || null;
      const videoFile = req.files?.[`variantVideo${i}`]?.[0] || null;
      
      // Log sizes immediately
      if (videoFile) {
        const sizeMB = (videoFile.size / 1024 / 1024).toFixed(1);
        console.log(`  🎥 variantVideo${i}: "${videoFile.originalname}" → ${sizeMB}MB`);
      }
      if (imageFile) {
        console.log(`  🖼️ variantImage${i}: "${imageFile.originalname}" → ${(imageFile.size / 1024 / 1024).toFixed(1)}MB`);
      }
      
      perIndexFiles[i] = { imageFile, videoFile };
      
      // Safe media validation
      if (!imageFile && !videoFile) {
        return res.status(400).json({
          success: false,
          message: `Missing image/video for color "${colorArray[i]}" (variantImage${i} or variantVideo${i})`,
        });
      }
    }

    // ✅ REMOVE THIS DUPLICATE DECLARATION (line 53 in your code)
    // const uploadedByIndex = {}; // ❌ DELETE THIS LINE

    try {
      for (let i = 0; i < colorArray.length; i++) {
        const { imageFile, videoFile } = perIndexFiles[i];

        if (imageFile) {
          // 🖼️ Upload image to Cloudinary
          const url = await uploadToCloudinary(imageFile.path, "image");
          uploadedByIndex[i].images.push(url);
        }
        
        if (videoFile) {
          const sizeMB = (videoFile.size / 1024 / 1024).toFixed(1);
          console.log(`📤 Uploading video ${i}: "${videoFile.originalname}" (${sizeMB}MB)`);
          
          // 🎥 Upload video to B2
          const b2Key = await uploadToB2(
            videoFile.path,
            videoFile.originalname.replace(/\.[^/.]+$/, "-uploaded.mp4"),
            videoFile.mimetype,
            fs
          );
          
          // Generate signed URL for private bucket
          const signedUrl = await getSignedVideoUrl(b2Key, 24 * 3600);
          
          console.log(`✅ B2 uploaded: ${b2Key} → Signed URL generated`);
          uploadedByIndex[i].videos.push({
            key: b2Key,
            signedUrl: signedUrl,
            expiresAt: Date.now() + (24 * 3600 * 1000)
          });
        }
      }
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    } finally {
      // Cleanup temp files
      for (let i = 0; i < colorArray.length; i++) {
        const { imageFile, videoFile } = perIndexFiles[i];
        if (imageFile) safeUnlink(imageFile.path);
        if (videoFile) safeUnlink(videoFile.path);
      }
    }

    const globalStockNumber = Number(stock) || 0;

    // Build variants array
    const variants = colorArray.map((color, i) => ({
      color: String(color).trim(),
      images: uploadedByIndex[i]?.images || [],
      videos: uploadedByIndex[i]?.videos || [], // Now this contains objects, not just strings
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
    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product: newProduct,
    });
  } catch (err) {
    console.error("addProduct error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error while adding product.",
    });
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
    if (!existing)
      return res.status(404).json({ success: false, message: "Product not found." });

    const parsedDetails = parseMaybeJsonArray(req.body.details);
    const parsedFaqs = parseMaybeJsonArray(req.body.faqs);
    let parsedColors = parseMaybeJsonArray(req.body.colors)
      .map((c) => String(c).trim())
      .filter(Boolean);

    let variants;

    if (parsedColors.length > 0) {
      const variantStocks = readVariantStocks(req, parsedColors.length);

      console.log('📊 UPDATE FILE DEBUG:');
      for (let i = 0; i < parsedColors.length; i++) {
        const imgFile = req.files?.[`variantImage${i}`]?.[0];
        const vidFile = req.files?.[`variantVideo${i}`]?.[0];
        if (vidFile) {
          const sizeMB = (vidFile.size / 1024 / 1024).toFixed(1);
          console.log(`  🎥 variantVideo${i}: "${vidFile.originalname}" → ${sizeMB}MB`);
        }
        if (imgFile) {
          console.log(`  🖼️ variantImage${i}: "${imgFile.originalname}" → ${(imgFile.size / 1024 / 1024).toFixed(1)}MB`);
        }
      }

      const variantImageEntries = [];
      const variantVideoEntries = [];
      const uploadedVideoUrlsForIndex = {}; // ✅ DECLARE HERE

      for (let i = 0; i < parsedColors.length; i++) {
        const imgKey = `variantImage${i}`;
        const vidKey = `variantVideo${i}`;

        if (req.files?.[imgKey]?.[0]) {
          variantImageEntries.push({ file: req.files[imgKey][0], index: i });
        }
        if (req.files?.[vidKey]?.[0]) {
          variantVideoEntries.push({ file: req.files[vidKey][0], index: i });
        }
      }

      // --------- IMAGE UPLOAD (Cloudinary) ----------
      const uploadedImageUrls = variantImageEntries.length
        ? await Promise.all(
            variantImageEntries.map((entry) =>
              uploadToCloudinary(entry.file.path, "image")
            )
          )
        : [];

      // --------- VIDEO UPLOAD (Backblaze B2) ----------
      if (variantVideoEntries.length > 0) {
        console.log(`📤 Uploading ${variantVideoEntries.length} video(s)...`);
        
        for (let i = 0; i < variantVideoEntries.length; i++) {
          const entry = variantVideoEntries[i];
          const sizeMB = (entry.file.size / 1024 / 1024).toFixed(1);
          console.log(`📤 Video ${entry.index}: "${entry.file.originalname}" (${sizeMB}MB)`);
          
          try {
            const b2Key = await uploadToB2(
              entry.file.path,
              entry.file.originalname,
              entry.file.mimetype,
              fs
            );
            
            const signedUrl = await getSignedVideoUrl(b2Key, 24 * 3600);
            
            uploadedVideoUrlsForIndex[entry.index] = [{
              key: b2Key,
              signedUrl: signedUrl,
              expiresAt: Date.now() + (24 * 3600 * 1000)
            }];
            
            console.log(`✅ Uploaded video for index ${entry.index}: ${b2Key}`);
          } catch (error) {
            console.error(`❌ Failed to upload video ${entry.index}:`, error);
            // Keep existing videos if upload fails
            const existingMatch = existing.variants?.find(
              (v, idx) => idx === entry.index || v.color === parsedColors[entry.index]
            );
            uploadedVideoUrlsForIndex[entry.index] = existingMatch?.videos || [];
          }
        }
      }

      // Cleanup temp files
      [...variantImageEntries, ...variantVideoEntries].forEach(({ file }) =>
        safeUnlink(file.path)
      );

      const fallbackStock = req.body.stock
        ? Number(req.body.stock)
        : existing.stock || 0;

      variants = parsedColors.map((color, i) => {
        const existingMatch = existing.variants?.find(
          (v) => v.color.toLowerCase() === color.toLowerCase()
        );

        const imgEntryIndex = variantImageEntries.findIndex((v) => v.index === i);
        const newImage = imgEntryIndex !== -1 ? uploadedImageUrls[imgEntryIndex] : null;

        const newVideos = uploadedVideoUrlsForIndex[i] || [];

        return {
          color,
          images: newImage ? [newImage] : existingMatch?.images || [],
          videos: newVideos.length > 0 ? newVideos : existingMatch?.videos || [],
          stock:
            typeof variantStocks[i] === "number"
              ? variantStocks[i]
              : existingMatch?.stock ?? fallbackStock,
        };
      });
    }

    const updateData = {
      name: req.body.name ?? existing.name,
      price: req.body.price ? Number(req.body.price) : existing.price,
      category: req.body.category
        ? req.body.category.trim().toLowerCase()
        : existing.category,
      subcategory: req.body.subcategory
        ? req.body.subcategory.trim().toLowerCase()
        : existing.subcategory,
      stock: req.body.stock ? Number(req.body.stock) : existing.stock,
      bestseller:
        req.body.bestseller === "true" || req.body.bestseller === true
          ? true
          : existing.bestseller,
      description: req.body.description ?? existing.description,
      details: parsedDetails.length ? parsedDetails : existing.details,
      faqs: parsedFaqs.length ? parsedFaqs : existing.faqs,
      difficulty: req.body.difficulty || existing.difficulty,
    };

    if (variants) updateData.variants = variants;
    if (req.body.size !== undefined) updateData.size = req.body.size;

    const updated = await productModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    console.log(`✅ Updated product ${id}: ${parsedColors.length} variants`);
    res.json({ success: true, message: "Product updated successfully", product: updated });
  } catch (err) {
    console.error("updateProduct error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
const generateFreshVideoUrls = async (videosArray) => {
  if (!videosArray || !Array.isArray(videosArray)) {
    console.warn('⚠️ generateFreshVideoUrls: Input is not a valid array:', videosArray);
    return videosArray;
  }

  console.log(`🔄 generateFreshVideoUrls processing ${videosArray.length} video(s)`);
  
  try {
    const updatedVideos = await Promise.all(
      videosArray.map(async (video, index) => {
        console.log(`  Processing video ${index}:`, video);
        
        // ✅ KEEP YOUR ORIGINAL LOGIC HERE - this is what processes videos!
        if (typeof video === 'string') {
          // Old format string - generate signed URL
          try {
            const signedUrl = await getSignedVideoUrl(video, 24 * 3600);
            console.log(`  ✅ Generated signed URL for string video: ${video.substring(0, 30)}...`);
            return {
              key: video,
              signedUrl: signedUrl,
              expiresAt: Date.now() + (24 * 3600 * 1000)
            };
          } catch (err) {
            console.error(`  ❌ Failed to generate URL for ${video}:`, err.message);
            return video; // Return as-is if generation fails
          }
        } else if (video && typeof video === 'object' && video.key) {
          // Already an object - refresh if expired or expiring soon
          const isExpired = !video.expiresAt || video.expiresAt < Date.now();
          const isExpiringSoon = video.expiresAt && 
                                (video.expiresAt - Date.now()) < (60 * 60 * 1000); // 1 hour
          
          if (isExpired || isExpiringSoon) {
            try {
              const newSignedUrl = await getSignedVideoUrl(video.key, 24 * 3600);
              console.log(`  ✅ Refreshed signed URL for: ${video.key.substring(0, 30)}...`);
              return {
                ...video,
                signedUrl: newSignedUrl,
                expiresAt: Date.now() + (24 * 3600 * 1000)
              };
            } catch (err) {
              console.error(`  ❌ Failed to refresh URL for ${video.key}:`, err.message);
              return video; // Keep original if refresh fails
            }
          }
          console.log(`  ✅ Video ${video.key.substring(0, 30)}... has valid URL`);
          return video;
        }
        
        console.warn(`  ⚠️ Unknown video format at index ${index}:`, video);
        return video;
      })
    );
    
    console.log(`✅ generateFreshVideoUrls completed`);
    return updatedVideos;
  } catch (error) {
    // ⚠️ CRITICAL: This catches if the ENTIRE Promise.all fails
    console.error('🔥 generateFreshVideoUrls CRASHED:', error);
    // Return the original array to prevent data loss
    return videosArray;
  }
};
// Update listProduct:
const listProduct = async (req, res) => {
  try {
    const products = await productModel.find({});
    console.log(`📦 Fetched ${products.length} raw products from DB`);
    
    const processedProducts = await Promise.all(
      products.map(async (product) => {
        const productObj = product.toObject();
        
        if (productObj.variants) {
          for (const variant of productObj.variants) {
            // ⚠️ SAFETY CHECK: Log BEFORE processing
            const originalVideos = variant.videos;
            if (originalVideos && originalVideos.length > 0) {
              console.log(`🎬 Found ${originalVideos.length} video(s) for variant ${variant.color} in product ${productObj.name}`);
              
              try {
                variant.videos = await generateFreshVideoUrls(variant.videos);
              } catch (err) {
                // If processing fails, KEEP THE ORIGINAL VIDEOS
                console.error(`❌ Failed to process videos for ${productObj.name}, keeping originals:`, err);
                variant.videos = originalVideos; // Restore original data
              }
              
              // ⚠️ DEBUG: Log AFTER processing
              console.log(`🔄 After processing, variant has ${variant.videos?.length || 0} video(s)`);
            }
          }
        }
        return productObj;
      })
    );
    
    res.status(200).json({ success: true, products: processedProducts });
  } catch (error) {
    console.error("listProduct error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products." });
  }
};

// const removeProduct = async (req, res) => {
//   try {
//     const { id } = req.body;
//     if (!id) return res.status(400).json({ success: false, message: "Product ID is required." });

//     const product = await productModel.findById(id);
//     if (!product) return res.status(404).json({ success: false, message: "Product not found." });

//     await productModel.findByIdAndDelete(id);
//     // Consider removing associated Cloudinary assets if you want to free storage (not implemented here).
//     return res.status(200).json({ success: true, message: "Product removed successfully." });
//   } catch (error) {
//     console.error("removeProduct error:", error);
//     return res.status(500).json({ success: false, message: "Failed to delete product." });
//   }
// };
const removeProduct = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required." });
    }

    const product = await productModel.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

// In removeProduct function, update this part:
const videoKeys = [];
for (const v of product.variants || []) {
  for (const key of v.videos || []) {
    if (typeof key === "string" && key.trim()) {
      videoKeys.push(key.trim());
    } else if (key && key.key) {
      // New format: video is an object with key property
      videoKeys.push(key.key.trim());
    }
  }
}

    if (videoKeys.length) {
      // console.log("🧹 Deleting B2 videos for product:", id, videoKeys);
      await Promise.all(videoKeys.map((k) => deleteFromB2(k)));
    }

    await productModel.findByIdAndDelete(id);

    return res
      .status(200)
      .json({ success: true, message: "Product removed successfully." });
  } catch (error) {
    console.error("removeProduct error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete product." });
  }
};

const singleProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: "Product ID is required." 
      });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found." 
      });
    }

    // Convert to plain object to modify
    const productObj = product.toObject();
    
    // Generate fresh signed URLs for all videos
if (productObj.variants && productObj.variants.length > 0) {
  for (const variant of productObj.variants) {
    if (variant.videos && variant.videos.length > 0) {
      // Check if videos are in old format (strings) or new format (objects)
      const hasOldFormat = variant.videos.some(v => typeof v === 'string');
      const hasNewFormat = variant.videos.some(v => v && typeof v === 'object' && v.key);
      
      if (hasOldFormat) {
        // Convert old string format to new object format
        const updatedVideos = [];
        for (const video of variant.videos) {
          if (typeof video === 'string' && !video.includes('cloudinary.com')) {
            try {
              const signedUrl = await getSignedVideoUrl(video, 24 * 3600);
              updatedVideos.push({
                key: video,
                signedUrl: signedUrl,
                expiresAt: Date.now() + (24 * 3600 * 1000)
              });
            } catch (err) {
              console.error(`Failed to generate URL for ${video}:`, err);
              updatedVideos.push(video);
            }
          } else {
            updatedVideos.push(video);
          }
        }
        variant.videos = updatedVideos;
      } else if (hasNewFormat) {
        // Already in new format, just refresh if needed
        variant.videos = await generateFreshVideoUrls(variant.videos);
      }
    }
  }
}

    res.status(200).json({ 
      success: true, 
      product: productObj 
    });
  } catch (error) {
    console.error("singleProduct error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch product." 
    });
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
// Add to your productController.js
const debugProductVideo = async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called');
    const { productId } = req.query;
    
    // Check if productId exists
    if (!productId) {
      console.log('❌ No productId provided');
      return res.status(400).json({ 
        success: false, 
        error: "productId query parameter is required" 
      });
    }
    
    console.log(`🔍 Looking for product: ${productId}`);
    
    // Find product
    const product = await productModel.findById(productId);
    
    if (!product) {
      console.log(`❌ Product not found: ${productId}`);
      return res.status(404).json({ 
        success: false, 
        error: "Product not found" 
      });
    }
    
    console.log(`✅ Found product: ${product.name}`);
    
    // Convert to plain object safely
    const productObj = product.toObject ? product.toObject() : product;
    
    // Build response
    const debugInfo = {
      success: true,
      productId,
      productName: productObj.name,
      variants: []
    };
    
    // Safely check variants
    if (productObj.variants && Array.isArray(productObj.variants)) {
      productObj.variants.forEach((variant, idx) => {
        const variantInfo = {
          index: idx,
          color: variant.color || 'Unknown',
          hasVideos: !!(variant.videos && variant.videos.length > 0),
          videosCount: variant.videos ? variant.videos.length : 0,
          videos: []
        };
        
        // Safely check videos
        if (variant.videos && Array.isArray(variant.videos)) {
          variant.videos.forEach((video, vidIdx) => {
            if (typeof video === 'string') {
              variantInfo.videos.push({
                index: vidIdx,
                type: 'string',
                value: video.substring(0, 30) + '...',
                isB2Key: !video.includes('http') && !video.includes('/')
              });
            } else if (video && typeof video === 'object') {
              variantInfo.videos.push({
                index: vidIdx,
                type: 'object',
                hasKey: !!video.key,
                key: video.key,
                hasSignedUrl: !!video.signedUrl,
                signedUrlPreview: video.signedUrl ? 
                  '...' + video.signedUrl.substring(video.signedUrl.length - 20) : null,
                hasExpiresAt: !!video.expiresAt,
                expiresAt: video.expiresAt,
                isExpired: video.expiresAt ? video.expiresAt < Date.now() : null
              });
            } else {
              variantInfo.videos.push({
                index: vidIdx,
                type: 'unknown',
                raw: video
              });
            }
          });
        }
        
        debugInfo.variants.push(variantInfo);
      });
    }
    
    console.log(`📊 Debug info generated for ${productId}`);
    
    // Send response with CORS headers explicitly
    res.header('Access-Control-Allow-Origin', '*');
    res.json(debugInfo);
    
  } catch (error) {
    console.error('🔥 debugProductVideo CRASHED:', error);
    
    // Send error with CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
};

export { addProduct, updateProduct, listProduct, removeProduct, singleProduct , decrementStock, debugProductVideo };


