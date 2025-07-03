import Contact from "../models/contactModel.js";
import nodemailer from "nodemailer";

// Configure transporter (replace with your Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "shagufta7572@gmail.com",         // 👈 your Gmail
    pass: "ybnz mzjy baxv pvpb",           // 👈 Gmail App Password (not your Gmail login password)
  },
});

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Save to DB
    const newMessage = new Contact({ name, email, message });
    await newMessage.save();

    // Send Email
    await transporter.sendMail({
      from: `"Pleasant Pearl Website" <yourgmail@gmail.com>`,
      to: "yourgmail@gmail.com", // 👈 your receiving email
      subject: "New Contact Form Submission",
      html: `
        <h3>New Message from Pleasant Pearl</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    });

    res.status(201).json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
