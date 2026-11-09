// Envío de correos vía API HTTP de Resend (Render free bloquea SMTP).
// Sin RESEND_API_KEY, los correos se imprimen en consola (modo local).
const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM || 'MisQR <no-reply@misqr.online>';
export const APP_URL = (process.env.APP_URL || 'https://misqr.online').replace(/\/+$/, '');
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:24px;background:#fdf9f1;font-family:Arial,sans-serif;color:#1c1c17;">
  <div style="max-width:520px;margin:0 auto;background:#f1ede5;border-radius:8px;padding:28px;">
    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.12em;color:#871919;font-weight:bold;text-transform:uppercase;">MisQR · Bitácora de control</div>
    <h2 style="font-family:'Courier New',monospace;margin:8px 0 16px;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <p style="font-size:12px;color:#605e5a;margin-top:24px;"><a href="${APP_URL}" style="color:#871919;">${APP_URL.replace(/^https?:\/\//, '')}</a></p>
  </div></body></html>`;
}

export async function sendMail({ to, subject, html, text }) {
  if (!to) return false;
  if (!API_KEY) {
    console.log(`\n[correo simulado] Para: ${to}\nAsunto: ${subject}\n${text || html}\n`);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text })
    });
    if (!res.ok) {
      console.error('Resend error:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Resend error:', e.message);
    return false;
  }
}
