/* ROASOD UI effects: cursor glow, beam borders, spring hover, bento widgets, command palette. */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    /* ---------- Sound (tiny WebAudio ticks, mutable, remembered) ---------- */
    var audioCtx = null;
    var soundOn = true;
    try { soundOn = localStorage.getItem('roasod_sound') !== 'off'; } catch (e) {}

    function tick(freq, dur, vol) {
        if (!soundOn || reduceMotion) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            var o = audioCtx.createOscillator();
            var g = audioCtx.createGain();
            o.type = 'sine';
            o.frequency.value = freq;
            g.gain.value = vol || 0.03;
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
            o.connect(g);
            g.connect(audioCtx.destination);
            o.start();
            o.stop(audioCtx.currentTime + dur);
        } catch (e) {}
    }

    /* ---------- 1. Cursor-tracking glow ---------- */
    function initGlow() {
        if (!finePointer) return;
        var cards = [];
        function collect() {
            cards = Array.prototype.slice.call(document.querySelectorAll('.glass-card, .tilt, .contact-line'));
            cards.forEach(function (c) {
                if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
            });
        }
        collect();
        // Pick up cards injected later (e.g. chat bubbles).
        new MutationObserver(function () { collect(); }).observe(document.body, { childList: true, subtree: true });

        var px = 0, py = 0, queued = false;
        var REACH = 160;
        function update() {
            queued = false;
            for (var i = 0; i < cards.length; i++) {
                var c = cards[i];
                var r = c.getBoundingClientRect();
                if (r.bottom < -REACH || r.top > innerHeight + REACH) continue;
                var dx = Math.max(r.left - px, 0, px - r.right);
                var dy = Math.max(r.top - py, 0, py - r.bottom);
                var near = Math.hypot(dx, dy) < REACH;
                if (near) {
                    c.style.setProperty('--mx', (px - r.left) + 'px');
                    c.style.setProperty('--my', (py - r.top) + 'px');
                }
                c.classList.toggle('glow-near', near);
            }
        }
        document.addEventListener('pointermove', function (e) {
            px = e.clientX; py = e.clientY;
            if (!queued) { queued = true; requestAnimationFrame(update); }
        }, { passive: true });
        document.addEventListener('pointerleave', function () {
            cards.forEach(function (c) { c.classList.remove('glow-near'); });
        });
    }

    /* ---------- 2. Beam borders on buttons / key cards ---------- */
    function initBeams() {
        var sel = '.glass-button, .btn, button.bg-blue-600, a.bg-blue-600, #quote-calculator-form button[type="submit"]';
        document.querySelectorAll(sel).forEach(function (el) {
            // Skip tiny header pills and the mobile menu toggle to keep the nav calm.
            if (el.id === 'mobile-menu-button') return;
            if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
            el.classList.add('beam-border');
            // Hero CTAs get a one-off entrance sweep.
            if (el.closest('.landing') || (el.closest('section') && el.closest('section').querySelector('canvas#particle-canvas') && el.className.indexOf('px-10') > -1)) {
                el.classList.add('beam-intro');
            }
        });
    }

    /* ---------- 3. Spring-physics hover lift ---------- */
    function initSprings() {
        if (!finePointer || reduceMotion) return;
        var STIFF = 220, DAMP = 16, MASS = 1;

        function attach(el, lift, scale) {
            if (el.id === 'welcome-card' || el.closest('#cookie-banner') || el.closest('[data-no-spring]') || el.closest('#ro-cmdk-overlay')) return;
            if (el.__spring) return;
            el.__spring = true;
            el.style.transition = 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease';
            var y = 0, vy = 0, s = 1, vs = 0, ty = 0, ts = 1, raf = null, last = 0;

            function step(t) {
                var dt = Math.min((t - last) / 1000, 0.032) || 0.016;
                last = t;
                var fy = -STIFF * (y - ty) - DAMP * vy;
                vy += (fy / MASS) * dt; y += vy * dt;
                var fs = -STIFF * (s - ts) - DAMP * vs;
                vs += (fs / MASS) * dt; s += vs * dt;
                el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
                var settled = Math.abs(y - ty) < 0.02 && Math.abs(vy) < 0.02 && Math.abs(s - ts) < 0.0003 && Math.abs(vs) < 0.0003;
                if (settled) {
                    y = ty; s = ts;
                    el.style.transform = (ty === 0 && ts === 1) ? '' : 'translate3d(0,' + ty + 'px,0) scale(' + ts + ')';
                    raf = null;
                } else {
                    raf = requestAnimationFrame(step);
                }
            }
            function go(toY, toS) {
                ty = toY; ts = toS;
                if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
            }
            el.addEventListener('pointerenter', function () { go(lift, scale); });
            el.addEventListener('pointerleave', function () { go(0, 1); });
            el.addEventListener('pointerdown', function () { go(lift * 0.4, scale * 0.985); });
            el.addEventListener('pointerup', function () { go(lift, scale); });
        }

        document.querySelectorAll('.glass-card').forEach(function (el) {
            // Large containers (forms, whole-page panels) stay still; cards that lift are the small ones.
            if (el.querySelector('form') || el.id === 'frank-chat-log') return;
            attach(el, -6, 1.012);
        });
        document.querySelectorAll('.glass-button').forEach(function (el) {
            attach(el, -2, 1.03);
        });
    }

    /* ---------- 4. Bento widgets (only runs where a bento grid exists) ---------- */
    function initBento() {
        var grid = document.querySelector('.bento-grid');
        if (!grid) return;

        // Terminal typing
        var term = document.getElementById('bento-terminal-out');
        if (term) {
            var lines = window.ROASOD_TERM || [
                ['t-prompt', '$ roasod deploy --site client-portal'],
                ['t-dim', 'resolving edge nodes ...'],
                ['t-dim', 'building assets ......... done'],
                ['t-dim', 'running security scan .... 0 issues'],
                ['t-ok', '\u2714 live in 38s  \u2192  https://client-portal.vercel.app'],
                ['t-prompt', '$ ']
            ];
            var started = false;
            function typeLines() {
                if (started) return; started = true;
                term.innerHTML = '';
                var li = 0;
                (function nextLine() {
                    if (li >= lines.length) { term.insertAdjacentHTML('beforeend', '<span class="bento-cursor"></span>'); return; }
                    var l = lines[li++];
                    var span = document.createElement('span');
                    span.className = l[0];
                    term.appendChild(span);
                    var i = 0, text = l[1];
                    if (reduceMotion) { span.textContent = text; term.appendChild(document.createTextNode('\n')); nextLine(); return; }
                    (function ch() {
                        if (i < text.length) { span.textContent += text.charAt(i++); setTimeout(ch, l[0] === 't-prompt' ? 28 : 10); }
                        else { term.appendChild(document.createTextNode('\n')); setTimeout(nextLine, 220); }
                    })();
                })();
            }
            new IntersectionObserver(function (es, obs) {
                if (es[0].isIntersecting) { typeLines(); obs.disconnect(); }
            }, { threshold: 0.4 }).observe(term);
        }

        // Counters
        document.querySelectorAll('[data-count-to]').forEach(function (el) {
            var to = parseFloat(el.getAttribute('data-count-to'));
            var suffix = el.getAttribute('data-suffix') || '';
            var live = el.hasAttribute('data-live');
            function render(v) { el.textContent = Math.round(v).toLocaleString('en-ZA') + suffix; }
            new IntersectionObserver(function (es, obs) {
                if (!es[0].isIntersecting) return;
                obs.disconnect();
                if (reduceMotion) { render(to); }
                else {
                    var t0 = performance.now(), dur = 1400;
                    (function f(t) {
                        var p = Math.min((t - t0) / dur, 1);
                        render(to * (1 - Math.pow(1 - p, 3)));
                        if (p < 1) requestAnimationFrame(f);
                    })(t0);
                }
                if (live) {
                    var val = to;
                    setInterval(function () { val += Math.floor(Math.random() * 7) + 1; render(val); }, 2200);
                }
            }, { threshold: 0.5 }).observe(el);
        });

        // Mini toggles
        document.querySelectorAll('.bento-toggle-row').forEach(function (row) {
            function flip() {
                var on = row.getAttribute('aria-checked') !== 'true';
                row.setAttribute('aria-checked', on ? 'true' : 'false');
                tick(on ? 740 : 520, 0.09, 0.04);
                var bars = document.querySelectorAll('.bento-bars span');
                bars.forEach(function (b) { b.style.height = (22 + Math.random() * 78) + '%'; });
            }
            row.addEventListener('click', flip);
            row.addEventListener('keydown', function (e) {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
            });
        });

        // Initial bar heights
        document.querySelectorAll('.bento-bars span').forEach(function (b, i) {
            setTimeout(function () { b.style.height = (30 + Math.random() * 70) + '%'; }, 200 + i * 60);
        });
    }

    /* ---------- 5. Command palette (Cmd/Ctrl + K) ---------- */
    function initPalette() {
        var items = (window.ROASOD_PALETTE || [
            { g: 'Navigate', t: 'Home', h: 'index', u: 'index.html' },
            { g: 'Navigate', t: 'Games', h: 'ROASOD Games', u: 'games.html' },
            { g: 'Navigate', t: 'AI', h: 'Frank AI', u: 'ai.html' },
            { g: 'Navigate', t: 'Websites', h: 'web & design', u: 'websites.html' },
            { g: 'Navigate', t: 'Team', h: 'builders', u: 'team.html' },
            { g: 'Navigate', t: 'About', h: 'our story', u: 'about.html' },
            { g: 'Navigate', t: 'Blog', h: 'updates', u: 'blog.html' },
            { g: 'Navigate', t: 'Socials', h: 'follow us', u: 'socials.html' },
            { g: 'Navigate', t: 'Adverts', h: 'advertise', u: 'adverts.html' },
            { g: 'Navigate', t: 'Feedback', h: 'rate us', u: 'feedback.html' },
            { g: 'Navigate', t: 'Contact', h: 'start a project', u: 'contact.html' },
            { g: 'Account', t: 'Log in', u: 'login.html' },
            { g: 'Account', t: 'Sign up', u: 'signup.html' },
            { g: 'Actions', t: 'Chat with Frank on WhatsApp', h: 'opens WhatsApp', u: 'https://wa.me/27602600910?text=Hi%20Frank%2C%20I%27d%20like%20to%20chat%20about%20a%20project', ext: true },
            { g: 'Actions', t: 'Open ROASOD Games site', h: 'external', u: 'https://roasodgames.vercel.app', ext: true },
        ]).concat([
            { g: 'Actions', t: 'Scroll to top', fn: function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); } },
            { g: 'Actions', t: 'Toggle sound effects', fn: function () { setSound(!soundOn); } }
        ]);

        function setSound(on) {
            soundOn = on;
            try { localStorage.setItem('roasod_sound', on ? 'on' : 'off'); } catch (e) {}
            var btn = document.getElementById('ro-cmdk-sound');
            if (btn) btn.textContent = on ? 'Sound: on' : 'Sound: off';
            if (on) tick(660, 0.08, 0.04);
        }

        var hint = document.createElement('button');
        hint.id = 'ro-cmdk-hint';
        hint.type = 'button';
        hint.className = 'glass-button';
        hint.setAttribute('aria-label', 'Open command palette');
        var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        hint.innerHTML = 'Quick actions <kbd>' + (isMac ? '\u2318' : 'Ctrl') + ' K</kbd>';
        document.body.appendChild(hint);

        var overlay = document.createElement('div');
        overlay.id = 'ro-cmdk-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Command palette');
        overlay.innerHTML =
            '<div id="ro-cmdk">' +
            '<input id="ro-cmdk-input" type="text" placeholder="Search pages and actions..." autocomplete="off" spellcheck="false" aria-label="Search commands">' +
            '<div id="ro-cmdk-list" role="listbox"></div>' +
            '<div id="ro-cmdk-foot"><span><kbd>\u2191</kbd> <kbd>\u2193</kbd> move &nbsp; <kbd>\u21B5</kbd> select &nbsp; <kbd>Esc</kbd> close</span>' +
            '<button type="button" id="ro-cmdk-sound"></button></div>' +
            '</div>';
        document.body.appendChild(overlay);

        var input = overlay.querySelector('#ro-cmdk-input');
        var list = overlay.querySelector('#ro-cmdk-list');
        var soundBtn = overlay.querySelector('#ro-cmdk-sound');
        soundBtn.textContent = soundOn ? 'Sound: on' : 'Sound: off';
        soundBtn.addEventListener('click', function () { setSound(!soundOn); });

        var results = [], active = 0;

        // Subsequence fuzzy match; returns score + matched indices, or null.
        function fuzzy(q, text) {
            if (!q) return { score: 0, idx: [] };
            var lt = text.toLowerCase(), lq = q.toLowerCase(), idx = [], pos = 0, score = 0, prev = -2;
            for (var i = 0; i < lq.length; i++) {
                var f = lt.indexOf(lq.charAt(i), pos);
                if (f === -1) return null;
                idx.push(f);
                score += (f === prev + 1) ? 5 : 1;
                if (f === 0 || lt.charAt(f - 1) === ' ') score += 3;
                prev = f; pos = f + 1;
            }
            return { score: score - text.length * 0.02, idx: idx };
        }

        function highlight(text, idx) {
            if (!idx.length) return esc(text);
            var out = '', set = {};
            idx.forEach(function (i) { set[i] = 1; });
            for (var i = 0; i < text.length; i++) {
                out += set[i] ? '<mark>' + esc(text.charAt(i)) + '</mark>' : esc(text.charAt(i));
            }
            return out;
        }
        function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

        function render() {
            var q = input.value.trim();
            results = [];
            items.forEach(function (it) {
                var m = fuzzy(q, it.t);
                if (!m && it.h) { var m2 = fuzzy(q, it.h); if (m2) m = { score: m2.score - 2, idx: [] }; }
                if (m) results.push({ it: it, m: m });
            });
            if (q) results.sort(function (a, b) { return b.m.score - a.m.score; });
            if (active >= results.length) active = 0;

            if (!results.length) { list.innerHTML = '<div id="ro-cmdk-empty">No matches. Try "games" or "contact".</div>'; return; }
            var html = '', lastG = '';
            results.forEach(function (r, i) {
                if (!q && r.it.g !== lastG) { html += '<div class="ro-cmdk-group">' + r.it.g + '</div>'; lastG = r.it.g; }
                html += '<div class="ro-cmdk-item' + (i === active ? ' active' : '') + '" role="option" data-i="' + i + '">' +
                    '<span>' + highlight(r.it.t, r.m.idx) + '</span>' +
                    '<span class="hint">' + (r.it.h ? esc(r.it.h) : '') + '</span></div>';
            });
            list.innerHTML = html;
            var a = list.querySelector('.active');
            if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
        }

        function open() {
            overlay.classList.add('open');
            input.value = ''; active = 0; render();
            setTimeout(function () { input.focus(); }, 0);
            document.body.style.overflow = 'hidden';
            tick(880, 0.07, 0.035);
        }
        function close() {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            tick(520, 0.07, 0.03);
        }
        function run(i) {
            var r = results[i]; if (!r) return;
            var it = r.it;
            tick(990, 0.1, 0.04);
            close();
            if (it.fn) it.fn();
            else if (it.ext) window.open(it.u, '_blank', 'noopener');
            else window.location.href = it.u;
        }

        hint.addEventListener('click', open);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        list.addEventListener('mousemove', function (e) {
            var el = e.target.closest('.ro-cmdk-item');
            if (el && +el.dataset.i !== active) {
                active = +el.dataset.i;
                list.querySelectorAll('.ro-cmdk-item').forEach(function (n) { n.classList.toggle('active', +n.dataset.i === active); });
            }
        });
        list.addEventListener('click', function (e) {
            var el = e.target.closest('.ro-cmdk-item');
            if (el) run(+el.dataset.i);
        });
        input.addEventListener('input', function () { active = 0; render(); tick(1200, 0.02, 0.012); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(results.length, 1); render(); tick(800, 0.03, 0.02); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % Math.max(results.length, 1); render(); tick(800, 0.03, 0.02); }
            else if (e.key === 'Enter') { e.preventDefault(); run(active); }
        });

        document.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                overlay.classList.contains('open') ? close() : open();
            } else if (e.key === 'Escape' && overlay.classList.contains('open')) {
                close();
            }
        });
    }

    ready(function () {
        initGlow();
        initBeams();
        initSprings();
        initBento();
        initPalette();
    });
})();
