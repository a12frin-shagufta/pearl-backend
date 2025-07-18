import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
    trim: true,
  },
  images: {
    type: [String], // Array of image URLs
    required: true,
    validate: (val) => Array.isArray(val) && val.length > 0,
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    bestseller: {
      type: Boolean,
      default: false,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },

    // 👇 NEW VARIANTS FIELD
    variants: {
      type: [variantSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const productModel =
  mongoose.models.product || mongoose.model("product", productSchema);
export default productModel;
