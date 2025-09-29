// models/offerModel.js
import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },

    // categories this offer applies to
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    applyToSubcategories: { type: Boolean, default: false },

    // NEW: multiple rules based on difficulty
    discountRules: [
      {
        difficulty: {
          type: String,
          enum: ["easy", "medium", "difficult"], // you can expand if needed
          required: true,
        },
        discountPercentage: { type: Number, required: true }, // e.g. 20
      },
    ],
  },
  { timestamps: true }
);

const Offer =
  mongoose.models.Offer || mongoose.model("Offer", offerSchema);

export default Offer;
