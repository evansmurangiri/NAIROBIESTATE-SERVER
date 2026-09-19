import nodemailer from "nodemailer";

// Falls back to console logging when SMTP isn't configured so local dev never
// fails just because email isn't set up.
export default async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log("---- EMAIL (not sent, SMTP unconfigured) ----");
    console.log({ to, subject, text });
    console.log("--------------------------------------------");
    return { queued: false, logged: true };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "Nairobi Estate <no-reply@nairobiestate.com>",
    to, subject, text, html,
  });
  return { queued: true };
}
