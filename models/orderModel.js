import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    address: String,
    city: String,
    state: String,
    note: String,

    items: [
      {
        productId: String,
        name: String,
        image: [String],
        quantity: Number,
        unitPrice: Number,
        total: Number,
      },
    ],

    subtotal: Number,
    shipping: Number,
    total: Number,
    advancePaid: Number,

    paymentMethod: {
      type: String,
      enum: ["payfast", "cod"],
    },

    paymentStatus: {
      type: String,
      enum: ["Paid", "Half Paid", "Pending"],
      default: "Pending",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
