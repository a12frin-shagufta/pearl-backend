import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  alt: { type: String, default: "" },
});

const testimonialSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, minlength: 2, maxlength: 60 },
    headline: { type: String, maxlength: 120 },
    content: { type: String, required: true, minlength: 10, maxlength: 1200 },
    rating: { type: Number, min: 1, max: 5 },
    avatarUrl: { type: String },
    media: { type: [mediaSchema], default: [] },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    productName: { type: String },
    location: { type: String },
    language: { type: String, default: "en" },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("testimonial", testimonialSchema);
