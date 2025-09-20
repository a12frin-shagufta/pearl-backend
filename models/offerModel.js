// models/offerModel.js
import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercentage: { type: Number, required: true }, // e.g., 10
  description: { type: String },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date }, // optional expiry date
  // NEW: categories the offer applies to (if empty -> global)
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  // NEW: whether offer applies to subcategories of the selected categories
  applyToSubcategories: { type: Boolean, default: false }
}, { timestamps: true });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);
export default Offer;
