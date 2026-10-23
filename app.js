// FR Chauke Attorneys — front-end behaviour. No dependencies.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

/* ---------- physics springs (hardware-accelerated transform/opacity only) ---------- */
const STATE = new WeakMap();
function springTo(node, target, { k = 170, c = 14, m = 1 } = {}) {
  const st = STATE.get(node) || { v: { y: 0, s: 1, o: 1 }, vel: { y: 0, s: 0, o: 0 }, raf: 0 };
  STATE.set(node, st);
  cancelAnimationFrame(st.raf);
  if (reduce) { Object.assign(st.v, target); apply(node, st.v); return; }
  let last = performance.now();
  const step = now => {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    let moving = false;
    for (const key in target) {
      const f = -k * (st.v[key] - target[key]) - c * st.vel[key];
      st.vel[key] += (f / m) * dt; st.v[key] += st.vel[key] * dt;
      if (Math.abs(st.v[key] - target[key]) > .002 || Math.abs(st.vel[key]) > .01) moving = true;
      else { st.v[key] = target[key]; st.vel[key] = 0; }
    }
    apply(node, st.v);
    if (moving) st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
}
function apply(node, v) {
  node.style.transform = `translate3d(0,${v.y.toFixed(2)}px,0) scale(${v.s.toFixed(4)})`;
  node.style.opacity = Math.max(0, Math.min(1, v.o));
}
function springNumber(from, to, cb) { // same physics, one scalar
  if (reduce) return cb(to);
  let x = from, v = 0, last = performance.now();
  const step = now => {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    v += (-90 * (x - to) - 13 * v) * dt; x += v * dt; cb(x);
    if (Math.abs(x - to) > .3 || Math.abs(v) > .3) requestAnimationFrame(step); else cb(to);
  };
  requestAnimationFrame(step);
}

// tactile hover-lift on glass cards and buttons (mouse/pen only)
$$('.glass, [data-spring]').forEach(n => {
  const btn = n.matches('[data-spring]');
  n.addEventListener('pointerenter', e => e.pointerType !== 'touch' && springTo(n, { y: btn ? -3 : -7, s: btn ? 1.03 : 1.008, o: 1 }, { k: 260, c: 16 }));
  n.addEventListener('pointerleave', () => springTo(n, { y: 0, s: 1, o: 1 }, { k: 220, c: 15 }));
  n.addEventListener('pointerdown', () => btn && springTo(n, { y: 0, s: .97, o: 1 }, { k: 400, c: 22 }));
});

// staggered spring entrance
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  const i = [...e.target.parentElement.children].indexOf(e.target);
  setTimeout(() => springTo(e.target, { y: 0, s: 1, o: 1 }, { k: 120, c: 13 }), Math.min(i, 6) * 80);
}), { threshold: .12 });
$$('.rv').forEach(n => { const st = { v: { y: 36, s: .97, o: 0 }, vel: { y: 0, s: 0, o: 0 }, raf: 0 }; STATE.set(n, st); apply(n, st.v); io.observe(n); });

/* ---------- cursor-tracked border glow ---------- */
const glows = $$('.glow'); let px = 0, py = 0, queued = false;
addEventListener('pointermove', e => {
  px = e.clientX; py = e.clientY;
  if (queued) return; queued = true;
  requestAnimationFrame(() => {
    queued = false;
    for (const g of glows) {
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', px - r.left + 'px'); g.style.setProperty('--my', py - r.top + 'px');
      g.classList.toggle('near', px > r.left - 160 && px < r.right + 160 && py > r.top - 160 && py < r.bottom + 160);
    }
  });
}, { passive: true });

/* ---------- API ---------- */
const BASE = document.documentElement.dataset.api || '/api'; // set on <html data-api> in index.html
const api = async (url, opts) => {
  const r = await fetch(BASE + url.replace(/^\/api/, ''), opts && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please call us.');
  return j;
};

const OFFICES = {
  Pretoria: ['Office B90, Brooklyn Office Park', '105 Nicholson Street, Brooklyn, Pretoria, 0181', ['012 880 3156', '+27128803156'], ['Cell: 079 463 9106', '+27794639106']],
  Polokwane: ['Office No. 3, Rampie Smit Building', '41 Hans van Rensburg Street, Polokwane, 0699', ['015 880 1282', '+27158801282'], ['Cell: 064 699 7644', '+27646997644']],
};
const AREA_BLURBS = {
  'Litigation & Disputes': 'Representation and strategy when a matter is contested.',
  'Family Law': 'Divorce, maintenance, custody and related family matters.',
  'Property & Conveyancing': 'Transfers, bonds and property transactions, supported by our associated conveyancers.',
  'Labour & Employment': 'Disputes, disciplinary processes and employment contracts.',
  'Estates, Wills & Trusts': 'Drafting wills and trusts, and administering deceased estates.',
  'Commercial & Contracts': 'Agreements, company matters and business disputes.',
  'Road Accident Fund': 'Guidance on claims arising from road accidents.',
  'Other / Not sure': 'Describe your situation and we will direct you to the right attorney.',
};

let config = { offices: Object.keys(OFFICES), areas: Object.keys(AREA_BLURBS) };
let state = { office: 'Pretoria', date: '', time: '', slots: null };

function renderOffice(name) {
  const o = OFFICES[name], box = $('#addr'); box.replaceChildren(
    el('p', {}, el('b', { textContent: name })), el('p', { className: 'small', textContent: o[0] }), el('p', { className: 'small', textContent: o[1] }),
    el('p', {}, el('a', { href: 'tel:' + o[2][1], textContent: 'Tel: ' + o[2][0] })), el('p', {}, el('a', { href: 'tel:' + o[3][1], textContent: o[3][0] })));
  $$('[data-office]').forEach(b => b.setAttribute('aria-pressed', b.dataset.office === name));
  const oo = $('#openOffice'); if (oo) oo.textContent = name;
}

let shown = 0;
async function loadSlots(office, updateCounter = true) {
  const s = await api('/api/slots?office=' + encodeURIComponent(office));
  if (office === state.office) state.slots = s;
  if (updateCounter) springNumber(shown, s.open, n => { shown = n; const oc = $('#openCount'); if (oc) oc.textContent = Math.round(n); });
  return s;
}

async function init() {
  try { config = await api('/api/config'); } catch {}
  for (const id of ['#bookArea', '#msgArea']) $(id).replaceChildren(el('option', { value: '', textContent: 'Select (optional)' }), ...config.areas.map(a => el('option', { value: a, textContent: a })));
  $('#bookOffice').replaceChildren(...config.offices.map(o => el('option', { value: o, textContent: o })));
  $('#chips').replaceChildren(...config.areas.map(a => el('button', { className: 'chip', type: 'button', textContent: a, ariaPressed: 'false' })));
  $('#areaCards').replaceChildren(...config.areas.map((a, i) => {
    const c = el('article', { className: 'glass glow rv' }, el('span', { className: 'spot' }), el('div', { className: 'ic', textContent: String(i + 1).padStart(2, '0') }), el('h3', { textContent: a }), el('p', { textContent: AREA_BLURBS[a] || '' }));
    return c;
  }));
  // new nodes: wire up glow, hover, entrance
  $$('#areaCards .glow').forEach(g => glows.push(g));
  $$('#areaCards .glass').forEach((n, i) => {
    n.addEventListener('pointerenter', e => e.pointerType !== 'touch' && springTo(n, { y: -7, s: 1.008, o: 1 }, { k: 260, c: 16 }));
    n.addEventListener('pointerleave', () => springTo(n, { y: 0, s: 1, o: 1 }, { k: 220, c: 15 }));
    STATE.set(n, { v: { y: 36, s: .97, o: 0 }, vel: { y: 0, s: 0, o: 0 }, raf: 0 }); apply(n, STATE.get(n).v); io.observe(n);
  });
  renderOffice('Pretoria');
  await loadSlots('Pretoria').then(renderDays).catch(() => { const oc = $('#openCount'); if (oc) oc.textContent = '–'; });
}

/* ---------- bento interactions ---------- */
$$('[data-office]').forEach(b => b.addEventListener('click', async () => {
  state.office = b.dataset.office; renderOffice(state.office); $('#bookOffice').value = state.office;
  try { await loadSlots(state.office); renderDays(); } catch {}
}));
$('#chips').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  $$('.chip').forEach(x => x.setAttribute('aria-pressed', x === c));
  $('#bookArea').value = $('#msgArea').value = c.textContent;
  $('#contact').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
});
$('#urgent').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
  e.currentTarget.setAttribute('aria-checked', on);
  $('#urgentOut').textContent = on
    ? 'Please call us directly rather than waiting for a booking: Pretoria 012 880 3156 · Polokwane 015 880 1282 · Cell 079 463 9106.'
    : 'Not urgent — book a slot below and we will confirm by phone or email.';
});

/* ---------- terminal preview ---------- */
(async function terminal() {
  const out = $('#termOut'), sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const lines = [
    ['p', '$ ', 'frc consultation --office pretoria'],
    ['', '  ', 'Connecting you to an attorney…'],
    ['ok', '✓ ', 'Matter type captured: Family Law'],
    ['ok', '✓ ', 'Conflict check: clear'],
    ['ok', '✓ ', 'Slot held: Tue 10:00'],
    ['g', '→ ', 'Confirmation sent by email & phone'],
  ];
  if (!out || !$('#term')) return;   // card removed from the page: nothing to animate
  await new Promise(r => new IntersectionObserver((e, o) => e[0].isIntersecting && (o.disconnect(), r()), { threshold: .4 }).observe($('#term')));
  const cur = el('span', { className: 'cur' });
  for (const [cls, pre, txt] of lines) {
    const line = el('div', {}, el('span', { className: cls, textContent: pre })), t = el('span');
    line.append(t, cur); out.append(line);
    if (cls === 'p') for (const ch of txt) { t.textContent += ch; await sleep(38); } else { t.textContent = txt; await sleep(420); }
    cur.remove();
  }
  out.lastChild.append(cur);
})();

/* ---------- booking form ---------- */
$$('[data-tab]').forEach(b => b.addEventListener('click', () => {
  $$('[data-tab]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('#bookForm').hidden = b.dataset.tab !== 'book'; $('#msgForm').hidden = b.dataset.tab !== 'msg';
}));
$('#bookOffice').addEventListener('change', async e => {
  state.office = e.target.value; state.date = state.time = ''; renderOffice(state.office);
  try { await loadSlots(state.office); renderDays(); } catch {}
});

function renderDays() {
  const s = state.slots; if (!s) return;
  $('#days').replaceChildren(...s.days.map(d => {
    const dt = new Date(d.date + 'T12:00:00Z'), free = d.times.some(t => t.open);
    const b = el('button', { type: 'button', className: 'day', disabled: !free, ariaPressed: String(state.date === d.date) },
      el('small', { textContent: dt.toLocaleDateString('en-ZA', { weekday: 'short', timeZone: 'UTC' }) }), dt.getUTCDate() + ' ' + dt.toLocaleDateString('en-ZA', { month: 'short', timeZone: 'UTC' }));
    b.addEventListener('click', () => { state.date = d.date; state.time = ''; renderDays(); });
    return b;
  }));
  const day = s.days.find(d => d.date === state.date);
  $('#times').replaceChildren(...(day ? day.times : []).map(t => {
    const b = el('button', { type: 'button', className: 'time', textContent: t.time, disabled: !t.open, ariaPressed: String(state.time === t.time) });
    b.addEventListener('click', () => { state.time = t.time; renderDays(); });
    return b;
  }));
}

function wire(form, msg, endpoint, extra) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const out = $(msg), btn = $('button[type=submit]', form);
    const body = Object.fromEntries(new FormData(form)); Object.assign(body, extra ? extra() : {});
    if (extra && (!body.date || !body.time)) { out.className = 'msg err'; out.textContent = 'Please choose a day and a time.'; return; }
    btn.disabled = true; out.className = 'msg'; out.textContent = 'Sending…';
    try {
      const r = await api(endpoint, body);
      form.replaceChildren(el('div', { className: 'success' }, el('div', { className: 'sky', textContent: 'Received' }), el('div', { className: 'big', textContent: r.ref }),
        el('p', { className: 'lead', style: 'margin:auto', textContent: extra ? `Your slot is held for ${body.date} at ${body.time} (${body.office}). We will contact you to confirm.` : 'Thank you — an attorney will contact you shortly.' })));
      if (extra) loadSlots(state.office).catch(() => {});
    } catch (err) {
      out.className = 'msg err'; out.textContent = err.message; btn.disabled = false;
      if (extra) loadSlots(state.office).then(renderDays).catch(() => {});
    }
  });
}
wire($('#bookForm'), '#bookMsg', '/api/consultations', () => ({ date: state.date, time: state.time, office: $('#bookOffice').value }));
wire($('#msgForm'), '#msgMsg', '/api/contact');

/* ---------- day / night toggle ---------- */
const root = document.documentElement, themeBtn = $('#theme'), meta = $('meta[name=theme-color]');
function setTheme(t, save) {
  root.dataset.theme = t;
  themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to night mode' : 'Switch to day mode');
  if (meta) meta.content = t === 'light' ? '#eef4f9' : '#01182a';
  if (save) try { localStorage.setItem('frc_theme', t); } catch {}
}
let saved = null; try { saved = localStorage.getItem('frc_theme'); } catch {}
setTheme(saved === 'light' || saved === 'dark' ? saved : root.dataset.theme, false);
themeBtn.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true));

/* ---------- mobile menu ---------- */
const menu = $('#mobile'), menuBtn = $('#menuBtn');
const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
menuBtn.addEventListener('click', () => { menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
menu.addEventListener('click', e => e.target.closest('a') && closeMenu());
addEventListener('keydown', e => e.key === 'Escape' && closeMenu());

$('#yr').textContent = new Date().getFullYear();
init();
