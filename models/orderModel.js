// models/orderModel.js
import mongoose from "mongoose";

const actionSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g. "confirm", "mark-half", "reject", "proof-upload"
  adminId: { type: String },                // optional: admin user id or email
  adminName: { type: String },
  reason: { type: String },
  at: { type: Date, default: Date.now },
});

const proofSchema = new mongoose.Schema({
  url: String,
  filename: String,
  uploadedAt: { type: Date, default: Date.now },
});

const itemSchema = new mongoose.Schema({
  productId: String,
  key: String, // productId_variant
  name: String,
  image: String,
  variant: String,
  quantity: Number,
  unitPrice: Number,
  total: Number,
});

const orderSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    address: String,
    city: String,
    state: String,
    note: String,

    items: [itemSchema],

    subtotal: Number,
    shipping: Number,
    total: Number,
    advanceRequired: Number,
    advancePaid: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      enum: ["cod", "bank", "jazz"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Half Paid", "Paid", "Rejected"],
      default: "Pending",
    },

    transactionRef: { type: String },
    senderLast4: { type: String },

    paymentProofs: [proofSchema],
    paymentInstructions: mongoose.Schema.Types.Mixed,

    // <-- new
    actionsHistory: { type: [actionSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
