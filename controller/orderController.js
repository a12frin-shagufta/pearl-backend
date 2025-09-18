// controllers/orderController.js
import path from "path";
import fs from "fs";
import Order from "../models/orderModel.js";

// Create manual order
export const createManualOrder = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      note,
      paymentMethod,
      items,
      subtotal,
      shipping,
      total,
      advanceRequired,
      paymentInstructions,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart empty" });
    }

    const order = new Order({
      name,
      phone,
      email,
      address,
      city,
      state,
      note,
      items,
      subtotal,
      shipping,
      total,
      advanceRequired,
      paymentMethod: paymentMethod || "cod",
      paymentInstructions: paymentInstructions || {},
      paymentStatus: paymentMethod === "cod" ? "Half Paid" : "Pending",
    });

    await order.save();
    return res.status(201).json({ success: true, message: "Order created", orderId: order._id });
  } catch (err) {
    console.error("create-manual error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Upload proof for order (bank/jazz)
export const uploadProof = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // ensure uploads folder is served statically from /uploads in server
    const fileUrl = `/uploads/${req.file.filename}`;
    order.paymentProofs.push({ url: fileUrl, filename: req.file.filename });
    await order.save();

    // TODO: notify admin (email/push) here if you want
    return res.json({ success: true, message: "Proof uploaded", fileUrl });
  } catch (err) {
    console.error("upload-proof error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: confirm/reject/mark-half payment
export const adminUpdatePayment = async (req, res) => {
  try {
    const { orderId, action } = req.body; // action: 'confirm' | 'mark-half' | 'reject'
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (action === "confirm") {
      order.paymentStatus = "Paid";
      order.advancePaid = order.advanceRequired;
    } else if (action === "mark-half") {
      order.paymentStatus = "Half Paid";
      order.advancePaid = order.advanceRequired; // you may adjust rules here
    } else if (action === "reject") {
      order.paymentStatus = "Rejected";
    } else {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    await order.save();
    return res.json({ success: true, message: "Order updated", paymentStatus: order.paymentStatus });
  } catch (err) {
    console.error("adminUpdatePayment error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all orders (for admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.json({ success: true, orders });
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
