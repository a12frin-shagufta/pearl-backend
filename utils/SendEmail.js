// utils/SendEmail.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const fromEmail = `${process.env.EMAIL_FROM_NAME || "Pleasant Pearl"} <${process.env.EMAIL_FROM_EMAIL}>`;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("❌ Email failed:", error);
      return false;
    }

    console.log("✅ Email sent successfully:", data);
    return true;
  } catch (err) {
    console.error("❌ Email error:", err);
    return false;
  }
};
