// utils/SendEmail.js
import nodemailer from "nodemailer";

const SEND_EMAILS = String(process.env.SEND_EMAILS || "").toLowerCase() === "true";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 465, // 465 works best with Gmail servers
  secure: true, // true for 465 SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 20000, // 20 seconds
  socketTimeout: 20000,
});

/**
 * Send email safely without crashing server
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!SEND_EMAILS) {
    console.log("[EMAIL] Skipped (SEND_EMAILS=false)", { to, subject });
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || "Pleasant Pearl"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("[EMAIL SENT]", info.messageId);
    return { success: true, info };
  } catch (err) {
    console.error("[EMAIL ERROR]", err.message);
    return { success: false, error: err.message };
  }
};
