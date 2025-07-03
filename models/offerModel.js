import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountPercentage: { type: Number, required: true }, // e.g., 10 for 10%
  description: { type: String },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date }, // optional expiry date
}, { timestamps: true });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);
export default Offer;
