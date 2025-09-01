import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    subcategories: {
      type: [String],   // <-- add subcategories
      default: [],      // <-- always an array
    },
  },
  {
    timestamps: true,
  }
);

const categoryModel = mongoose.models.Category || mongoose.model("Category", categorySchema);
export default categoryModel;
