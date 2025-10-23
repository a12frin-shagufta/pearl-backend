// controllers/orderController.js
import path from "path";
import fs from "fs";
import Order from "../models/orderModel.js";
import { sendEmail } from "../utils/SendEmail.js";
import cloudinary from "../config/cloudinary.js"


// Create manual order
// Create manual order
export const createManualOrder = async (req, res) => {
  try {
    const {
      name, phone, email, address, city, state, note,
      paymentMethod, items, subtotal, shipping, total,
      advanceRequired, transactionRef, senderLast4, paymentInstructions,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart empty" });
    }

    const safeItems = items.map(it => ({
      productId: it.productId,
      key: it.key,
      name: it.name,
      image: it.image,
      variant: it.variant || "",
      variantColor: (it.variantColor || "").trim(),
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      total: Number(it.total || 0),
    }));

    const order = new Order({
      name, phone, email, address, city, state, note,
      items: safeItems,
      subtotal, shipping, total,
      transactionRef, senderLast4,
      advanceRequired,
      paymentMethod: paymentMethod || "cod",
      paymentInstructions: paymentInstructions || {},
      paymentStatus: paymentMethod === "cod" ? "Half Paid" : "Pending",
    });

    await order.save();

    // ✅ Send email NON-BLOCKING (doesn't slow API)
    sendEmail({
      to: email,
      subject: "Order Confirmation",
      html: `
        <h2>Thank you for your order!</h2>
        <p>Order ID: <strong>${order._id}</strong></p>
        <p>Total: ${order.total}</p>
        <p>We will contact you soon to confirm your payment.</p>
      `
    }).catch(err => {
      console.error("sendEmail error:", err.message);
    });

    // ✅ Send response immediately so frontend doesn’t timeout!
    return res.status(201).json({
      success: true,
      message: "Order created",
      orderId: order._id
    });

  } catch (err) {
    console.error("create-manual error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Upload proof for order (bank/jazz)
// controllers/orderController.js
export const uploadProof = async (req, res) => {
  try {
    const { orderId, transactionRef, senderLast4 } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Upload to Cloudinary
    console.log("[uploadProof] Uploading to Cloudinary:", { orderId, filename: req.file.originalname });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "auto", folder: "payment_proofs" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    if (!cloudinary?.uploader?.upload_stream) {
  console.error("[uploadProof] cloudinary instance invalid:", cloudinary);
  return res.status(500).json({ success:false, message:"Cloudinary not initialized" });
}


    // Save proof to order
    const absoluteUrl = result.secure_url;
    order.paymentProofs.push({ url: absoluteUrl, filename: req.file.originalname });
    if (transactionRef) order.transactionRef = transactionRef;
    if (senderLast4) order.senderLast4 = senderLast4;
    if (!order.paymentStatus || order.paymentStatus === "Pending") {
      order.paymentStatus = "Pending";
    }
    await order.save();

    console.log("[uploadProof] Success:", { fileUrl: absoluteUrl, orderId });

    return res.json({
      success: true,
      message: "Proof uploaded",
      fileUrl: absoluteUrl,
      orderId: order._id,
    });
  } catch (err) {
    console.error("[uploadProof] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};


// Admin: confirm/reject/mark-half payment
// controllers/orderController.js (replace adminUpdatePayment)
// controllers/orderController.js
export const adminUpdatePayment = async (req, res) => {
  try {
    const { orderId, action, reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const adminId = (req.user?.id) || (req.admin?.id) || req.userId || "system";
    const adminName = (req.user?.name) || (req.admin?.name) || "Admin";

    let emailSubject = "", emailHtml = "";

    if (action === "confirm") {
      order.paymentStatus = "Paid";
      order.advancePaid = order.advanceRequired || order.total || 0;
      emailSubject = "Order Accepted — Payment confirmed";
      emailHtml = `
        <h3>Order Accepted</h3>
        <p>Dear ${order.name || "Customer"},</p>
        <p>Your payment for <strong>${order._id}</strong> was verified.</p>
        <p><strong>Amount received:</strong> ${order.advancePaid || "—"}</p>
      `;
    } else if (action === "mark-half") {
      order.paymentStatus = "Half Paid";
      order.advancePaid = order.advanceRequired || Math.round((order.total || 0) / 2);
      const remaining = (order.total || 0) - (order.advancePaid || 0);
      emailSubject = "Deposit Received — Order Confirmed";
      emailHtml = `
        <h3>Deposit Received</h3>
        <p>Dear ${order.name || "Customer"},</p>
        <p>We received your deposit for <strong>${order._id}</strong>.</p>
        <p><strong>Deposit:</strong> ${order.advancePaid} — <strong>Remaining COD:</strong> ${remaining}</p>
      `;
    } else if (action === "reject") {
      order.paymentStatus = "Rejected";
      if (reason) {
        order.note = (order.note ? order.note + "\n\n" : "") + `Admin rejection reason: ${reason}`;
      }
      emailSubject = "Payment Rejected — Please Try Again";
      emailHtml = `
        <h3>Payment Rejected</h3>
        <p>Dear ${order.name || "Customer"},</p>
        <p>We found an issue while verifying your payment for <strong>${order._id}</strong>.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
      `;
    } else {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    // record history
    order.actionsHistory.push({ action, adminId, adminName, reason: reason || "", at: new Date() });

    await order.save();

    // 🔥 fire-and-forget emails so request doesn't block
    sendEmail({ to: order.email, subject: emailSubject, html: emailHtml })
      .catch(err => console.error("adminUpdatePayment: customer email failed:", err?.message || err));

    if (process.env.ADMIN_EMAIL) {
      sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `Admin action ${action} — Order ${order._id}`,
        html: `
          <p>${adminName} performed <strong>${action}</strong> on Order <strong>${order._id}</strong>.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        `
      }).catch(err => console.error("adminUpdatePayment: admin email failed:", err?.message || err));
    }

    // ✅ respond immediately
    return res.json({ success: true, message: "Order updated", paymentStatus: order.paymentStatus, order });

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