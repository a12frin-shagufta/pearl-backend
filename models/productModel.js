import mongoose from "mongoose";

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
    image: {
      type: [String],
      required: true,
      validate: (val) => Array.isArray(val) && val.length > 0,
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
      trim: true, // Optional, no required validator
    },
    size: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const productModel = mongoose.models.product || mongoose.model("product", productSchema);
export default productModel;