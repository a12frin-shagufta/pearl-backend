import Offer from "../models/offerModel.js";

export const createOffer = async (req, res) => {
  try {
    const { code, discountPercentage, description, expiresAt } = req.body;

    const newOffer = new Offer({
      code,
      discountPercentage,
      description,
      expiresAt
    });

    await newOffer.save();
    res.status(201).json({ success: true, message: "Offer created", offer: newOffer });
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ active: true });
    res.status(200).json({ success: true, offers });
  } catch (error) {
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

