const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function publicUrl() {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
}

async function sendMail({ to, subject, text, html }) {
  const smtp = getTransporter();
  if (!smtp) {
    // Development fallback so the project stays usable without SMTP credentials
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`\n[EMAIL NOT SENT: SMTP_HOST is not configured]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    }
    return false;
  }
  await smtp.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return true;
}

function button(link, label) {
  return `<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#1DB954;color:#121212;border-radius:24px;text-decoration:none;font-weight:bold">${label}</a></p><p style="color:#666;font-size:12px">${link}</p>`;
}

function sendVerificationEmail(to, rawToken) {
  const link = `${publicUrl()}/api/verify/${rawToken}`;
  return sendMail({
    to,
    subject: 'Activate your Music Room account',
    text: `Welcome to Music Room!\n\nOpen this link to activate your account (valid 24 hours):\n${link}\n`,
    html: `<p>Welcome to Music Room!</p><p>Activate your account (the link is valid 24 hours):</p>${button(link, 'Activate my account')}`,
  });
}

function sendResetEmail(to, rawToken) {
  const link = `${publicUrl()}/api/reset-password/${rawToken}`;
  return sendMail({
    to,
    subject: 'Reset your Music Room password',
    text: `Someone asked to reset your Music Room password.\n\nOpen this link to choose a new one (valid 1 hour):\n${link}\n\nIf it wasn't you, ignore this email.\n`,
    html: `<p>Someone asked to reset your Music Room password.</p>${button(link, 'Choose a new password')}<p>The link is valid 1 hour. If it wasn't you, ignore this email.</p>`,
  });
}

module.exports = { sendVerificationEmail, sendResetEmail, publicUrl };
