import productModel from "../models/productModel.js";
import fs from "fs";
import mongoose from "mongoose";
import { uploadToB2, getSignedVideoUrl } from "../utils/uploadVideoB2.js"
import { deleteFromB2 } from "../utils/deleteVideoB2.js";
import imagekit from "../config/imagekit.js";
import sharp from "sharp";

/**
 * Upload helper to Cloudinary
 * - resource_type: "auto" => works for images AND videos
 */
// controllers/productController.js

// const uploadToCloudinary = async (fileBuffer, fileName, type = "image") => {
//   try {
//     const options = type === "video"
//       ? { resource_type: "video" }
//       : {
//           resource_type: "image",
//           format: "jpg", // convert any image to JPG
//         };

//     // Convert buffer to base64 for Cloudinary
//     const b64 = Buffer.from(fileBuffer).toString('base64');
//     let dataURI;
    
//     if (type === 'video') {
//       dataURI = `data:video/mp4;base64,${b64}`;
//     } else {
//       dataURI = `data:image/jpeg;base64,${b64}`;
//     }

//     const res = await cloudinary.uploader.upload(dataURI, options);
//     console.log("✅ Uploaded to Cloudinary from buffer:", {
//       public_id: res.public_id,
//       type: type,
//       url: res.secure_url.substring(0, 80) + '...'
//     });
//     return res.secure_url;
//   } catch (err) {
//     console.error("❌ Cloudinary upload error:", err.message);
//     throw err;
//   }
// };


const uploadToImageKit = async (fileBuffer, fileName, type = "image") => {
  try {

    // Optimize image buffer
    const optimizedBuffer = await sharp(fileBuffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .withMetadata(false) // strips EXIF
      .toBuffer();

    const res = await imagekit.upload({
      file: optimizedBuffer, 
      fileName: fileName,
      useUniqueFileName: true,
      folder: type === "video" ? "videos" : "images",
      isPrivateFile: false,
    });

    console.log("✅ Uploaded to ImageKit - FULL RESPONSE:");
    
    return res.url;
  } catch (err) {
    console.error("❌ ImageKit upload error:", err.message);
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

    const uploadedByIndex = {};
    
    // Initialize structure for all indices
    for (let i = 0; i < colorArray.length; i++) {
      uploadedByIndex[i] = { images: [], videos: [] };
    }

    // Process each variant in a SINGLE loop
    for (let i = 0; i < colorArray.length; i++) {
      const imageFile = req.files?.[`variantImage${i}`]?.[0] || null;
      const videoFile = req.files?.[`variantVideo${i}`]?.[0] || null;
      const color = colorArray[i];
      
      // Validation: at least one media file required
      if (!imageFile && !videoFile) {
        return res.status(400).json({
          success: false,
          message: `Missing image/video for color "${color}" (variantImage${i} or variantVideo${i})`,
        });
      }
      
      console.log(`📦 Processing variant ${i} (${color}):`);
      
      // --- UPLOAD IMAGE TO CLOUDINARY (if exists) ---
      // if (imageFile) {
      //   const sizeMB = (imageFile.size / 1024 / 1024).toFixed(1);
      //   console.log(`  🖼️ Image: "${imageFile.originalname}" (${sizeMB}MB)`);
        
      //   try {
      //     console.log(`  ☁️ Uploading image to Cloudinary...`);
      //     // ✅ MUST UPDATE uploadToCloudinary function to accept buffer!
      //     const url = await uploadToCloudinary(
      //       imageFile.buffer, // ← BUFFER, not path!
      //       imageFile.originalname,
      //       "image"
      //     );
      //     uploadedByIndex[i].images.push(url);
      //     console.log(`  ✅ Image uploaded: ${url.substring(0, 80)}...`);
      //   } catch (error) {
      //     console.error(`  ❌ Cloudinary upload failed:`, error.message);
      //     throw new Error(`Image upload failed for color "${color}": ${error.message}`);
      //   }
      // }

      // --- UPLOAD IMAGE TO IMAGEKIT (if exists) ---
      if (imageFile) {
        const sizeMB = (imageFile.size / 1024 / 1024).toFixed(1);
        console.log(`  🖼️ Image: "${imageFile.originalname}" (${sizeMB}MB)`);

        try {
          console.log(`  ☁️ Uploading image to ImageKit...`);

          const imgUrl = await uploadToImageKit(
            imageFile.buffer,        // ✅ buffer directly
            imageFile.originalname,  // ✅ filename
            "image"
          );

          uploadedByIndex[i].images.push(imgUrl);

          console.log(`  ✅ Image uploaded: ${imgUrl.substring(0, 80)}...`);
        } catch (error) {
          console.error(`  ❌ ImageKit upload failed:`, error.message);
          throw new Error(`Image upload failed for color "${color}": ${error.message}`);
        }
      }

      
      // --- UPLOAD VIDEO TO B2 (if exists) ---
      if (videoFile) {
        const sizeMB = (videoFile.size / 1024 / 1024).toFixed(1);
        console.log(`  🎥 Video: "${videoFile.originalname}" (${sizeMB}MB)`);
        
        try {
          // 1. Upload video buffer to B2
          console.log(`  🔑 Step 1/2: Uploading to B2...`);
          const b2Key = await uploadToB2(
            videoFile.buffer, // ← BUFFER
            videoFile.originalname.replace(/\.[^/.]+$/, "-uploaded.mp4"),
            videoFile.mimetype
            // NO fs parameter!
          );
          
          console.log(`  ✅ B2 upload successful: ${b2Key}`);
          
          // 2. Generate signed URL
          console.log(`  🔗 Step 2/2: Generating signed URL...`);
        const signedUrl = await getSignedVideoUrl(b2Key, 7 * 24 * 3600)
          
          if (!signedUrl || typeof signedUrl !== 'string' || signedUrl.length < 10) {
            throw new Error(`Invalid signed URL generated: ${signedUrl}`);
          }
          
          console.log(`  ✅ Signed URL generated (${signedUrl.length} chars)`);
          
          // 3. Store as proper object
          uploadedByIndex[i].videos.push({
            key: b2Key,
            signedUrl: signedUrl,
            expiresAt: Date.now() + (7 * 24 * 3600),
            generatedAt: new Date().toISOString()
          });
          
        } catch (error) {
          console.error(`  ❌ Video processing FAILED:`, error.message);
          console.error(`  🔥 Stack:`, error.stack);
          throw new Error(`Video processing failed for color "${color}": ${error.message}`);
        }
      }
      
      console.log(`  ✅ Variant ${i} processed\n`);
    }

    const globalStockNumber = Number(stock) || 0;
    
    // --- VALIDATION (strict - no strings allowed) ---
    console.log('🔍 Validating video objects before saving...');
    for (let i = 0; i < colorArray.length; i++) {
      const color = colorArray[i];
      const videos = uploadedByIndex[i]?.videos || [];
      
      console.log(`  Checking ${videos.length} video(s) for color "${color}"`);
      
      for (const video of videos) {
        // Check 1: No strings allowed
        if (typeof video === 'string') {
          console.error(`❌ REJECTED: Video stored as STRING for "${color}": "${video.substring(0, 50)}..."`);
          throw new Error(`VIDEO_ERROR: Video for "${color}" stored as string.`);
        }
        
        // Check 2: Must have key and signedUrl
        if (!video?.key || !video?.signedUrl) {
          console.error(`❌ REJECTED: Missing key/signedUrl for "${color}":`, video);
          throw new Error(`VIDEO_ERROR: Video for "${color}" missing key or signedUrl.`);
        }
        
        console.log(`  ✅ Video OK: ${video.key.substring(0, 30)}...`);
      }
    }
    console.log('✅ All videos validated!\n');
    
    // Build variants array
    const variants = colorArray.map((color, i) => ({
      color: String(color).trim(),
      images: uploadedByIndex[i]?.images || [],
      videos: uploadedByIndex[i]?.videos || [],
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
    
    console.log(`🎉 Product "${name}" added successfully with ${colorArray.length} variant(s)`);
    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product: newProduct,
    });
    
  } catch (err) {
    console.error("💥 addProduct error:", err.message);
    
    // NO FILE CLEANUP NEEDED - files are in memory, not on disk!
    
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

    // If colors are provided, update variants
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
      const uploadedVideoUrlsForIndex = {};

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
      //  const uploadedImageUrls = variantImageEntries.length > 0
      //     ? await Promise.all(  // ← FIX: Add await Promise.all()
      //         variantImageEntries.map((entry) =>
      //           uploadToCloudinary(entry.file.buffer, entry.file.originalname, "image")
      //         )
      //       )
      //     : [];

      // --------- IMAGE UPLOAD (ImageKit) ----------
      const uploadedImageUrls = variantImageEntries.length > 0
        ? await Promise.all(
            variantImageEntries.map((entry) =>
              uploadToImageKit(
                entry.file.buffer,
                entry.file.originalname,
                "image"
              )
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
          // ✅ CORRECT: Using buffer
          const b2Key = await uploadToB2(
            entry.file.buffer,
            entry.file.originalname,
            entry.file.mimetype
          );
          
          const signedUrl = await getSignedVideoUrl(b2Key, 7 * 24 * 3600)
          
          uploadedVideoUrlsForIndex[entry.index] = [{
            key: b2Key,
            signedUrl: signedUrl,
            expiresAt: Date.now() + (7 * 24 * 3600 * 1000)
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

        // Safely get existing videos
        let existingVideos = [];
        if (existingMatch && existingMatch.videos) {
          if (Array.isArray(existingMatch.videos)) {
            // Filter out corrupted string arrays and ensure video format consistency
            existingVideos = existingMatch.videos.filter(v => {
              if (Array.isArray(v)) {
                console.warn('⚠️ Removing corrupted array video:', v);
                return false;
              }
              
              // Convert old string format to object format
              // if (typeof v === 'string') {
              //   return !v.includes('cloudinary.com'); // Skip cloudinary image URLs
              // }
              if (typeof v === 'string') {
                return true;
              }

              
              return v && typeof v === 'object' && v.key;
            }).map(v => {
              // Convert old string format to new object format
              if (typeof v === 'string') {
                return {
                  key: v,
                  signedUrl: null,
                  originalFormat: 'string'
                };
              }
              return v;
            });
          }
        }

        return {
          color,
          images: newImage ? [newImage] : existingMatch?.images || [],
          videos: newVideos.length > 0 ? newVideos : existingVideos,
          stock: typeof variantStocks[i] === "number"
            ? variantStocks[i]
            : existingMatch?.stock ?? fallbackStock,
        };
      });
      
      // 🚨 ADD VALIDATION HERE - RIGHT AFTER BUILDING VARIANTS
      console.log('🔍 Validating videos in update...');
      for (const variant of variants) {
        console.log(`  Checking ${variant.videos?.length || 0} videos for ${variant.color}`);
        for (const video of variant.videos || []) {
          if (typeof video === 'string') {
            console.error(`❌ UPDATE_REJECTED: Video as string for "${variant.color}": ${video.substring(0, 50)}...`);
            throw new Error(`UPDATE_ERROR: Video for "${variant.color}" stored as string`);
          }
          if (!video?.signedUrl) {
            console.error(`❌ UPDATE_REJECTED: Missing signedUrl for "${variant.color}":`, video);
            throw new Error(`UPDATE_ERROR: Video for "${variant.color}" missing signedUrl`);
          }
          console.log(`  ✅ Video OK for ${variant.color}: ${video.key?.substring(0, 30)}...`);
        }
      }
      console.log('✅ All update videos validated!');
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

    // ✅ ADD VARIANTS ONLY ONCE (and only if they exist)
    if (variants) {
      updateData.variants = variants;
    }
    
    if (req.body.size !== undefined) updateData.size = req.body.size;

    const updated = await productModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    console.log(`✅ Updated product ${id}: ${parsedColors.length || existing.variants?.length || 0} variants`);
    res.json({ success: true, message: "Product updated successfully", product: updated });
  } catch (err) {
    console.error("updateProduct error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const generateFreshVideoUrls = async (videosArray) => {
  console.log('🎯 generateFreshVideoUrls CALLED');
  
  if (!videosArray || !Array.isArray(videosArray)) {
    console.warn('⚠️ Invalid input', videosArray);
    return videosArray;
  }

  console.log(`🔄 Processing ${videosArray.length} video(s)`);
  
  const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
  const SEVEN_DAYS_SECONDS = 7 * 24 * 3600;
  
  const updatedVideos = await Promise.all(
    videosArray.map(async (video) => {
      // Handle string videos (old format)
      if (typeof video === 'string') {
        if (video.includes('cloudinary.com')) {
          console.warn(`⚠️ Skipping Cloudinary URL: ${video.substring(0, 50)}...`);
          return null;
        }
        
        try {
          console.log(`🔗 Converting string to 7-day URL: ${video.substring(0, 30)}...`);
          const signedUrl = await getSignedVideoUrl(video, SEVEN_DAYS_SECONDS);
          
          return {
            key: video,
            signedUrl: signedUrl,
            expiresAt: Date.now() + SEVEN_DAYS_MS,
            generatedAt: new Date().toISOString()
          };
        } catch (err) {
          console.error(`❌ Failed for string "${video}":`, err.message);
          return {
            key: video,
            signedUrl: null,
            error: err.message,
            expiresAt: null
          };
        }
      }
      
      // Handle object videos
      if (video && typeof video === 'object' && video.key) {
        const now = Date.now();
        const isExpired = video.expiresAt && video.expiresAt < now;
        const expiresIn24h = video.expiresAt && (video.expiresAt - now) < (24 * 60 * 60 * 1000); // 24 hours warning
        
        console.log(`🔍 Checking: ${video.key.substring(0, 30)}...`);
        console.log(`   Status: ${isExpired ? 'EXPIRED' : expiresIn24h ? 'EXPIRES SOON' : 'VALID'}`);
        
        // Refresh if: expired, expires in <24h, or missing signedUrl
        if (isExpired || expiresIn24h || !video.signedUrl) {
          console.log(`🔄 Refreshing URL (${isExpired ? 'expired' : 'expiring soon'})...`);
          try {
            const signedUrl = await getSignedVideoUrl(video.key, SEVEN_DAYS_SECONDS);
            return {
              ...video,
              signedUrl: signedUrl,
              expiresAt: now + SEVEN_DAYS_MS,
              refreshedAt: new Date().toISOString(),
              previouslyExpired: isExpired
            };
          } catch (err) {
            console.error(`❌ Failed to refresh "${video.key}":`, err.message);
            return {
              ...video,
              signedUrl: null,
              error: err.message
            };
          }
        }
        
        // URL is still valid (>24h left)
        console.log(`✅ Valid for ${Math.round((video.expiresAt - now) / (1000 * 60 * 60))} more hours`);
        return video;
      }
      
      console.warn('⚠️ Unknown format:', video);
      return null;
    })
  );
  
  const validVideos = updatedVideos.filter(v => v !== null);
  console.log(`✅ Processed ${validVideos.length} videos`);
  
  return validVideos;
};
// Update listProduct:
const listProduct = async (req, res) => {
  try {
    console.log('🚀 listProduct STARTED - will refresh expired URLs');
    const products = await productModel.find({});
    console.log(`📦 Found ${products.length} products`);
    
    const processedProducts = await Promise.all(
      products.map(async (product, index) => {
        const productObj = product.toObject();
        let needsDbUpdate = false;
        
        if (productObj.variants) {
          for (let i = 0; i < product.variants.length; i++) {
            const variant = product.variants[i];
            const variantObj = productObj.variants[i];
            
            if (variant.videos && variant.videos.length > 0) {
              console.log(`🎬 Processing ${variant.videos.length} videos for ${product.name}`);
              
              try {
                const originalVideos = [...variant.videos];
                const refreshedVideos = await generateFreshVideoUrls(variant.videos);
                
                // Update response
                variantObj.videos = refreshedVideos;
                
                // Check if any URLs were actually refreshed
                const wasRefreshed = refreshedVideos.some((v, idx) => 
                  v.refreshedAt || v.previouslyExpired || 
                  (originalVideos[idx] && originalVideos[idx].signedUrl !== v.signedUrl)
                );
                
                if (wasRefreshed) {
                  // Update Mongoose document for potential DB save
                  product.variants[i].videos = refreshedVideos;
                  needsDbUpdate = true;
                  console.log(`🔄 URLs refreshed for ${product.name} - ${variant.color}`);
                }
                
              } catch (err) {
                console.error(`❌ Video processing failed for ${product.name}:`, err.message);
                variantObj.videos = (variant.videos || []).map(v => 
                  typeof v === 'string' ? { key: v, signedUrl: null } : v
                );
              }
            }
          }
        }
        

        if (needsDbUpdate) {
          try {
            await product.save();
            console.log(`💾 Saved refreshed URLs to DB for: ${product.name}`);
          } catch (saveErr) {
            console.error(`❌ Failed to save ${product.name}:`, saveErr.message);
          }
        }
        
        
        return productObj;
      })
    );
    
    console.log('🏁 listProduct COMPLETED - URLs valid for 7 days');
    res.status(200).json({ 
      success: true, 
      products: processedProducts,
      message: "Video URLs refreshed (7-day validity)"
    });
    
  } catch (error) {
    console.error('💥 listProduct ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch products.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

export { addProduct, updateProduct, listProduct, removeProduct, singleProduct , decrementStock, debugProductVideo, uploadToImageKit };


