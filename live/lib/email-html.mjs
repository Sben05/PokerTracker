const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Deliberately plain: personal-looking mail lands in inboxes far more often than designed templates.
export function emailHtml(subject, body) {
 const lines = String(body).split('\n').map(line => {
  const detail = line.match(/^Details: (https:\/\/\S+)$/);
  if (detail) return `<a href="${esc(detail[1])}" style="color:#1a5c3a">View details</a>`;
  const indented = line.match(/^ {2}(.*)$/);
  if (indented) return `&nbsp;&nbsp;&nbsp;&bull; ${esc(indented[1])}`;
  return esc(line);
 });
 return `<div style="font:15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222;max-width:520px">${lines.join('<br>')}</div>`;
}
