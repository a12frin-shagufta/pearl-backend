import mongoose from "mongoose";

// variantSchema modifications
// models/productModel.js (only the variant part shown)
const variantSchema = new mongoose.Schema({
  color: { type: String, required: true },
   images: { type: [String], default: [] },
  videos: { type: [String], default: [] },
  stock: { type: Number, default: 0 } // <-- new per-variant stock
});

// ✅ custom validator: at least 1 image OR video required
variantSchema.path('videos').validate(function () {
  const hasImages = Array.isArray(this.images) && this.images.length > 0;
  const hasVideos = Array.isArray(this.videos) && this.videos.length > 0;
  return hasImages || hasVideos;
}, 'Each variant must have at least one image or video.');


const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    subcategory: { type: String },
    stock: { type: Number, required: true },
    bestseller: { type: Boolean, default: false },
    description: { type: String },
    details: { type: [String], default: [] },
    size: { type: String },
    variants: [variantSchema],
    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);