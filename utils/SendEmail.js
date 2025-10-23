// utils/SendEmail.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const fromEmail =
      process.env.EMAIL_FROM_EMAIL || "pleasantpearl@resend.dev";

    const data = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || "Pleasant Pearl"} <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", data);
    return true;
  } catch (err) {
    console.error("❌ Email send failed:", err);
    return false;
  }
};
