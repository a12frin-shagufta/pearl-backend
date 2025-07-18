import Order from "../models/orderModel.js";

export const createOrder = async (req, res) => {
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
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    // 💰 Determine advance payment
    const advancePaid = paymentMethod === "cod" ? Math.round(total / 2) : total;

    const paymentStatus = paymentMethod === "cod" ? "Half Paid" : "Paid";

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
      advancePaid,
      paymentMethod,
      paymentStatus,
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ message: "Server error while placing order." });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};
