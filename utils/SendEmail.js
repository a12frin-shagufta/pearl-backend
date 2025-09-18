import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "Shop"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("sendEmail error:", err);
    throw err;
  }
};
