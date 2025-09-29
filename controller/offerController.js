// controllers/offerController.js
import Offer from "../models/offerModel.js";
import Category from "../models/categoryModel.js";
import mongoose from "mongoose";

// controllers/offerController.js
export const createOffer = async (req, res) => {
  try {
    const {
      code,
      description,
      expiresAt,
      categories = [],
      applyToSubcategories = false,
      discountRules = [], // 👈 from frontend
    } = req.body;

    if (!discountRules.length) {
      return res.status(400).json({
        success: false,
        message: "At least one discount rule is required",
      });
    }

    // validate category ids
    const validCategoryIds = [];
    for (const c of categories) {
      if (mongoose.Types.ObjectId.isValid(c)) validCategoryIds.push(c);
    }

    const newOffer = new Offer({
      code,
      description,
      expiresAt,
      categories: validCategoryIds,
      applyToSubcategories,
      discountRules,
    });

    await newOffer.save();
    res.status(201).json({
      success: true,
      message: "Offer created",
      offer: newOffer,
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active offers.
 * Optional query params:
 *   ?categoryId=<id>  -> returns offers that are global OR specifically include that category
 */
export const getActiveOffers = async (req, res) => {
  try {
    const { categoryId } = req.query;

    // basic: find all active offers, then filter in-memory
    // OR build Mongo query to match offers with empty categories or category included
    let query = { active: true };

    if (categoryId) {
      // match offers where categories array is empty OR includes the given categoryId
      query = {
        active: true,
        $or: [
          { categories: { $exists: true, $size: 0 } }, // global offers
          { categories: mongoose.Types.ObjectId.isValid(categoryId) ? mongoose.Types.ObjectId(categoryId) : null }
        ]
      };
    }

    // populate categories for admin UI convenience
    const offers = await Offer.find(query).populate("categories", "name");
    res.status(200).json({ success: true, offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const deleted = await Offer.findByIdAndDelete(offerId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }
    res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
