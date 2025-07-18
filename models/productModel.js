import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  color: { type: String, required: true },
  images: { type: [String], required: true }, // 1 image per color
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true },
    bestseller: { type: Boolean, default: false },
    description: { type: String },
    size: { type: String },
    variants: [variantSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
