// utils/SendEmail.js
import nodemailer from "nodemailer";

// toggle with .env
const SEND_EMAILS = String(process.env.SEND_EMAILS || "").toLowerCase() === "true";
const USE_RESEND  = !!process.env.RESEND_API_KEY;

// ---- RESEND sender (HTTPS, no SMTP) ----
async function sendWithResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = `${process.env.EMAIL_FROM_NAME || "Pleasant Pearl"} <${process.env.EMAIL_USER}>`; // can be any verified sender
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status} ${res.statusText} — ${body}`);
  }
  const data = await res.json().catch(() => ({}));
  console.log("[EMAIL SENT via Resend]", data?.id || "");
  return { success: true, info: data };
}

// ---- GMAIL SMTP sender (fallback) ----
function buildSmtpTransport({ port, secure }) {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port,
    secure, // 465 -> true, 587 -> false
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 20000,
    socketTimeout: 20000,
  });
}

async function sendWithGmail({ to, subject, html, text }) {
  // try 465 (SSL) first, then 587 (STARTTLS)
  const attempts = [
    { port: Number(process.env.EMAIL_PORT) || 465, secure: true },
    { port: 587, secure: false },
  ];

  const from = `"${process.env.EMAIL_FROM_NAME || "Pleasant Pearl"}" <${process.env.EMAIL_USER}>`;
  let lastErr;
  for (const a of attempts) {
    try {
      const transporter = buildSmtpTransport(a);
      const info = await transporter.sendMail({ from, to, subject, html, text });
      console.log(`[EMAIL SENT via SMTP ${a.port}]`, info.messageId);
      return { success: true, info };
    } catch (e) {
      lastErr = e;
      console.error(`[EMAIL ERROR on SMTP ${a.port}]`, e?.code || e?.message || e);
    }
  }
  throw lastErr || new Error("SMTP failed");
}

// ---- Public function your controllers call ----
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!SEND_EMAILS) {
    console.log("[EMAIL] Skipped (SEND_EMAILS=false)", { to, subject });
    return { skipped: true };
  }
  if (!to) {
    console.warn("[EMAIL] Skipped — missing recipient");
    return { skipped: true };
  }

  try {
    if (USE_RESEND) {
      return await sendWithResend({ to, subject, html, text });
    }
    return await sendWithGmail({ to, subject, html, text });
  } catch (err) {
    console.error("[EMAIL FINAL ERROR]", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
};
