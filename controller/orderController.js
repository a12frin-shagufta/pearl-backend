// controllers/orderController.js
import path from "path";
import fs from "fs";
import Order from "../models/orderModel.js";
import { sendEmail } from "../utils/SendEmail.js";


// Create manual order
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
      transactionRef,   // ✅ take from req.body
      senderLast4,
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
      transactionRef,   // ✅ save it
      senderLast4, 
      advanceRequired,
      paymentMethod: paymentMethod || "cod",
      paymentInstructions: paymentInstructions || {},
      paymentStatus: paymentMethod === "cod" ? "Half Paid" : "Pending",
    });

    await order.save();

    // ✉️ Send confirmation email
    try {
      await sendEmail({
        to: email,
        subject: "Order Confirmation",
        html: `
          <h2>Thank you for your order!</h2>
          <p>Order ID: <strong>${order._id}</strong></p>
          <p>Total: ${order.total}</p>
          <p>We will contact you soon to confirm your payment.</p>
        `
      });
    } catch (mailErr) {
      console.error("Failed to send email:", mailErr);
    }

    // ✅ Respond AFTER sending email
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
export const uploadProof = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // ensure uploads folder is served statically from /uploads in server
    const fileUrl = `/uploads/${req.file.filename}`;
    order.paymentProofs.push({ url: fileUrl, filename: req.file.filename });
    // also update transactionRef / senderLast4 if passed in form-data
    if (req.body.transactionRef) order.transactionRef = req.body.transactionRef;
    if (req.body.senderLast4) order.senderLast4 = req.body.senderLast4;
    // set paymentStatus to PendingReview (optional) or keep as-is: we'll keep "Pending"
    order.paymentStatus = "Pending";
    await order.save();

    // Notify customer that proof is received and under review
    try {
      await sendEmail({
        to: order.email,
        subject: "Payment Proof Received — We are verifying",
        html: `
          <h3>Payment proof received</h3>
          <p>Dear ${order.name || "Customer"},</p>
          <p>We have received your payment proof for Order <strong>${order._id}</strong>. Our team will verify the proof and update you shortly.</p>
          <p>If everything is fine, your order will be confirmed. If there is an issue, we may ask you to re-send proof or correct details.</p>
          <p>Thank you for shopping with <strong>Your Company Name</strong>.</p>
        `
      });
    } catch (mailErr) {
      console.error("uploadProof: failed to send customer email:", mailErr);
    }

    // Optional: notify admin (if you have ADMIN_EMAIL set)
    if (process.env.ADMIN_EMAIL) {
      try {
        await sendEmail({
          to: process.env.ADMIN_EMAIL,
          subject: `Payment proof uploaded — Order ${order._id}`,
          html: `
            <p>Payment proof uploaded for Order <strong>${order._id}</strong>.</p>
            <p>Customer: ${order.name} (${order.email})</p>
            <p>Transaction Ref: ${order.transactionRef || "—"}</p>
            <p>Sender last4: ${order.senderLast4 || "—"}</p>
            <p><a href="${process.env.SITE_URL || ''}/admin/orders/${order._id}">Open order in admin panel</a></p>
          `
        });
      } catch (adminMailErr) {
        console.error("uploadProof: failed to send admin email:", adminMailErr);
      }
    }

    return res.json({ success: true, message: "Proof uploaded", fileUrl });
  } catch (err) {
    console.error("upload-proof error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin: confirm/reject/mark-half payment
// controllers/orderController.js (replace adminUpdatePayment)
export const adminUpdatePayment = async (req, res) => {
  try {
    const { orderId, action, reason } = req.body; // optional reason for reject
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // admin info (if your auth middleware sets req.user / req.admin)
    const adminId = (req.user && req.user.id) || (req.admin && req.admin.id) || (req.userId) || "system";
    const adminName = (req.user && req.user.name) || (req.admin && req.admin.name) || "Admin";

    let emailSubject = "";
    let emailHtml = "";

    if (action === "confirm") {
      order.paymentStatus = "Paid";
      order.advancePaid = order.advanceRequired || order.total || 0;

      emailSubject = "Order Accepted — Payment confirmed";
      emailHtml = `
        <h3>Order Accepted</h3>
        <p>Dear ${order.name || "Customer"},</p>
        <p>Good news — your payment for Order <strong>${order._id}</strong> has been verified and your order is accepted by <strong>${process.env.COMPANY_NAME || "Our Team"}</strong>.</p>
        <p><strong>Amount received:</strong> ${order.advancePaid || "—"}</p>
        <p>We will prepare and ship your order shortly. Thank you!</p>
      `;
    } else if (action === "mark-half") {
      order.paymentStatus = "Half Paid";
      order.advancePaid = order.advanceRequired || Math.round((order.total || 0) / 2);

      const remaining = (order.total || 0) - (order.advancePaid || 0);

      emailSubject = "Deposit Received — Order Confirmed (COD remaining)";
      emailHtml = `
        <h3>Deposit Received</h3>
        <p>Dear ${order.name || "Customer"},</p>
        <p>We have received the deposit for Order <strong>${order._id}</strong>. Your order is confirmed.</p>
        <p><strong>Deposit paid:</strong> ${order.advancePaid}</p>
        <p><strong>Remaining to pay on delivery (COD):</strong> ${remaining}</p>
        <p>Thank you for shopping with <strong>${process.env.COMPANY_NAME || "Our Team"}</strong>.</p>
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
  <p>Unfortunately, we found an issue while verifying your payment for Order <strong>${order._id}</strong>.</p>
  <p>Please review your payment details or uploaded screenshot and try again. ${
    reason ? `<br><strong>Reason:</strong> ${reason}` : ""
  }</p>
  <p>Our team is available to assist you if you need help. Thank you.</p>
`;

    } else {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    // push action into history
    order.actionsHistory.push({
      action,
      adminId,
      adminName,
      reason: reason || "",
      at: new Date(),
    });

    await order.save();

    // non-blocking email
    try {
      await sendEmail({
        to: order.email,
        subject: emailSubject,
        html: emailHtml,
      });
    } catch (mailErr) {
      console.error("adminUpdatePayment: failed to send email:", mailErr);
    }

    // optionally notify admin email (if configured)
    if (process.env.ADMIN_EMAIL) {
      try {
        await sendEmail({
          to: process.env.ADMIN_EMAIL,
          subject: `Admin action ${action} — Order ${order._id}`,
          html: `
            <p>Admin <strong>${adminName}</strong> performed action <strong>${action}</strong> on Order <strong>${order._id}</strong>.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
            <p><a href="${process.env.SITE_URL || ''}/admin/orders/${order._id}">Open order</a></p>
          `,
        });
      } catch (adminMailErr) {
        console.error("adminUpdatePayment: failed to notify admin email:", adminMailErr);
      }
    }

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
