const crypto = require('crypto');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLE = `
body { font-family: -apple-system, system-ui, sans-serif; background:#121212; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:16px; box-sizing:border-box; }
.card { background:#282828; padding:32px; border-radius:12px; width:100%; max-width:360px; box-sizing:border-box; }
h2 { margin-top:0; }
p { line-height:1.5; color:#B3B3B3; }
input { width:100%; padding:12px; margin-top:8px; margin-bottom:16px; border-radius:8px; border:none; box-sizing:border-box; font-size:16px; }
button { width:100%; padding:14px; border:none; border-radius:24px; background:#1DB954; color:#121212; font-weight:bold; font-size:16px; }
button:focus-visible, input:focus-visible { outline:3px solid #fff; outline-offset:2px; }
.msg { font-weight:bold; color:#fff; min-height:1.5em; }
`;

// Sends a small standalone HTML page (email links) with a strict,
// nonce-based Content-Security-Policy instead of disabling it.
function sendPage(res, status, { title, message = '', body = '', script = '' }) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  );
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
<main class="card">
<h2>${escapeHtml(title)}</h2>
${message ? `<p>${escapeHtml(message)}</p>` : ''}
${body}
</main>
${script ? `<script nonce="${nonce}">${script}</script>` : ''}
</body>
</html>`);
}

module.exports = { escapeHtml, sendPage };
