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
    subcategory: { type: String }, // ✅ add subcategory
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
