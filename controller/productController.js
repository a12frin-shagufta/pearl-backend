import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";
import fs from "fs";

const uploadToCloudinary = async (filePath, originalName) => {
  try {
    const res = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
      transformation: [
        { width: 1200, height: 1200, crop: "limit" }, // Resize large images
        { quality: "auto", fetch_format: "auto" }, // Optimize quality/format
      ],
    });
    return res.secure_url;
  } catch (err) {
    console.error(`Cloudinary upload failed for ${originalName}:`, err);
    throw new Error(`Failed to upload image "${originalName}": ${err.message}`);
  }
};

const addProduct = async (req, res) => {
  try {
    console.log("=== addProduct req.body keys:", Object.keys(req.body || {}));
    console.log("=== addProduct req.files keys:", req.files ? Object.keys(req.files) : "no req.files");

    // Collect variant images (variantImage0..variantImage29)
    const variantFiles = [];
    const maxVariants = 30;
    for (let i = 0; i < maxVariants; i++) {
      const key = `variantImage${i}`;
      if (req.files && req.files[key] && req.files[key][0]) {
        variantFiles.push({ index: i, file: req.files[key][0] });
      }
    }

    console.log("variantFiles count:", variantFiles.length);

    // Parse colors
    let colorArray = [];
    if (req.body.colors) {
      try {
        colorArray = JSON.parse(req.body.colors);
      } catch {
        colorArray = Array.isArray(req.body.colors) ? req.body.colors : [req.body.colors];
      }
    }

    // Upload variant images to Cloudinary
    const uploadedVariantUrls = await Promise.all(
      variantFiles.map((v) => uploadToCloudinary(v.file.path, v.file.originalname))
    );

    // Cleanup temp files
    variantFiles.forEach((v) => {
      try {
        fs.unlinkSync(v.file.path);
      } catch (e) {
        console.warn(`Failed to delete temp file ${v.file.path}:`, e);
      }
    });

    // Map colors to images
    const variants = uploadedVariantUrls.map((url, i) => ({
      color: colorArray[i] || `color-${i + 1}`,
      images: [url],
    }));

    // Parse other fields
    let parsedDetails = [];
    if (req.body.details) {
      try {
        parsedDetails = JSON.parse(req.body.details);
      } catch {
        parsedDetails = Array.isArray(req.body.details) ? req.body.details : [req.body.details];
      }
    }

    let parsedFaqs = [];
    if (req.body.faqs) {
      try {
        parsedFaqs = JSON.parse(req.body.faqs);
      } catch {
        parsedFaqs = Array.isArray(req.body.faqs) ? req.body.faqs : [];
      }
    }

    // Create product
    const { name, price, category, subcategory, stock, bestseller, description, size } = req.body;

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
      faqs: parsedFaqs,
    });

    await newProduct.save();
    return res.status(201).json({ success: true, message: "Product added successfully." });
  } catch (err) {
    console.error("Error in addProduct:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error while adding product." });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id, name, price, category, subcategory, stock, bestseller, description, details, faqs, colors } = req.body;

    if (!id) return res.status(400).json({ success: false, message: "Product ID required" });

    // Parse details
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

    // Parse faqs
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

    // Parse colors
    let parsedColors = [];
    if (typeof colors === "string") {
      try {
        parsedColors = JSON.parse(colors);
      } catch {
        parsedColors = colors ? [colors] : [];
      }
    } else if (Array.isArray(colors)) {
      parsedColors = colors;
    }

    // Handle variant images
    const variantFiles = [];
    const maxVariants = 30;
    for (let i = 0; i < maxVariants; i++) {
      const key = `variantImage${i}`;
      if (req.files && req.files[key] && req.files[key][0]) {
        variantFiles.push({ index: i, file: req.files[key][0] });
      }
    }

    const uploadedVariantUrls = variantFiles.length
      ? await Promise.all(variantFiles.map((v) => uploadToCloudinary(v.file.path, v.file.originalname)))
      : [];

    // Cleanup temp files
    variantFiles.forEach((v) => {
      try {
        fs.unlinkSync(v.file.path);
      } catch (e) {
        console.warn(`Failed to delete temp file ${v.file.path}:`, e);
      }
    });

    // Build variants
    const variants = uploadedVariantUrls.length
      ? uploadedVariantUrls.map((url, i) => ({
          color: parsedColors[i] || `color-${i + 1}`,
          images: [url],
        }))
      : undefined;

    // Update product
    const updateData = {
      name,
      price,
      category,
      subcategory,
      stock,
      bestseller: bestseller === "true" || bestseller === true,
      description,
      details: parsedDetails,
      faqs: parsedFaqs,
    };
    if (variants) updateData.variants = variants;

    const updatedProduct = await productModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, message: "Product updated successfully", product: updatedProduct });
  } catch (err) {
    console.error("Error in updateProduct:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to update product" });
  }
};

const listProduct = async (req, res) => {
  try {
    const products = await productModel.find({});
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error("Error in listProduct:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products." });
  }
};

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

export { addProduct, listProduct, removeProduct, singleProduct, updateProduct };


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