const $ = s => document.querySelector(s);
const el = (t, p = {}, ...k) => { const n = Object.assign(document.createElement(t), p); n.append(...k); return n; };
const STATUSES = ['new', 'contacted', 'confirmed', 'closed', 'cancelled'];
const BASE = document.documentElement.dataset.api || '/api';
let token = sessionStorage.getItem('frc_token') || '';

async function call(path, opts = {}) {
  const r = await fetch(BASE + path.replace(/^\/api/, ''), { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
  if (r.status === 401) { token = prompt('Admin token') || ''; sessionStorage.setItem('frc_token', token); if (!token) throw new Error('no token'); return call(path, opts); }
  return r;
}
async function load() {
  const rows = await (await call('/api/admin/enquiries')).json();
  $('#count').textContent = rows.length + ' record(s)';
  $('#rows').replaceChildren(...rows.map(r => {
    const sel = el('select', {}, ...STATUSES.map(s => el('option', { value: s, textContent: s, selected: s === r.status })));
    sel.onchange = () => call('/api/admin/enquiries/' + r.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
    return el('tr', {},
      el('td', { textContent: 'FRC-' + String(r.id).padStart(5, '0') }), el('td', {}, el('span', { className: 'k', textContent: r.kind })),
      el('td', {}, el('b', { textContent: r.name }), el('br'), el('a', { href: 'mailto:' + r.email, textContent: r.email }), el('br'), el('a', { href: 'tel:' + r.phone, textContent: r.phone })),
      el('td', { textContent: [r.area, r.message].filter(Boolean).join(' — ') }),
      el('td', { textContent: r.slot_date ? `${r.slot_date} ${r.slot_time} · ${r.office}` : r.office || '' }),
      el('td', { textContent: r.created_at }), el('td', {}, sel));
  }));
}
$('#csv').onclick = async () => { const b = await (await call('/api/admin/export.csv')).blob(); const a = el('a', { href: URL.createObjectURL(b), download: 'enquiries.csv' }); a.click(); };
$('#out').onclick = () => { sessionStorage.removeItem('frc_token'); location.reload(); };
load().catch(e => $('#count').textContent = e.message);
