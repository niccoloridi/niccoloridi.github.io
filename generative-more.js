/* generative-more.js
   Thirty further generative plates for niccoloridi.com, companions to generative-plates.js.
   Any <canvas data-plate="g-..."> on the page is picked up, including canvases added later.
   Canvases whose data-plate this script does not own are left alone, so both scripts can share a page.
   Exposes window.GenMore = { list: [{ id, name, note }], bench(id, opts) }. */
(() => {
    'use strict';
    if (window.GenMore && window.GenMore.list) return;

    const TAU = Math.PI * 2;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

    function rng(seed) {
        let a = seed >>> 0 || 1;
        return () => {
            a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /* improved Perlin noise, seeded once per page */
    const PERM = new Uint8Array(512);
    (() => {
        const r = rng(Math.random() * 4294967295);
        const q = Array.from({ length: 256 }, (_, i) => i);
        for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const k = q[i]; q[i] = q[j]; q[j] = k; }
        for (let i = 0; i < 512; i++) PERM[i] = q[i & 255];
    })();
    function grad(hash, x, y, z) {
        const h = hash & 15, u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }
    function noise3(x, y, z) {
        let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
        x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
        const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
        const A = PERM[X] + Y, AA = PERM[A] + Z, AB = PERM[A + 1] + Z, B = PERM[X + 1] + Y, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
        return lerp(
            lerp(lerp(grad(PERM[AA], x, y, z), grad(PERM[BA], x - 1, y, z), u),
                 lerp(grad(PERM[AB], x, y - 1, z), grad(PERM[BB], x - 1, y - 1, z), u), v),
            lerp(lerp(grad(PERM[AA + 1], x, y, z - 1), grad(PERM[BA + 1], x - 1, y, z - 1), u),
                 lerp(grad(PERM[AB + 1], x, y - 1, z - 1), grad(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    }

    /* theme colours, read from the same CSS variables and with the same fallbacks as generative-plates.js */
    function themeColor(name, fallback) {
        const value = getComputedStyle(root).getPropertyValue(name).trim();
        const hex = value.match(/^#([0-9a-f]{6})$/i);
        if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
        return fallback;
    }
    let PAL = null;
    function palette() {
        if (PAL) return PAL;
        const light = root.classList.contains('light-mode');
        const bg = themeColor('--bg', light ? [236, 231, 220] : [10, 10, 12]);
        const gold = themeColor('--gold', light ? [154, 117, 33] : [215, 161, 59]);
        const ink = themeColor('--fg', light ? [22, 20, 15] : [236, 232, 223]);
        const gk = light ? 1.3 : 1, ik = light ? 1.15 : 1;
        const mix = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
        /* on parchment, gold marks are drawn a step deeper than the page gold so thin lines keep their contrast */
        const gs = (light ? mix(gold, [92, 74, 40], .28) : gold).join(','), is = ink.join(','), bs = bg.join(',');
        PAL = {
            light, bg, gold, ink, mix,
            bgS: `rgb(${bs})`,
            g: a => `rgba(${gs},${Math.min(1, a * gk).toFixed(3)})`,
            i: a => `rgba(${is},${Math.min(1, a * ik).toFixed(3)})`,
            b: a => `rgba(${bs},${a})`,
            rgb: c => `rgb(${c[0]},${c[1]},${c[2]})`
        };
        return PAL;
    }

    function ground(ctx, s, p) { ctx.fillStyle = p.bgS; ctx.fillRect(0, 0, s.w, s.h); }

    /* edges dissolve into the ground colour; gradients are cached per state */
    function edgeFade(ctx, s, p) {
        let f = s._fade;
        if (!f) {
            const fx = Math.max(14, s.w * .1), fy = Math.max(12, s.h * .13);
            const g = (x0, y0, x1, y1) => {
                const gr = ctx.createLinearGradient(x0, y0, x1, y1);
                gr.addColorStop(0, p.b(1)); gr.addColorStop(1, p.b(0));
                return gr;
            };
            f = s._fade = [
                [g(0, 0, fx, 0), 0, 0, fx, s.h],
                [g(s.w, 0, s.w - fx, 0), s.w - fx, 0, fx, s.h],
                [g(0, 0, 0, fy), 0, 0, s.w, fy],
                [g(0, s.h, 0, s.h - fy), 0, s.h - fy, s.w, fy]
            ];
        }
        for (const [gr, x, y, w, h] of f) { ctx.fillStyle = gr; ctx.fillRect(x, y, w, h); }
    }

    const DEFS = {};
    const ORDER = [];
    function plate(id, name, note, def) { def.id = id; def.name = name; def.note = note; DEFS[id] = def; ORDER.push(id); }

    /* ───────────────────────── VII. Guilloché rosette ───────────────────────── */
    plate('g-guilloche', 'Guilloché rosette',
        'Interlaced engraved bands, as on a passport page or a banknote, turning slowly against each other.', {
        edge: true, every: 33,
        
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const cx = w / 2 + (m.sx - .5) * w * .02, cy = h / 2 + (m.sy - .5) * h * .02;
            const R = Math.min(w * .47, h * .46);
            ctx.lineWidth = .55;
            ctx.lineJoin = 'round';
            /* a lattice band runs across the plate behind the medallion */
            ctx.strokeStyle = p.i(.17);
            ctx.beginPath();
            const bh = R * .2, step = Math.max(3, w / 160);
            for (let k = 0; k < 8; k++) {
                const ph = k / 8 * TAU + t * .00012;
                for (let x = -step, first = true; x <= w + step; x += step, first = false) {
                    const u = x / w;
                    const y = cy + bh * Math.sin(u * TAU * 7 + ph) * (.6 + .4 * Math.cos(u * TAU * 1.5 - t * .00004));
                    first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.fillStyle = p.bgS;
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.035, 0, TAU); ctx.fill();

            const band = (K, n, steps, rin, rout, twist, rot, style, width) => {
                ctx.strokeStyle = style; ctx.lineWidth = width;
                ctx.beginPath();
                for (let k = 0; k < K; k++) {
                    const ph = k / K * TAU + rot;
                    for (let i = 0; i <= steps; i++) {
                        const a = i / steps * TAU, ri = rin(a), ro = rout(a);
                        const q = .5 + .5 * Math.sin(n * a + ph + twist(a));
                        const r = ri + (ro - ri) * q, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                    }
                }
                ctx.stroke();
            };
            const zero = () => 0;
            band(12, 20, 320,
                a => R * (.66 + .035 * Math.sin(5 * a + t * .00009)),
                a => R * (.965 + .02 * Math.sin(10 * a - t * .00007)),
                zero, t * .00006, p.g(.5), .5);
            band(10, 11, 220,
                a => R * (.36 + .03 * Math.sin(4 * a - t * .00008)),
                a => R * (.63 + .025 * Math.sin(7 * a + t * .00006)),
                a => .9 * Math.sin(2 * a + t * .0001), -t * .00005, p.g(.72), .55);
            band(8, 7, 150,
                () => R * .08,
                a => R * (.33 + .02 * Math.sin(3 * a + t * .0001)),
                zero, t * .00007, p.i(.38), .5);
            ctx.lineWidth = .8;
            ctx.strokeStyle = p.g(.75);
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, TAU); ctx.stroke();
            ctx.lineWidth = .5;
            ctx.strokeStyle = p.g(.4);
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.025, 0, TAU); ctx.stroke();
            ctx.fillStyle = p.g(.9);
            ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.2, R * .018), 0, TAU); ctx.fill();
        }
    });

    /* ───────────────────────── VIII. World graticule ───────────────────────── */
    plate('g-globe', 'World graticule',
        'A globe drawn only in meridians and parallels, turning once every few minutes while routes are traced across it.', {
        edge: false,
        init(s) { s.routes = []; s.nextRoute = 600; },
        draw(ctx, s, p, m, dt) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const R = Math.min(w, h) * .42, cx = w / 2, cy = h / 2;
            const lam0 = t * .00005 + (m.sx - .5) * .5, phi0 = .4 + (m.sy - .5) * .35;
            const sp0 = Math.sin(phi0), cp0 = Math.cos(phi0);
            const D = Math.PI / 180;
            let X = 0, Y = 0, Z = 0;
            const proj = (lat, lon) => {
                const cl = Math.cos(lat), dl = lon - lam0;
                X = cx + R * cl * Math.sin(dl);
                Y = cy - R * (cp0 * Math.sin(lat) - sp0 * cl * Math.cos(dl));
                Z = sp0 * Math.sin(lat) + cp0 * cl * Math.cos(dl);
            };
            const front = new Path2D(), back = new Path2D(), strong = new Path2D();
            const line = (n, f, target) => {
                let prev = null;
                for (let i = 0; i <= n; i++) {
                    f(i / n); const vis = Z > 0;
                    const path = target && vis ? target : vis ? front : back;
                    if (prev === null || prev !== vis) path.moveTo(X, Y); else path.lineTo(X, Y);
                    prev = vis;
                }
            };
            for (let k = 0; k < 24; k++) {
                const lon = k * 15 * D;
                line(60, u => proj((-90 + 180 * u) * D, lon), k === 0 ? strong : null);
            }
            for (let lat = -75; lat <= 75; lat += 15) {
                line(96, u => proj(lat * D, u * TAU), lat === 0 ? strong : null);
            }
            ctx.lineWidth = .55;
            ctx.strokeStyle = p.i(.11); ctx.stroke(back);
            ctx.strokeStyle = p.g(.55); ctx.stroke(front);
            ctx.lineWidth = .9;
            ctx.strokeStyle = p.g(.85); ctx.stroke(strong);
            /* limb and a bezel of ticks */
            ctx.lineWidth = 1;
            ctx.strokeStyle = p.g(.8);
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
            ctx.lineWidth = .5;
            ctx.strokeStyle = p.i(.28);
            ctx.beginPath();
            const rot = -t * .00001;
            for (let k = 0; k < 72; k++) {
                const a = k / 72 * TAU + rot, r0 = R * 1.08, r1 = R * (k % 6 ? 1.11 : 1.15);
                ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
                ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
            }
            ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, TAU); ctx.stroke();
            /* great-circle routes, traced and then let go */
            s.nextRoute -= dt;
            if (s.nextRoute <= 0 && s.routes.length < 3) {
                s.nextRoute = 2600 + s.rand() * 2200;
                const pick = () => {
                    const lat = (s.rand() * 120 - 60) * D, lon = lam0 + (s.rand() - .5) * 2.2;
                    return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
                };
                const a = pick(); let b = pick();
                let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                if (dot > .8) { b = pick(); dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
                s.routes.push({ a, b, om: Math.acos(clamp(dot, -1, 1)), age: 0 });
            }
            ctx.lineCap = 'round';
            for (let r = s.routes.length - 1; r >= 0; r--) {
                const q = s.routes[r];
                q.age += dt;
                const draw = smooth(q.age / 2600), fade = 1 - smooth((q.age - 5200) / 1800);
                if (fade <= 0) { s.routes.splice(r, 1); continue; }
                const so = Math.sin(q.om) || 1, n = 48;
                const path = new Path2D(); let started = false, ex = 0, ey = 0, ev = false;
                for (let i = 0; i <= n; i++) {
                    const u = i / n * draw;
                    const ka = Math.sin((1 - u) * q.om) / so, kb = Math.sin(u * q.om) / so;
                    const vx = ka * q.a[0] + kb * q.b[0], vy = ka * q.a[1] + kb * q.b[1], vz = ka * q.a[2] + kb * q.b[2];
                    proj(Math.asin(clamp(vz, -1, 1)), Math.atan2(vy, vx));
                    if (Z > 0) { started ? path.lineTo(X, Y) : path.moveTo(X, Y); started = true; } else started = false;
                    ex = X; ey = Y; ev = Z > 0;
                }
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = p.g(.9 * fade); ctx.stroke(path);
                if (ev) { ctx.fillStyle = p.g(fade); ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, TAU); ctx.fill(); }
            }
            ctx.lineCap = 'butt';
        }
    });

    /* ───────────────────────── IX. Citation constellation ───────────────────────── */
    plate('g-constellation', 'Citation constellation',
        'Decisions drift as a loose network, and now and then a citation travels from one to another and lights it up.', {
        edge: true,
        init(s) {
            const r = s.rand;
            const N = clamp(Math.round(s.w * s.h / 1500), 40, 140);
            s.D = clamp(Math.sqrt(s.w * s.h) * .2, 52, 130);
            s.nodes = Array.from({ length: N }, () => ({ x: r() * s.w, y: r() * s.h, a: r() * TAU, sp: 3 + r() * 5, heat: 0, rank: r() }));
            s.pulses = []; s.next = 200;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, nodes, D } = s, D2 = D * D, r = s.rand;
            for (const n of nodes) {
                n.a += (r() - .5) * .06;
                const mx = Math.min(n.x, w - n.x), my = Math.min(n.y, h - n.y);
                if (mx < 18 || my < 18) {
                    const want = Math.atan2(h / 2 - n.y, w / 2 - n.x);
                    let d = want - n.a; d = Math.atan2(Math.sin(d), Math.cos(d));
                    n.a += d * .04;
                }
                n.x += Math.cos(n.a) * n.sp * dt / 1000;
                n.y += Math.sin(n.a) * n.sp * dt / 1000;
                n.heat *= Math.exp(-dt / 1700);
            }
            ground(ctx, s, p);
            const B = 5, paths = Array.from({ length: B }, () => new Path2D()), near = new Path2D();
            const px = m.sx * w, py = m.sy * h, pr2 = (Math.min(w, h) * .22) ** 2;
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                    if (d2 > D2) continue;
                    const k = 1 - Math.sqrt(d2) / D;
                    const mxp = (a.x + b.x) / 2 - px, myp = (a.y + b.y) / 2 - py;
                    const target = m.k > .3 && mxp * mxp + myp * myp < pr2 ? near : paths[Math.min(B - 1, Math.floor(k * k * B * 1.3))];
                    target.moveTo(a.x, a.y); target.lineTo(b.x, b.y);
                }
            }
            ctx.lineWidth = p.light ? .7 : .55;
            for (let b = 0; b < B; b++) { ctx.strokeStyle = p.light ? p.i(.1 + b * .065) : p.i(.09 + b * .075); ctx.stroke(paths[b]); }
            ctx.strokeStyle = p.g(.45 * m.k); ctx.stroke(near);
            /* citations */
            s.next -= dt;
            const spawn = (i) => {
                const a = nodes[i], cand = [];
                for (let j = 0; j < nodes.length; j++) {
                    if (j === i) continue;
                    const dx = a.x - nodes[j].x, dy = a.y - nodes[j].y;
                    if (dx * dx + dy * dy < D2) cand.push(j);
                }
                if (!cand.length) return;
                cand.sort((x, y) => nodes[y].rank - nodes[x].rank);
                const j = cand[Math.floor(Math.pow(r(), 1.8) * cand.length)];
                s.pulses.push({ i, j, u: 0, dur: 700 + Math.hypot(a.x - nodes[j].x, a.y - nodes[j].y) * 12, depth: 0 });
            };
            if (s.next <= 0) { s.next = 420 + r() * 900; spawn(Math.floor(r() * nodes.length)); }
            ctx.lineCap = 'round';
            for (let k = s.pulses.length - 1; k >= 0; k--) {
                const q = s.pulses[k], a = nodes[q.i], b = nodes[q.j];
                q.u += dt / q.dur;
                if (q.u >= 1) {
                    b.heat = 1;
                    s.pulses.splice(k, 1);
                    if (r() < .5 && s.pulses.length < 8) spawn(q.j);
                    continue;
                }
                const e = smooth(q.u), x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e);
                const tail = Math.max(0, e - .35), tx = lerp(a.x, b.x, tail), ty = lerp(a.y, b.y, tail);
                const gr = ctx.createLinearGradient(tx, ty, x, y);
                gr.addColorStop(0, p.g(0)); gr.addColorStop(1, p.g(.9));
                ctx.strokeStyle = gr; ctx.lineWidth = p.light ? 1.4 : 1.1;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
                ctx.fillStyle = p.g(1); ctx.beginPath(); ctx.arc(x, y, p.light ? 1.8 : 1.5, 0, TAU); ctx.fill();
            }
            const plain = new Path2D(), lit = new Path2D();
            for (const n of nodes) {
                const rad = p.light ? 1.1 + n.rank * n.rank * n.rank * 2.1 + n.heat * 1.4 : .9 + n.rank * n.rank * n.rank * 1.7 + n.heat * 1.2;
                const target = n.rank > .9 || n.heat > .05 ? lit : plain;
                target.moveTo(n.x + rad, n.y); target.arc(n.x, n.y, rad, 0, TAU);
                if (n.heat > .04) {
                    ctx.strokeStyle = p.g(n.heat * .55); ctx.lineWidth = p.light ? .8 : .6;
                    ctx.beginPath(); ctx.arc(n.x, n.y, 2.5 + (1 - n.heat) * 11, 0, TAU); ctx.stroke();
                }
            }
            ctx.fillStyle = p.i(p.light ? .55 : .5); ctx.fill(plain);
            ctx.fillStyle = p.g(.95); ctx.fill(lit);
        }
    });

    /* ───────────────────────── X. Citation arcs ───────────────────────── */
    plate('g-arcs', 'Citation arcs',
        'Judgments arrive along a timeline and arc back to the earlier ones they rely on, so the most cited gather the most arcs.', {
        edge: true,
        init(s) {
            s.cases = []; s.arcs = []; s.clock = 0; s.next = 0;
            s.v = clamp(s.w / 32, 9, 22);
            s.y0 = Math.round(s.h * .8) + .5;
            for (let k = 0; k < 2400; k++) this.step(s, 16);
        },
        step(s, dt) {
            s.clock += dt; s.next -= dt;
            const r = s.rand;
            if (s.next <= 0) {
                s.next = 700 + r() * 900;
                const c = { born: s.clock, cites: 0 };
                const xr = x => (s.w - 14) - s.v * (s.clock - x.born) / 1000;
                const reach = Math.min(s.w * .6, s.h * 1.4);
                const pool = s.cases.filter(q => xr(q) > (s.w - 14) - reach && xr(q) < s.w - 30);
                const k = pool.length ? 1 + (r() < .55) + (r() < .22) : 0;
                for (let n = 0; n < k; n++) {
                    let total = 0;
                    for (const q of pool) total += 1 + q.cites * 2.2;
                    let pick = r() * total, target = pool[0];
                    for (const q of pool) { pick -= 1 + q.cites * 2.2; if (pick <= 0) { target = q; break; } }
                    if (s.arcs.some(a => a.a === c && a.b === target)) continue;
                    target.cites++;
                    s.arcs.push({ a: c, b: target, born: s.clock + n * 260 });
                }
                s.cases.push(c);
            }
            const limit = s.clock - (s.w * 1.7 / s.v) * 1000;
            if (s.cases.length && s.cases[0].born < limit) {
                s.cases = s.cases.filter(q => q.born >= limit);
                s.arcs = s.arcs.filter(a => a.b.born >= limit);
            }
        },
        draw(ctx, s, p, m, dt) {
            this.step(s, dt);
            const { w, h, y0, v } = s;
            const X = q => (w - 14) - v * (s.clock - q.born) / 1000;
            ground(ctx, s, p);
            ctx.lineWidth = .7;
            ctx.strokeStyle = p.i(.35);
            ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
            const hover = m.k > .3 ? m.sx * w : -1e9;
            for (const a of s.arcs) {
                const age = s.clock - a.born;
                if (age < 0) continue;
                const xa = X(a.a), xb = X(a.b);
                if (xa < -10 && xb < -10) continue;
                const rx = Math.abs(xa - xb) / 2;
                if (rx < .5) continue;
                const ry = Math.min(rx * .95, y0 - 10);
                const u = smooth(age / 1100);
                const fresh = Math.max(0, 1 - age / 9000);
                const near = Math.abs((xa + xb) / 2 - hover) < rx ? .18 : 0;
                ctx.strokeStyle = p.g(.2 + .5 * fresh + near);
                ctx.lineWidth = .6 + .5 * fresh;
                ctx.beginPath();
                ctx.ellipse((xa + xb) / 2, y0, rx, ry, 0, TAU, TAU - Math.PI * u, true);
                ctx.stroke();
            }
            const ticks = new Path2D(), dots = new Path2D();
            for (const q of s.cases) {
                const x = X(q);
                if (x < -4 || x > w + 4) continue;
                ticks.moveTo(x, y0); ticks.lineTo(x, y0 + 3 + Math.sqrt(q.cites) * 2.4);
                if (q.cites >= 3) { const rr = 1 + Math.sqrt(q.cites) * .45; dots.moveTo(x + rr, y0); dots.arc(x, y0, rr, 0, TAU); }
            }
            ctx.strokeStyle = p.i(.5); ctx.lineWidth = .6; ctx.stroke(ticks);
            ctx.fillStyle = p.g(.95); ctx.fill(dots);
            /* decade labels, from 1945 */
            const yps = .3, fs = clamp(h / 28, 7.5, 10);
            ctx.font = `${fs}px ${MONO}`;
            ctx.fillStyle = p.i(.42);
            ctx.textAlign = 'center';
            const nowYear = (s.clock / 1000 * yps) % 81;
            for (let year = 1950; year <= 2020; year += 10) {
                let ago = nowYear - (year - 1945);
                if (ago < 0) ago += 81;
                const x = (w - 14) - v * ago / yps;
                if (x > -20 && x < w + 20) ctx.fillText(String(year), x, y0 + 14 + fs);
            }
            ctx.textAlign = 'start';
        }
    });

    /* ───────────────────────── XI. Contour survey ───────────────────────── */
    plate('g-contour', 'Contour survey',
        'Topographic lines over slowly shifting ground, with every fourth contour inked in gold as on a survey sheet.', {
        edge: true, every: 33,
        
        init(s) {
            s.g = Math.max(5, Math.round(Math.min(s.w, s.h) / 50));
            s.cols = Math.ceil(s.w / s.g) + 2; s.rows = Math.ceil(s.h / s.g) + 2;
            s.f = new Float32Array(s.cols * s.rows);
            s.sc = 2.4 / Math.max(s.w, s.h * 1.3);
            s.oz = s.rand() * 100;
        },
        draw(ctx, s, p, m) {
            const { w, h, g, cols, rows, f, sc } = s;
            const z = s.oz + s.t * .000035;
            const px = m.sx * w, py = m.sy * h, sig2 = 2 * (Math.min(w, h) * .2) ** 2, bump = .45 * m.k;
            for (let j = 0; j < rows; j++) {
                const y = (j - 1) * g;
                for (let i = 0; i < cols; i++) {
                    const x = (i - 1) * g;
                    let v = noise3(x * sc, y * sc, z) + .45 * noise3(x * sc * 2.3 + 11, y * sc * 2.3, z * 1.6);
                    if (bump > 0) { const dx = x - px, dy = y - py; v += bump * Math.exp(-(dx * dx + dy * dy) / sig2); }
                    f[j * cols + i] = v;
                }
            }
            ground(ctx, s, p);
            const minor = new Path2D(), major = new Path2D();
            const step = .07, base = -1.2, L = 36;
            for (let j = 0; j < rows - 1; j++) {
                const y = (j - 1) * g;
                for (let i = 0; i < cols - 1; i++) {
                    const x = (i - 1) * g;
                    const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
                    const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
                    const k0 = Math.max(0, Math.ceil((lo - base) / step)), k1 = Math.min(L, Math.floor((hi - base) / step));
                    for (let k = k0; k <= k1; k++) {
                        const lv = base + k * step;
                        const code = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
                        if (code === 0 || code === 15) continue;
                        const path = k % 4 === 0 ? major : minor;
                        const tx = x + g * (lv - a) / (b - a), ry = y + g * (lv - b) / (c - b);
                        const bx = x + g * (lv - d) / (c - d), ly = y + g * (lv - a) / (d - a);
                        const seg = (x1, y1, x2, y2) => { path.moveTo(x1, y1); path.lineTo(x2, y2); };
                        switch (code) {
                            case 1: case 14: seg(x, ly, bx, y + g); break;
                            case 2: case 13: seg(bx, y + g, x + g, ry); break;
                            case 3: case 12: seg(x, ly, x + g, ry); break;
                            case 4: case 11: seg(tx, y, x + g, ry); break;
                            case 5: seg(x, ly, tx, y); seg(bx, y + g, x + g, ry); break;
                            case 6: case 9: seg(tx, y, bx, y + g); break;
                            case 7: case 8: seg(x, ly, tx, y); break;
                            case 10: seg(tx, y, x + g, ry); seg(x, ly, bx, y + g); break;
                        }
                    }
                }
            }
            ctx.lineWidth = .6; ctx.strokeStyle = p.i(.26); ctx.stroke(minor);
            ctx.lineWidth = 1.05; ctx.strokeStyle = p.g(.85); ctx.stroke(major);
        }
    });

    /* ───────────────────────── XII. Ledger of authorities ───────────────────────── */
    const SOURCES = [
        'ICJ Reports 1949, p. 4', 'ICJ Reports 1951, p. 116', 'ICJ Reports 1969, p. 3', 'ICJ Reports 1974, p. 253',
        'ICJ Reports 1986, p. 14', 'ICJ Reports 1996, p. 226', 'ICJ Reports 2012, p. 99', 'PCIJ Series A, No. 10',
        'PCIJ Series B, No. 4', '1155 UNTS 331', '1833 UNTS 3', '1 UNTS xvi', 'A/RES/2625 (XXV)', 'A/RES/1803 (XVII)',
        'S/RES/242 (1967)', 'S/RES/1373 (2001)', 'YILC 2001, vol. II(2)', 'RIAA vol. II, p. 829', 'Case 26/62',
        'ITLOS Case No. 21', 'ICJ Reports 1955, p. 4', 'ICJ Reports 1970, p. 3', 'ICJ Reports 2004, p. 136', 'PCIJ Series A, No. 2'
    ];
    const ARTICLES = ['art. 2(4)', 'art. 38(1)(b)', 'art. 31(3)(c)', 'art. 51', 'art. 25', 'art. 60', 'art. 53',
        'art. 94', 'art. 103', 'art. 36(2)', 'art. 18', 'art. 26', 'art. 59', 'art. 33', 'art. 41'];
    plate('g-ledger', 'Ledger of authorities',
        'A typewriter enters authorities line by line, numbered and ruled like a register, with a few marked in gold.', {
        edge: true,
        init(s) {
            s.fs = clamp(Math.min(s.w, s.h) / 24, 8, 12);
            s.lh = Math.round(s.fs * 1.75);
            s.font = `${s.fs}px ${MONO}`;
            const c = document.createElement('canvas').getContext('2d');
            c.font = s.font;
            s.cw = c.measureText('0').width || s.fs * .6;
            s.margin = Math.max(14, s.w * .07);
            s.chars = Math.max(24, Math.floor((s.w - s.margin * 1.6) / s.cw));
            s.lines = []; s.seq = Math.floor(100 + s.rand() * 300);
            s.visible = Math.ceil(s.h / s.lh) + 1;
            s.scroll = 0; s.carry = 0;
            const prefill = Math.max(1, s.visible - 3);
            for (let k = 0; k < prefill; k++) { this.addLine(s); s.lines[k].typed = s.lines[k].len; s.lines[k].done = 9999; }
            this.addLine(s);
            s.scroll = Math.max(0, s.lines.length - s.visible + 2.5);
        },
        addLine(s) {
            const r = s.rand;
            const seq = String(s.seq++).padStart(4, '0');
            const src = SOURCES[Math.floor(r() * SOURCES.length)];
            const art = ARTICLES[Math.floor(r() * ARTICLES.length)];
            const room = s.chars - seq.length - 2 - src.length - art.length - 2;
            const segs = [];
            const mark = r() < .16;
            segs.push({ text: seq + '  ', role: 'seq' });
            if (room >= 2) {
                segs.push({ text: src + ' ', role: mark ? 'mark' : 'src' });
                segs.push({ text: '.'.repeat(Math.max(0, room)), role: 'lead' });
                segs.push({ text: ' ' + art, role: 'art' });
            } else {
                segs.push({ text: src.slice(0, Math.max(6, s.chars - seq.length - 2)), role: mark ? 'mark' : 'src' });
            }
            const len = segs.reduce((n, g) => n + g.text.length, 0);
            s.lines.push({ segs, len, typed: 0, mark, done: 0, pause: 0 });
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, lh, cw, margin } = s;
            const cur = s.lines[s.lines.length - 1];
            s.carry += dt * .036;
            while (s.carry >= 1) {
                s.carry -= 1;
                if (cur.typed < cur.len) cur.typed++;
                else if (++cur.pause > 14) { this.addLine(s); break; }
            }
            for (const l of s.lines) if (l.typed >= l.len) l.done += dt / 1000;
            const target = Math.max(0, s.lines.length - s.visible + 2.5);
            s.scroll += (target - s.scroll) * Math.min(1, dt / 420);
            if (s.lines.length > s.visible + 6) { s.lines.splice(0, 4); s.scroll -= 4; }
            ground(ctx, s, p);
            ctx.font = s.font;
            ctx.textBaseline = 'alphabetic';
            const top = lh * 1.1;
            const rules = new Path2D();
            for (let k = -1; k <= s.visible + 1; k++) {
                const y = Math.round(top + (k - (s.scroll % 1)) * lh + lh * .32) + .5;
                rules.moveTo(0, y); rules.lineTo(w, y);
            }
            ctx.lineWidth = .5; ctx.strokeStyle = p.i(.08); ctx.stroke(rules);
            const mx = Math.round(margin + 5 * cw) + .5;
            ctx.strokeStyle = p.g(.35); ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.stroke();
            const colours = { seq: p.g(.6), src: p.i(.62), mark: p.g(.95), lead: p.i(.2), art: p.g(.8) };
            for (let k = 0; k < s.lines.length; k++) {
                const l = s.lines[k];
                const y = top + (k - s.scroll) * lh;
                if (y < -lh || y > h + lh) continue;
                let left = l.typed, col = 0;
                for (const g of l.segs) {
                    if (left <= 0) break;
                    const str = left >= g.text.length ? g.text : g.text.slice(0, left);
                    ctx.fillStyle = colours[g.role];
                    ctx.fillText(str, margin + col * cw, y);
                    if (g.role === 'mark' && l.typed >= l.len) {
                        const u = smooth(l.done / .9), tw = (g.text.length - 1) * cw * u;
                        ctx.fillStyle = p.g(.7);
                        ctx.fillRect(margin + col * cw, y + 2.5, tw, .9);
                    }
                    left -= g.text.length; col += g.text.length;
                }
                if (l === cur && (l.typed < l.len || Math.floor(s.t / 480) % 2 === 0)) {
                    ctx.fillStyle = p.g(.85);
                    ctx.fillRect(margin + Math.min(l.typed, s.chars) * cw + 1, y - s.fs * .78, cw * .7, s.fs * .95);
                }
            }
        }
    });

    /* ───────────────────────── XIII. Tree rings ───────────────────────── */
    plate('g-rings', 'Tree rings',
        'A cross-section of timber in which each year adds a ring, never quite round, around an off-centre pith.', {
        edge: true, every: 33,
        
        init(s) {
            const r = s.rand;
            s.v = clamp(Math.min(s.w, s.h) / 46, 3.5, 10);
            s.rings = []; s.next = 0;
            s.harm = Array.from({ length: 6 }, (_, k) => ({ k: k + 2, a: .05 / (k + 1.2), ph: r() * TAU, dr: (r() - .5) * .03 }));
            s.cx = s.w * (.38 + r() * .1); s.cy = s.h * (.5 + r() * .12);
            s.max = Math.hypot(s.w, s.h) * .9;
            let age = 0;
            while (age * s.v / 1000 < s.max) { const gap = 1500 + r() * 1900; s.rings.push({ age, late: .6 + r() * .6 }); age += gap; }
            s.next = 1500 + r() * 1900;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, t } = s, r = s.rand;
            for (const q of s.rings) q.age += dt;
            s.next -= dt;
            if (s.next <= 0) { s.rings.push({ age: 0, late: .6 + r() * .6 }); s.next = 1500 + r() * 1900; }
            s.rings = s.rings.filter(q => q.age * s.v / 1000 < s.max);
            ground(ctx, s, p);
            const cx = s.cx + (m.sx - .5) * w * .04, cy = s.cy + (m.sy - .5) * h * .04;
            const shape = (a, rad) => {
                let v = 0;
                for (const H of s.harm) v += H.a * Math.sin(H.k * a + H.ph + rad * H.dr + t * .00002 * H.k);
                return v;
            };
            const late = new Path2D(), early = new Path2D();
            for (const q of s.rings) {
                const rad = q.age * s.v / 1000;
                if (rad < 1.5) continue;
                const n = clamp(Math.round(rad * .9), 20, 200);
                const amp = Math.min(1, rad / 40);
                for (let pass = 0; pass < 2; pass++) {
                    const rr = pass ? rad - Math.min(rad * .5, 3 + q.late * 2.2) : rad;
                    if (rr < 1) continue;
                    const path = pass ? early : late;
                    for (let i = 0; i <= n; i++) {
                        const a = i / n * TAU, k = rr * (1 + amp * shape(a, rr));
                        const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k * .92;
                        i ? path.lineTo(x, y) : path.moveTo(x, y);
                    }
                }
            }
            ctx.lineWidth = .5; ctx.strokeStyle = p.i(.18); ctx.stroke(early);
            ctx.lineWidth = 1.05; ctx.strokeStyle = p.g(.68); ctx.stroke(late);
            ctx.fillStyle = p.g(.9);
            ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, TAU); ctx.fill();
        }
    });

    /* ───────────────────────── XIV. Field lines ───────────────────────── */
    plate('g-field', 'Field lines',
        'Lines of force run between poles that wander slowly across the plate, bending as the poles approach one another.', {
        edge: true,
        init(s) {
            const r = s.rand;
            s.charges = [1, -1, 1, -1].map(q => ({ q, f1: .00005 + r() * .00007, f2: .00005 + r() * .00007, p1: r() * TAU, p2: r() * TAU, x: 0, y: 0 }));
        },
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            const cs = s.charges;
            for (const c of cs) { c.x = w * (.5 + .34 * Math.sin(t * c.f1 + c.p1)); c.y = h * (.5 + .3 * Math.sin(t * c.f2 + c.p2)); }
            const all = cs.slice();
            if (m.k > .05) all.push({ q: -.7 * m.k, x: m.sx * w, y: m.sy * h });
            const n = all.length, qx = all.map(c => c.x), qy = all.map(c => c.y), qq = all.map(c => c.q);
            let ex = 0, ey = 0;
            const field = (x, y) => {
                ex = 0; ey = 0;
                for (let k = 0; k < n; k++) { const dx = x - qx[k], dy = y - qy[k], d2 = dx * dx + dy * dy + .01; ex += qq[k] * dx / d2; ey += qq[k] * dy / d2; }
            };
            ground(ctx, s, p);
            const hs = clamp(Math.min(w, h) / 90, 2.2, 4.5), maxSteps = Math.round((w + h) / hs * 1.1);
            const lines = new Path2D();
            const L = 18;
            for (const c of cs) {
                if (c.q < 0) continue;
                for (let j = 0; j < L; j++) {
                    const a = j / L * TAU + t * .00004;
                    let x = c.x + Math.cos(a) * 4, y = c.y + Math.sin(a) * 4;
                    lines.moveTo(x, y);
                    for (let k = 0; k < maxSteps; k++) {
                        field(x, y); let l = Math.hypot(ex, ey) || 1;
                        const mx = x + ex / l * hs * .5, my = y + ey / l * hs * .5;
                        field(mx, my); l = Math.hypot(ex, ey) || 1;
                        x += ex / l * hs; y += ey / l * hs;
                        lines.lineTo(x, y);
                        if (x < -30 || x > w + 30 || y < -30 || y > h + 30) break;
                        let sink = false;
                        for (let q = 0; q < n; q++) if (qq[q] < 0) { const dx = x - qx[q], dy = y - qy[q]; if (dx * dx + dy * dy < 16) { sink = true; break; } }
                        if (sink) break;
                    }
                }
            }
            ctx.lineWidth = p.light ? .85 : .7; ctx.strokeStyle = p.g(.55); ctx.stroke(lines);
            for (const c of cs) {
                ctx.fillStyle = p.bgS;
                ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, TAU); ctx.fill();
                ctx.lineWidth = .8; ctx.strokeStyle = c.q > 0 ? p.g(.95) : p.i(.7);
                ctx.stroke();
                ctx.beginPath(); ctx.moveTo(c.x - 2.6, c.y); ctx.lineTo(c.x + 2.6, c.y);
                if (c.q > 0) { ctx.moveTo(c.x, c.y - 2.6); ctx.lineTo(c.x, c.y + 2.6); }
                ctx.stroke();
            }
        }
    });

    /* ───────────────────────── XV. Seed head ───────────────────────── */
    plate('g-phyllotaxis', 'Seed head',
        'Seeds set at the golden angle, which drifts by a fraction of a degree so the spirals loosen into spokes and close again.', {
        edge: true,
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const N = 640, R = Math.min(w * .46, h * .6), c = R / Math.sqrt(N);
            const cx = w / 2 + (m.sx - .5) * w * .03, cy = h / 2 + (m.sy - .5) * h * .03;
            const ga = 137.50776 * Math.PI / 180 + .0032 * Math.sin(t * .00009) + .0012 * Math.sin(t * .00023);
            const rot = t * .00003;
            const B = 4, gold = Array.from({ length: B }, () => new Path2D()), ink = new Path2D();
            for (let i = 1; i <= N; i++) {
                const u = i / N, rr = c * Math.sqrt(i) * (1 + .012 * Math.sin(t * .0007 - i * .02));
                const a = i * ga + rot, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
                const rad = c * (.18 + .3 * Math.sqrt(u));
                const path = i % 21 === 0 ? ink : gold[Math.min(B - 1, Math.floor(u * B))];
                path.moveTo(x + rad, y); path.arc(x, y, rad, 0, TAU);
            }
            for (let b = 0; b < B; b++) { ctx.fillStyle = p.g(.35 + b * .18); ctx.fill(gold[b]); }
            ctx.fillStyle = p.i(.6); ctx.fill(ink);
        }
    });

    /* ───────────────────────── XVI. Harmonograph ───────────────────────── */
    plate('g-harmonograph', 'Harmonograph',
        'The trace of two swinging pendulums and a turning table, drawn in one continuous line that slowly dies away.', {
        edge: true,
        init(s) { s.cycle = 0; s.prev = null; this.fresh(s); if (s.reduced) s.cycle = 23000; },
        fresh(s) {
            const r = s.rand;
            const ratios = [[2, 3], [3, 4], [3, 2], [4, 3], [1, 3], [2, 5], [5, 4], [1, 2]];
            const [a, b] = ratios[Math.floor(r() * ratios.length)];
            const base = 1.1 + r() * .25, det = () => (r() - .5) * .022;
            const f1 = a * base / 2 + det(), f2 = b * base / 2 + det(), f3 = (r() < .5 ? a : b) * base / 2 + det();
            const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU, d = .007 + r() * .006, A3 = .25 + r() * .25;
            const N = 3600, dt = .055, xs = new Float32Array(N), ys = new Float32Array(N);
            let mx = 1e-6;
            for (let i = 0; i < N; i++) {
                const tt = i * dt, e = Math.exp(-d * tt);
                xs[i] = e * (Math.sin(f1 * tt + p1) + A3 * Math.cos(f3 * tt + p3));
                ys[i] = e * (Math.sin(f2 * tt + p2) + A3 * Math.sin(f3 * tt + p3));
                mx = Math.max(mx, Math.abs(xs[i]), Math.abs(ys[i]));
            }
            for (let i = 0; i < N; i++) { xs[i] /= mx; ys[i] /= mx; }
            if (s.cur) s.prev = s.cur;
            s.cur = { xs, ys, N, spin: (r() - .5) * .3 };
            s.cycle = 0;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h } = s;
            s.cycle += dt;
            const drawT = 24000, hold = 7000, fade = 2600;
            if (s.cycle > drawT + hold + fade) this.fresh(s);
            ground(ctx, s, p);
            const R = Math.min(w, h) * .43, Rx = Math.min(w * .45, R * 1.5);
            const cx = w / 2, cy = h / 2;
            const put = (q, upto, style, width, spinAt) => {
                const rot = q.spin * spinAt;
                const ca = Math.cos(rot), sa = Math.sin(rot);
                ctx.strokeStyle = style; ctx.lineWidth = width;
                ctx.beginPath();
                for (let i = 0; i < upto; i++) {
                    const x = q.xs[i], y = q.ys[i];
                    const X = cx + (x * ca - y * sa) * Rx, Y = cy + (x * sa + y * ca) * R;
                    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
                }
                ctx.stroke();
            };
            const prog = 1 - Math.pow(1 - Math.min(1, s.cycle / drawT), 1.6);
            const out = 1 - smooth((s.cycle - drawT - hold) / fade);
            if (s.prev) {
                const ghost = .14 * (1 - smooth(s.cycle / 9000));
                if (ghost > .005) put(s.prev, s.prev.N, p.i(ghost), .5, 1);
            }
            const q = s.cur, upto = Math.max(2, Math.floor(q.N * prog));
            put(q, upto, p.g(.5 * out), p.light ? .75 : .55, 1);
            if (prog < 1) {
                const i = upto - 1, rot = q.spin, ca = Math.cos(rot), sa = Math.sin(rot);
                const X = cx + (q.xs[i] * ca - q.ys[i] * sa) * Rx, Y = cy + (q.xs[i] * sa + q.ys[i] * ca) * R;
                ctx.fillStyle = p.g(1);
                ctx.beginPath(); ctx.arc(X, Y, 1.7, 0, TAU); ctx.fill();
            }
        }
    });

    /* ───────────────────────── XVII. Maurer rose ───────────────────────── */
    const ROSES = [[2, 39], [3, 47], [6, 71], [4, 31], [5, 97], [7, 19], [2, 29], [6, 37]];
    plate('g-rose', 'Maurer rose',
        'A rose curve and the web of chords that steps around it, the step drifting so the web keeps redrawing itself.', {
        edge: true,
        init(s) { s.k = Math.floor(s.rand() * ROSES.length); },
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const period = 42000, fadeT = 5000;
            const idx = Math.floor(t / period), within = t % period;
            const R = Math.min(w, h) * .45, cx = w / 2, cy = h / 2;
            const drawRose = (k, alpha, local) => {
                const [n, d0] = ROSES[(s.k + k) % ROSES.length];
                const d = (d0 + 1.2 * Math.sin(local * .000035) + (m.sx - .5) * .4) * Math.PI / 180;
                const rot = local * .000012 - Math.PI / 2;
                ctx.lineWidth = .5; ctx.strokeStyle = p.i((p.light ? .17 : .22) * alpha);
                ctx.beginPath();
                for (let i = 0; i <= 360; i++) {
                    const th = i * d, rr = R * Math.sin(n * th);
                    const x = cx + Math.cos(th + rot) * rr, y = cy + Math.sin(th + rot) * rr;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
                ctx.lineWidth = 1; ctx.strokeStyle = p.g(.8 * alpha);
                ctx.beginPath();
                const steps = 720;
                for (let i = 0; i <= steps; i++) {
                    const th = i / steps * TAU, rr = R * Math.sin(n * th);
                    const x = cx + Math.cos(th + rot) * rr, y = cy + Math.sin(th + rot) * rr;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
            };
            const tr = smooth((within - (period - fadeT)) / fadeT);
            if (tr < 1) drawRose(idx, 1 - tr, t);
            if (tr > 0) drawRose(idx + 1, tr, t);
            ctx.strokeStyle = p.i(.22); ctx.lineWidth = .5;
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, TAU); ctx.stroke();
        }
    });

    /* ───────────────────────── XVIII. Truchet tiling ───────────────────────── */
    plate('g-truchet', 'Truchet tiling',
        'Quarter-circle tiles that turn one at a time, so the woven paths quietly reroute themselves across the plate.', {
        edge: true,
        init(s) {
            const r = s.rand;
            s.size = clamp(Math.min(s.w, s.h) / 6.5, 22, 46);
            s.cols = Math.ceil(s.w / s.size) + 1; s.rows = Math.ceil(s.h / s.size) + 1;
            s.ox = (s.w - s.cols * s.size) / 2; s.oy = (s.h - s.rows * s.size) / 2;
            s.tiles = Array.from({ length: s.cols * s.rows }, () => ({ r: r() < .5 ? 0 : 1, a: 0, from: 0, start: -1 }));
            s.next = 400; s.last = -1;
        },
        flip(s, i) {
            const q = s.tiles[i];
            if (!q || q.start >= 0) return;
            q.start = s.t; q.from = q.r;
        },
        draw(ctx, s, p, m, dt) {
            const { size, cols, rows, tiles, ox, oy } = s, r = s.rand, dur = 1300;
            s.next -= dt;
            if (s.next <= 0) { s.next = 380 + r() * 700; this.flip(s, Math.floor(r() * tiles.length)); }
            if (m.k > .5) {
                const ci = Math.floor((m.x * s.w - ox) / size), cj = Math.floor((m.y * s.h - oy) / size);
                const idx = cj * cols + ci;
                if (ci >= 0 && cj >= 0 && ci < cols && cj < rows && idx !== s.last) { s.last = idx; this.flip(s, idx); }
            }
            ground(ctx, s, p);
            const mid = new Path2D(), side = new Path2D();
            const h2 = size / 2, off = size * .16;
            for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
                const q = tiles[j * cols + i];
                let ang = q.r * Math.PI / 2;
                if (q.start >= 0) {
                    const u = (s.t - q.start) / dur;
                    if (u >= 1) {
                        q.start = -1; q.r = (q.from + 1) % 4; ang = q.r * Math.PI / 2;
                        if (r() < .4) {
                            const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
                            const ni = i + nb[0], nj = j + nb[1];
                            if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) this.flip(s, nj * cols + ni);
                        }
                    } else ang = (q.from + smooth(u)) * Math.PI / 2;
                }
                const cx = ox + i * size + h2, cy = oy + j * size + h2;
                const ca = Math.cos(ang), sa = Math.sin(ang);
                for (let c = 0; c < 2; c++) {
                    const sx = c ? h2 : -h2, sy = c ? h2 : -h2;
                    const px = cx + sx * ca - sy * sa, py = cy + sx * sa + sy * ca;
                    const a0 = (c ? Math.PI : 0) + ang;
                    mid.moveTo(px + Math.cos(a0) * h2, py + Math.sin(a0) * h2);
                    mid.arc(px, py, h2, a0, a0 + Math.PI / 2);
                    for (const rr of [h2 - off, h2 + off]) {
                        side.moveTo(px + Math.cos(a0) * rr, py + Math.sin(a0) * rr);
                        side.arc(px, py, rr, a0, a0 + Math.PI / 2);
                    }
                }
            }
            ctx.lineCap = 'round';
            ctx.lineWidth = .6; ctx.strokeStyle = p.i(.26); ctx.stroke(side);
            ctx.lineWidth = 1.15; ctx.strokeStyle = p.g(.82); ctx.stroke(mid);
            ctx.lineCap = 'butt';
        }
    });

    /* ───────────────────────── XIX. Automaton strata ───────────────────────── */
    const STRATA = [90, 30, 150, 110, 18, 45, 126, 105, 22, 73];
    const SPARSE = new Set([90, 150, 18, 126, 22, 105]);
    plate('g-automaton', 'Automaton strata',
        'Rows of an elementary cellular automaton laid down like sediment, the rule changing from one stratum to the next.', {
        edge: true,
        init(s, p) {
            const r = s.rand;
            s.cs = clamp(Math.round(Math.min(s.w, s.h) / 55), 3, 7);
            s.cols = Math.ceil(s.w / s.cs) + 1;
            s.R = Math.ceil(s.h / s.cs) + 3;
            s.off = document.createElement('canvas');
            s.off.width = Math.ceil(s.cols * s.cs * s.dpr); s.off.height = Math.ceil(s.R * s.cs * s.dpr);
            s.octx = s.off.getContext('2d');
            s.octx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
            s.row = new Uint8Array(s.cols); s.tmp = new Uint8Array(s.cols);
            s.n = -1; s.acc = 0; s.interval = 170;
            s.si = Math.floor(r() * STRATA.length); s.left = 0; s.bounds = []; s.tone = 0;
            this.stratum(s, true);
            for (let k = 0; k < s.R; k++) this.addRow(s, p);
        },
        stratum(s, first) {
            const r = s.rand;
            s.si = (s.si + 1) % STRATA.length;
            s.rule = STRATA[s.si];
            s.left = 30 + Math.floor(r() * 50);
            s.tone = (s.tone + 1) % 2;
            if (SPARSE.has(s.rule) || first) {
                const dens = SPARSE.has(s.rule) ? .025 + r() * .04 : .5;
                for (let i = 0; i < s.cols; i++) s.row[i] = r() < dens ? 1 : 0;
            }
            if (!first) s.bounds.push(s.n + 1);
        },
        addRow(s, p) {
            if (s.left-- <= 0) this.stratum(s, false);
            else {
                const { row, tmp, cols, rule } = s;
                for (let i = 0; i < cols; i++) {
                    const l = row[(i - 1 + cols) % cols], c = row[i], rr = row[(i + 1) % cols];
                    tmp[i] = (rule >> (l << 2 | c << 1 | rr)) & 1;
                }
                row.set(tmp);
            }
            s.n++;
            const slot = s.n % s.R, o = s.octx, cs = s.cs;
            o.clearRect(0, slot * cs, s.cols * cs, cs);
            o.fillStyle = SPARSE.has(s.rule) ? p.g(.9) : p.g(.3);
            o.beginPath();
            const gap = Math.max(.6, cs * .2);
            for (let i = 0; i < s.cols; i++) if (s.row[i]) o.rect(i * cs, slot * cs, cs - gap, cs - gap);
            o.fill();
            if (s.bounds.length > 8) s.bounds.shift();
        },
        draw(ctx, s, p, m, dt) {
            s.acc += dt;
            while (s.acc >= s.interval) { s.acc -= s.interval; this.addRow(s, p); }
            const { w, h, cs, R, n } = s, frac = s.acc / s.interval;
            ground(ctx, s, p);
            const slot = n % R, dpr = s.dpr, W = s.cols * cs;
            const base = h - frac * cs + cs * .0;
            const y1 = base - (slot + 1) * cs;
            ctx.drawImage(s.off, 0, 0, s.off.width, (slot + 1) * cs * dpr, 0, y1, W, (slot + 1) * cs);
            const rest = R - slot - 1;
            if (rest > 0) ctx.drawImage(s.off, 0, (slot + 1) * cs * dpr, s.off.width, rest * cs * dpr, 0, y1 - rest * cs, W, rest * cs);
            ctx.lineWidth = .7; ctx.strokeStyle = p.i(.45);
            ctx.beginPath();
            for (const b of s.bounds) {
                const y = Math.round(base - (n - b + 1) * cs - .35) + .5;
                if (y > -2 && y < h + 2) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
            }
            ctx.stroke();
        }
    });

    /* ───────────────────────── XX. Stipple archipelago ───────────────────────── */
    plate('g-stipple', 'Stipple archipelago',
        'Islands drawn in Poisson-spaced dots on a chart grid, their coasts slowly redrawn as the ground beneath them shifts.', {
        edge: true, every: 33,
        
        init(s) {
            const r = s.rand, w = s.w, h = s.h;
            const rad = Math.max(3.1, Math.min(w, h) / 72), cell = rad / Math.SQRT2;
            const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), grid = new Int32Array(gw * gh).fill(-1);
            const xs = [], ys = [], active = [];
            const add = (x, y) => { const k = xs.length; xs.push(x); ys.push(y); active.push(k); grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = k; };
            add(r() * w, r() * h);
            while (active.length && xs.length < 9000) {
                const ai = Math.floor(r() * active.length), k = active[ai];
                let found = false;
                for (let tries = 0; tries < 20; tries++) {
                    const a = r() * TAU, d = rad * (1 + r());
                    const x = xs[k] + Math.cos(a) * d, y = ys[k] + Math.sin(a) * d;
                    if (x < 0 || y < 0 || x >= w || y >= h) continue;
                    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
                    let ok = true;
                    for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2) && ok; j++)
                        for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
                            const o = grid[j * gw + i];
                            if (o >= 0) { const dx = xs[o] - x, dy = ys[o] - y; if (dx * dx + dy * dy < rad * rad) { ok = false; break; } }
                        }
                    if (ok) { add(x, y); found = true; break; }
                }
                if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
            }
            s.xs = Float32Array.from(xs); s.ys = Float32Array.from(ys);
            s.u = Float32Array.from(xs, () => r());
            s.rad = rad; s.sc = 3 / Math.max(w, h * 1.4); s.oz = r() * 50;
        },
        draw(ctx, s, p, m) {
            const { w, h, xs, ys, u, rad, sc } = s;
            const z = s.oz + s.t * .00003;
            ground(ctx, s, p);
            const grid = Math.max(40, Math.min(w, h) / 3.2), gp = new Path2D();
            for (let gx = grid / 2; gx < w; gx += grid) for (let gy = grid / 2; gy < h; gy += grid) {
                gp.moveTo(gx - 3, gy); gp.lineTo(gx + 3, gy); gp.moveTo(gx, gy - 3); gp.lineTo(gx, gy + 3);
            }
            ctx.lineWidth = p.light ? .75 : .6; ctx.strokeStyle = p.i(p.light ? .4 : .3); ctx.stroke(gp);
            const B = 3, land = Array.from({ length: B }, () => new Path2D()), sea = new Path2D();
            const px = m.sx * w, py = m.sy * h, sig2 = 2 * (Math.min(w, h) * .16) ** 2;
            for (let k = 0; k < xs.length; k++) {
                const x = xs[k], y = ys[k];
                let n = noise3(x * sc, y * sc, z) + .5 * noise3(x * sc * 2.2 + 5, y * sc * 2.2, z * 1.3);
                if (m.k > .02) { const dx = x - px, dy = y - py; n += .35 * m.k * Math.exp(-(dx * dx + dy * dy) / sig2); }
                const D = smooth((n + .03) / .34);
                if (D > u[k]) {
                    const rr = rad * (p.light ? .2 + .19 * D : .16 + .17 * D), b = Math.min(B - 1, Math.floor(D * B));
                    land[b].moveTo(x + rr, y); land[b].arc(x, y, rr, 0, TAU);
                } else if (u[k] < .07 && n < -.05) {
                    const sr = p.light ? .65 : .5;
                    sea.moveTo(x + sr, y); sea.arc(x, y, sr, 0, TAU);
                }
            }
            ctx.fillStyle = p.i(p.light ? .4 : .32); ctx.fill(sea);
            for (let b = 0; b < B; b++) { ctx.fillStyle = p.light ? p.g(.68 + b * .16) : p.g(.55 + b * .2); ctx.fill(land[b]); }
        }
    });

    /* ───────────────────────── XXI. Halftone swell ───────────────────────── */
    plate('g-halftone', 'Halftone swell',
        'A slow sea swell printed as a halftone screen, the dots growing on the crests and shrinking in the troughs.', {
        edge: true, every: 33,
        
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const sp = clamp(Math.min(w, h) / 24, 6, 13), ang = Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
            const ext = Math.hypot(w, h) / 2 + sp, cx = w / 2, cy = h / 2;
            const px = m.sx * w, py = m.sy * h, sig2 = 2 * (Math.min(w, h) * .14) ** 2;
            const gold = new Path2D(), foam = new Path2D();
            const T = t * .001;
            for (let a = -ext; a <= ext; a += sp) for (let b = -ext; b <= ext; b += sp) {
                const x = cx + a * ca - b * sa, y = cy + a * sa + b * ca;
                if (x < -sp || y < -sp || x > w + sp || y > h + sp) continue;
                const u = x / w, v = y / h;
                const ph = u * 6.2 + v * 2.1 - T * .42 + 1.1 * noise3(u * 1.3, v * 1.3, T * .05);
                let val = Math.pow(.5 + .5 * Math.sin(ph), 2.2) + .3 * Math.pow(.5 + .5 * Math.sin(u * 11 - v * 5.5 - T * .7), 3);
                val = .03 + val * (.3 + .7 * v);
                if (m.k > .02) { const dx = x - px, dy = y - py; val += .3 * m.k * Math.exp(-(dx * dx + dy * dy) / sig2); }
                val = clamp(val, 0, 1);
                const rr = sp * .48 * Math.sqrt(val);
                if (rr < .3) continue;
                const path = val > .55 ? foam : gold;
                path.moveTo(x + rr, y); path.arc(x, y, rr, 0, TAU);
            }
            ctx.fillStyle = p.g(.62); ctx.fill(gold);
            ctx.fillStyle = p.g(.95); ctx.fill(foam);
        }
    });

    /* ───────────────────────── XXII. Ripple interference ───────────────────────── */
    plate('g-interference', 'Ripple interference',
        'Rings spreading from two sources cross one another, and the moiré between them marks where the waves agree.', {
        edge: true,
        init(s) { s.ax = .5; s.ay = .5; },
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const lam = clamp(Math.min(w, h) / 15, 8, 22), ph = (t * .011) % lam;
            const x1 = w * (.34 + .07 * Math.sin(t * .00007)), y1 = h * (.5 + .14 * Math.cos(t * .00005));
            const tx = m.k > .3 ? m.sx : .66 + .07 * Math.cos(t * .00006), ty = m.k > .3 ? m.sy : .5 + .14 * Math.sin(t * .00008);
            s.ax += (tx - s.ax) * .03; s.ay += (ty - s.ay) * .03;
            const x2 = w * s.ax, y2 = h * s.ay;
            const far = (x, y) => Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
            const rings = (x, y, style, width, k0) => {
                const max = far(x, y);
                for (let r = ph + k0; r < max; r += lam) {
                    const fadeIn = Math.min(1, r / (lam * 1.5)), fall = Math.pow(1 - r / max, .7);
                    ctx.strokeStyle = style(fadeIn * fall);
                    ctx.lineWidth = width;
                    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
                }
            };
            rings(x2, y2, a => p.i(.42 * a), .7, 0);
            rings(x1, y1, a => p.g(.85 * a), .9, 0);
            ctx.fillStyle = p.g(1); ctx.beginPath(); ctx.arc(x1, y1, 1.8, 0, TAU); ctx.fill();
            ctx.fillStyle = p.i(.8); ctx.beginPath(); ctx.arc(x2, y2, 1.5, 0, TAU); ctx.fill();
        }
    });

    /* ───────────────────────── XXIII. Clifford attractor ───────────────────────── */
    /* constants chosen by search so that the slow drift never collapses the attractor into a handful of points */
    const CLIFF = [[1.92, -1.74, -1.06, -.24], [-1.69, -1.93, 1.51, -.61], [-1.17, -1.74, -1.49, 1.97], [-1.49, -1.11, 1.72, 1.49],
        [-1.71, 1.75, -1.19, -.58], [1.29, -1.2, -1.65, -1.18], [-1.6, 1.6, .7, -1.0], [-1.33, -1.18, 1.76, -1.76]];
    plate('g-attractor', 'Clifford attractor',
        'Millions of points from one simple iterated map settle into a veil, which slowly changes shape as its constants drift.', {
        edge: true,
        init(s) {
            const scale = Math.min(1, Math.sqrt(150000 / (s.w * s.h)));
            s.bw = Math.max(40, Math.round(s.w * scale)); s.bh = Math.max(30, Math.round(s.h * scale));
            s.buf = new Float32Array(s.bw * s.bh);
            s.off = document.createElement('canvas'); s.off.width = s.bw; s.off.height = s.bh;
            s.octx = s.off.getContext('2d', { willReadFrequently: true });
            s.img = s.octx.createImageData(s.bw, s.bh);
            s.px = new Uint32Array(s.img.data.buffer);
            s.k = Math.floor(s.rand() * CLIFF.length); s.x = .1; s.y = .1; s.vmax = 1; s.lut = null; s.since = 0;
            this.iterate(s, s.reduced ? 700000 : 160000);
            s.vmax = 0;
        },
        params(s) {
            const c = CLIFF[s.k], tt = s.t;
            return [c[0] + .03 * Math.sin(tt * .00011), c[1] + .03 * Math.cos(tt * .00009), c[2] + .03 * Math.sin(tt * .00007 + 1), c[3] + .03 * Math.cos(tt * .00013 + 2)];
        },
        iterate(s, count) {
            const [a, b, c, d] = this.params(s);
            const ex = 1 + Math.abs(c), ey = 1 + Math.abs(d);
            const k = Math.min(s.bw / (2 * ex), s.bh / (2 * ey)) * .92;
            const ox = s.bw / 2, oy = s.bh / 2, bw = s.bw, bh = s.bh, buf = s.buf;
            let x = s.x, y = s.y;
            for (let i = 0; i < count; i++) {
                const nx = Math.sin(a * y) + c * Math.cos(a * x), ny = Math.sin(b * x) + d * Math.cos(b * y);
                x = nx; y = ny;
                const X = (ox + x * k) | 0, Y = (oy + y * k) | 0;
                if (X >= 0 && Y >= 0 && X < bw && Y < bh) buf[Y * bw + X] += 1;
            }
            s.x = x; s.y = y;
        },
        draw(ctx, s, p, m, dt) {
            s.since += dt;
            if (s.since > 48000) { s.since = 0; s.k = (s.k + 1) % CLIFF.length; }
            const decay = s.since < 1500 ? .93 : .975;
            const buf = s.buf;
            if (dt > 0) { for (let i = 0; i < buf.length; i++) buf[i] *= decay; this.iterate(s, 14000); }
            let sum = 0, cnt = 0;
            for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (v > .05) { sum += v; cnt++; } }
            const ref = cnt ? sum / cnt * 7 : 4;
            if (dt > 0 && s.since > 3000 && cnt < buf.length * .004) { s.since = 0; s.k = (s.k + 1) % CLIFF.length; }
            if (!s.lut) {
                const lut = new Uint32Array(256), bg = p.bg, g = p.gold, ink = p.ink;
                for (let i = 0; i < 256; i++) {
                    const v = i / 255;
                    let c;
                    if (v < .75) { const k = Math.pow(v / .75, p.light ? .8 : 1.05); c = bg.map((b, j) => b + (g[j] - b) * k); }
                    else { const k = (v - .75) / .25 * (p.light ? .45 : .55); c = g.map((b, j) => b + (ink[j] - b) * k); }
                    lut[i] = (255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
                }
                s.lut = lut;
            }
            s.vmax = s.vmax > 0 && dt > 0 ? s.vmax + (ref - s.vmax) * .2 : ref;
            const norm = 255 / Math.log1p(Math.max(3, s.vmax)), px = s.px, lut = s.lut;
            for (let i = 0; i < buf.length; i++) {
                const v = buf[i];
                px[i] = lut[v < .05 ? 0 : Math.min(255, (Math.log1p(v) * norm) | 0)];
            }
            s.octx.putImageData(s.img, 0, 0);
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
            ctx.drawImage(s.off, 0, 0, s.w, s.h);
        }
    });

    /* ───────────────────────── XXIV. Branching growth ───────────────────────── */
    plate('g-growth', 'Branching growth',
        'A tree grows from a single stem, branch by branch, holds for a moment, and gives way to a new one.', {
        edge: true,
        init(s) { s.cycle = 0; this.fresh(s); s.cycle = s.reduced ? s.total + 1000 : s.total * .45; },
        fresh(s) {
            const r = s.rand, segs = [];
            const maxD = 9;
            const grow = (parent, depth, len, rel, birth) => {
                const dur = 260 + len * 30;
                const idx = segs.push({ parent, depth, len, rel, birth, dur, leaf: false, x0: 0, y0: 0, x1: 0, y1: 0, abs: 0 }) - 1;
                if (depth >= maxD || len < 2.5) { segs[idx].leaf = true; return; }
                let n = depth < 2 ? 2 : r() < .12 ? 3 : r() < .08 ? 1 : 2;
                const spread = .32 + r() * .28;
                for (let c = 0; c < n; c++) {
                    const pos = n === 1 ? 0 : (c / (n - 1) - .5) * 2;
                    grow(idx, depth + 1, len * (.7 + r() * .13), pos * spread + (r() - .5) * .22, birth + dur * (.8 + r() * .4));
                }
            };
            const len = s.h * (.2 + r() * .04);
            grow(-1, 0, len, (r() - .5) * .12, 0);
            s.segs = segs; s.maxD = maxD;
            s.total = segs.reduce((mx, q) => Math.max(mx, q.birth + q.dur), 0);
            s.speed = s.total / 13000;
            s.rootX = s.w * (.4 + r() * .2);
            s.cycle = 0;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, t } = s;
            s.cycle += dt * s.speed;
            const hold = 8000 * s.speed, fadeT = 2600 * s.speed;
            if (s.cycle > s.total + hold + fadeT) this.fresh(s);
            const out = 1 - smooth((s.cycle - s.total - hold) / fadeT);
            ground(ctx, s, p);
            const paths = Array.from({ length: s.maxD + 1 }, () => new Path2D()), buds = new Path2D();
            const wind = (m.sx - .5) * .05;
            for (const q of s.segs) {
                if (s.cycle < q.birth) continue;
                const par = q.parent >= 0 ? s.segs[q.parent] : null;
                const sway = .018 * q.depth * Math.sin(t * .0006 + q.depth * .55) + wind * q.depth * .3;
                q.abs = (par ? par.abs : -Math.PI / 2) + q.rel + sway;
                q.x0 = par ? par.x1 : s.rootX; q.y0 = par ? par.y1 : h + 2;
                const f = Math.min(1, (s.cycle - q.birth) / q.dur);
                q.x1 = q.x0 + Math.cos(q.abs) * q.len * f; q.y1 = q.y0 + Math.sin(q.abs) * q.len * f;
                paths[q.depth].moveTo(q.x0, q.y0); paths[q.depth].lineTo(q.x1, q.y1);
                if (q.leaf && f >= 1) { buds.moveTo(q.x1 + 1.1, q.y1); buds.arc(q.x1, q.y1, 1.1, 0, TAU); }
            }
            ctx.lineCap = 'round';
            for (let d = 0; d <= s.maxD; d++) {
                const tip = d >= s.maxD - 2;
                ctx.lineWidth = Math.max(.45, (s.maxD - d) * .42 + .3);
                ctx.strokeStyle = tip ? p.i(.42 * out) : p.g((.9 - d * .03) * out);
                ctx.stroke(paths[d]);
            }
            ctx.fillStyle = p.g(.85 * out); ctx.fill(buds);
            ctx.lineCap = 'butt';
            ctx.strokeStyle = p.i(.3); ctx.lineWidth = .6;
            ctx.beginPath(); ctx.moveTo(0, h - .5); ctx.lineTo(w, h - .5); ctx.stroke();
        }
    });

    /* ───────────────────────── XXV. Tide tables ───────────────────────── */
    const TIDES = [[1, 12.4206, 0], [.46, 12, .7], [.19, 12.6583, 2.1], [.3, 23.9345, 1.1], [.2, 25.8193, 2.6]];
    plate('g-tides', 'Tide tables',
        'A stack of daily tide curves built from the real lunar and solar constituents, so spring and neap tides come and go.', {
        edge: true, every: 33,
        
        draw(ctx, s, p, m) {
            const { w, h, t } = s;
            ground(ctx, s, p);
            const N = clamp(Math.round(h / 10), 14, 34), top = h * .14, dy = (h * .86) / N, A = dy * 2.4;
            const day0 = t * .00025 + 40, frac = day0 % 1, d0 = Math.floor(day0);
            const steps = clamp(Math.round(w / 4), 60, 160), hours = 36;
            const H = (T) => { let v = 0; for (const [a, per, ph] of TIDES) v += a * Math.cos(TAU * T / per + ph); return v / 2.15; };
            ctx.lineJoin = 'round';
            for (let j = 0; j <= N; j++) {
                const day = d0 + j, base = top + (j - frac) * dy;
                const vis = Math.min(1, (j - frac + 1) / 2);
                if (vis <= 0) continue;
                ctx.beginPath();
                for (let i = 0; i <= steps; i++) {
                    const u = i / steps, x = u * w;
                    const env = .3 + .7 * Math.pow(Math.sin(Math.PI * u), .8);
                    const y = base - A * env * (.5 + .5 * H(day * 24 + u * hours + (m.sx - .5) * 3));
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.lineTo(w, base + dy * 3); ctx.lineTo(0, base + dy * 3); ctx.closePath();
                ctx.fillStyle = p.bgS; ctx.fill();
                const k = j / N;
                ctx.lineWidth = (p.light ? .8 : .65) + k * .45;
                ctx.strokeStyle = day % 7 === 0 ? p.i((.25 + .35 * k) * vis) : p.light ? p.g((.42 + .5 * k) * vis) : p.g((.3 + .6 * k) * vis);
                ctx.stroke();
            }
        }
    });

    /* ───────────────────────── XXVI. Ink marbling ───────────────────────── */
    plate('g-marbling', 'Ink marbling',
        'Drops of ink spread on a size bath and are combed through, as in a marbled endpaper.', {
        edge: true,
        init(s, p) {
            s.polys = []; s.events = []; s.ci = 0; s.dirty = true; s.next = 0; s.frame = 0;
            s.maxLen = Math.max(3.5, Math.min(s.w, s.h) / 70);
            const r = s.rand, w = s.w, h = s.h, base = Math.min(w, h);
            const nx = Math.max(2, Math.round(w / base * 2)), ny = 2;
            const spots = [];
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) spots.push([w * (i + .5 + (r() - .5) * .5) / nx, h * (j + .5 + (r() - .5) * .5) / ny]);
            spots.sort(() => r() - .5);
            let area = 0, k = 0;
            while (area < w * h * 1.5 && k < 60) {
                const [x, y] = spots[k++ % spots.length];
                const n = 2 + Math.floor(r() * 3);
                for (let q = 0; q < n; q++) { const R = base * (.07 + r() * .1); this.drop(s, x, y, R, true); area += Math.PI * R * R; }
            }
            this.comb(s, true);
            if (r() < .6) this.comb(s, true);
            this.cull(s);
            s.next = 1200;
        },
        colour(s, p) {
            const k = p.light ? 1 : .66;
            const set = [p.mix(p.bg, p.gold, .6 * k), p.bg, p.mix(p.bg, p.ink, .11 * k), p.mix(p.bg, p.gold, .32 * k), p.bg, p.mix(p.bg, p.gold, .8 * k)];
            return set[s.ci++ % set.length];
        },
        push(s, cx, cy, dr2) {
            for (const q of s.polys) {
                const xs = q.xs, ys = q.ys;
                for (let i = 0; i < xs.length; i++) {
                    const dx = xs[i] - cx, dy = ys[i] - cy, d2 = dx * dx + dy * dy + 1e-6;
                    const k = Math.sqrt(1 + dr2 / d2);
                    xs[i] = cx + dx * k; ys[i] = cy + dy * k;
                }
            }
        },
        drop(s, cx, cy, R, instant) {
            if (instant) {
                this.push(s, cx, cy, R * R);
                s.polys.push(this.circle(s, cx, cy, R, null));
                this.resample(s);
            } else s.events.push({ type: 'drop', cx, cy, R, r2: 0, age: 0, dur: 1500, poly: null });
        },
        circle(s, cx, cy, R, col) {
            const n = clamp(Math.round(TAU * R / s.maxLen), 24, 400), xs = [], ys = [];
            for (let i = 0; i < n; i++) { const a = i / n * TAU; xs.push(cx + Math.cos(a) * R); ys.push(cy + Math.sin(a) * R); }
            return { xs, ys, col: col || this.colour(s, palette()) };
        },
        tine(s, bx, by, mx, my, alpha, lam, spacing) {
            const nx = -my, ny = mx;
            for (const q of s.polys) {
                const xs = q.xs, ys = q.ys;
                for (let i = 0; i < xs.length; i++) {
                    let d = (xs[i] - bx) * nx + (ys[i] - by) * ny;
                    if (spacing) { d = ((d % spacing) + spacing) % spacing; d = Math.min(d, spacing - d); } else d = Math.abs(d);
                    const z = alpha * lam / (d + lam);
                    xs[i] += mx * z; ys[i] += my * z;
                }
            }
        },
        comb(s, instant) {
            const r = s.rand, horiz = r() < .5;
            const mx = horiz ? (r() < .5 ? 1 : -1) : 0, my = horiz ? 0 : (r() < .5 ? 1 : -1);
            const spacing = Math.min(s.w, s.h) * (.14 + r() * .1), total = Math.min(s.w, s.h) * (.12 + r() * .1), lam = spacing * .22;
            if (instant) { this.tine(s, s.w / 2, s.h / 2, mx, my, total, lam, spacing); this.resample(s); }
            else s.events.push({ type: 'comb', mx, my, spacing, total, lam, age: 0, dur: 4200, done: 0 });
        },
        resample(s) {
            const L2 = s.maxLen * s.maxLen;
            for (const q of s.polys) {
                if (q.xs.length > 2400) continue;
                const xs = q.xs, ys = q.ys, nx = [], ny = [];
                for (let i = 0; i < xs.length; i++) {
                    const j = (i + 1) % xs.length;
                    nx.push(xs[i]); ny.push(ys[i]);
                    const dx = xs[j] - xs[i], dy = ys[j] - ys[i];
                    if (dx * dx + dy * dy > L2) { nx.push(xs[i] + dx / 2); ny.push(ys[i] + dy / 2); }
                }
                q.xs = nx; q.ys = ny;
            }
        },
        inside(q, x, y) {
            let c = false;
            const xs = q.xs, ys = q.ys;
            for (let i = 0, j = xs.length - 1; i < xs.length; j = i++)
                if ((ys[i] > y) !== (ys[j] > y) && x < (xs[j] - xs[i]) * (y - ys[i]) / (ys[j] - ys[i]) + xs[i]) c = !c;
            return c;
        },
        cull(s) {
            const w = s.w, h = s.h;
            for (let k = s.polys.length - 1; k > 0; k--) {
                const q = s.polys[k];
                let any = false;
                for (let i = 0; i < q.xs.length; i++) if (q.xs[i] > -2 && q.xs[i] < w + 2 && q.ys[i] > -2 && q.ys[i] < h + 2) { any = true; break; }
                if (any) continue;
                if (this.inside(q, 0, 0) && this.inside(q, w, 0) && this.inside(q, 0, h) && this.inside(q, w, h) && this.inside(q, w / 2, h / 2)) {
                    s.polys.splice(0, k); return;
                }
                if (!this.inside(q, w / 2, h / 2) && !this.inside(q, 0, 0)) {
                    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
                    for (let i = 0; i < q.xs.length; i++) { minx = Math.min(minx, q.xs[i]); maxx = Math.max(maxx, q.xs[i]); miny = Math.min(miny, q.ys[i]); maxy = Math.max(maxy, q.ys[i]); }
                    if (maxx < 0 || minx > w || maxy < 0 || miny > h) s.polys.splice(k, 1);
                }
            }
            if (s.polys.length > 70) s.polys.splice(0, s.polys.length - 70);
        },
        draw(ctx, s, p, m, dt) {
            const r = s.rand;
            s.next -= dt;
            if (s.next <= 0 && !s.events.length) {
                if (r() < .22 && s.polys.length > 6) { this.comb(s, false); s.next = 4800; }
                else {
                    const x = s.w * (.12 + r() * .76), y = s.h * (.12 + r() * .76), n = 2 + Math.floor(r() * 3);
                    for (let k = 0; k < n; k++) s.events.push({ type: 'drop', cx: x, cy: y, R: Math.min(s.w, s.h) * (.05 + r() * .06), r2: 0, age: -k * 1300, dur: 1500, poly: null });
                    s.next = 1500 + n * 1300 + 1800;
                }
            }
            if (m.k > .5 && (m.vx || m.vy)) {
                const sp = Math.hypot(m.vx, m.vy);
                if (sp > .5) {
                    const lam = Math.min(s.w, s.h) * .05, ux = m.vx / sp, uy = m.vy / sp, bx = m.x * s.w, by = m.y * s.h;
                    for (const q of s.polys) for (let i = 0; i < q.xs.length; i++) {
                        const dx = q.xs[i] - bx, dy = q.ys[i] - by, d = Math.hypot(dx, dy);
                        const z = Math.min(sp, 30) * .35 * lam / (d + lam) * Math.exp(-d / (lam * 4));
                        q.xs[i] += ux * z; q.ys[i] += uy * z;
                    }
                    s.dirty = true;
                }
            }
            m.vx = 0; m.vy = 0;
            for (let k = s.events.length - 1; k >= 0; k--) {
                const e = s.events[k];
                e.age += dt;
                if (e.age < 0) continue;
                const u = smooth(Math.min(1, e.age / e.dur));
                if (e.type === 'drop') {
                    const r2 = (e.R * u) ** 2, d = r2 - e.r2;
                    if (!e.poly) { e.poly = { xs: [], ys: [], col: this.colour(s, p) }; }
                    const idx = s.polys.indexOf(e.poly);
                    if (idx >= 0) s.polys.splice(idx, 1);
                    if (d > 0) this.push(s, e.cx, e.cy, d);
                    e.r2 = r2;
                    const c = this.circle(s, e.cx, e.cy, Math.max(.5, Math.sqrt(r2)), e.poly.col);
                    e.poly.xs = c.xs; e.poly.ys = c.ys;
                    s.polys.push(e.poly);
                } else {
                    const a = e.total * u - e.done; e.done = e.total * u;
                    this.tine(s, s.w / 2, s.h / 2, e.mx, e.my, a, e.lam, e.spacing);
                }
                s.dirty = true;
                if (u >= 1) s.events.splice(k, 1);
            }
            s.frame++;
            if (s.dirty && s.frame % 3 === 0) this.resample(s);
            if (s.frame % 40 === 0) this.cull(s);
            if (!s.dirty && !s.always) return false;
            s.dirty = false;
            ground(ctx, s, p);
            ctx.lineWidth = .5; ctx.strokeStyle = p.g(.4); ctx.lineJoin = 'round';
            for (const q of s.polys) {
                const xs = q.xs, ys = q.ys;
                ctx.beginPath(); ctx.moveTo(xs[0], ys[0]);
                for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
                ctx.closePath();
                ctx.fillStyle = p.rgb(q.col); ctx.fill(); ctx.stroke();
            }
        }
    });

    /* ═════════════════════════ ten further plates, XXVII to XXXVI ═════════════════════════ */
    const SERIF = '"Newsreader", "Iowan Old Style", Georgia, serif';

    /* separable box blur on a square float field, used to round off rasterised relief */
    function boxBlur(a, n, r) {
        r = Math.max(1, Math.round(r));
        const tmp = new Float32Array(a.length), k = 1 / (2 * r + 1);
        for (let y = 0; y < n; y++) {
            const o = y * n;
            let acc = 0;
            for (let i = -r; i <= r; i++) acc += a[o + clamp(i, 0, n - 1)];
            for (let x = 0; x < n; x++) {
                tmp[o + x] = acc * k;
                acc += a[o + Math.min(n - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
            }
        }
        for (let x = 0; x < n; x++) {
            let acc = 0;
            for (let i = -r; i <= r; i++) acc += tmp[clamp(i, 0, n - 1) * n + x];
            for (let y = 0; y < n; y++) {
                a[y * n + x] = acc * k;
                acc += tmp[Math.min(n - 1, y + r + 1) * n + x] - tmp[Math.max(0, y - r) * n + x];
            }
        }
        return a;
    }

    /* ───────────────────────── XXVII. Median line ───────────────────────── */
    plate('g-median', 'Median line',
        'Two opposite coasts and the line of points equidistant from both, fixed by turning points and redrawn as the shores slowly shift.', {
        edge: true, every: 33,
        init(s) {
            s.oz = s.rand() * 100;
            s.step = clamp(Math.min(s.w, s.h) / 60, 3, 6);
            s.x0 = -s.step * 8;
            s.n = Math.ceil((s.w - 2 * s.x0) / s.step) + 1;
            s.ay = new Float32Array(s.n); s.by = new Float32Array(s.n);
            s.ni = 40; s.ix = new Float32Array(s.ni); s.iy = new Float32Array(s.ni);
            const g = Math.max(3.5, Math.min(s.w, s.h) / 40);
            s.hatch = new Path2D();
            for (let c = -s.h; c < s.w + s.h; c += g) { s.hatch.moveTo(c, 0); s.hatch.lineTo(c + s.h, s.h); }
        },
        draw(ctx, s, p, m) {
            const { w, h, t, n, step, x0, ay, by, ix, iy, ni } = s;
            const z = s.oz + t * .00004, sc = 2.4 / w;
            for (let k = 0; k < n; k++) {
                const x = x0 + k * step, u = x / w;
                ay[k] = h * (.2 + .05 * Math.sin(u * 2.3 + 1)) + h * .13 * noise3(x * sc, 1.3, z) + h * .035 * noise3(x * sc * 3.3, 7.7, z * 1.5);
                by[k] = h * (.81 - .05 * Math.sin(u * 1.9)) + h * .13 * noise3(x * sc, 9.1, z) + h * .035 * noise3(x * sc * 3.3, 3.3, z * 1.5);
            }
            const at = (arr, x) => { const f = (x - x0) / step, k = clamp(Math.floor(f), 0, n - 2), u = f - k; return arr[k] + (arr[k + 1] - arr[k]) * u; };
            /* an island off the lower coast, which the pointer can tow about */
            const ir = Math.min(w, h) * .05;
            const icx = lerp(w * .63, clamp(m.sx * w, w * .1, w * .9), m.k * .8);
            const ya = at(ay, icx), yb = at(by, icx);
            let lo = ya + ir * 2.6, hi = yb - ir * 1.8;
            if (lo > hi) lo = hi = (lo + hi) / 2;
            const icy = clamp(lerp(lerp(ya, yb, .66), m.sy * h, m.k * .8), lo, hi);
            for (let k = 0; k < ni; k++) {
                const a = k / ni * TAU, ca = Math.cos(a), sa = Math.sin(a);
                const rr = ir * (1 + .4 * noise3(ca * 1.1 + 20, sa * 1.1, z * 2));
                ix[k] = icx + ca * rr * 1.35; iy[k] = icy + sa * rr;
            }
            let hit = 0;
            const nearCoast = (arr, x, y, R) => {
                let best = 1e12;
                const k0 = Math.max(0, Math.floor((x - R - x0) / step)), k1 = Math.min(n - 1, Math.ceil((x + R - x0) / step));
                for (let k = k0; k <= k1; k++) { const dx = x0 + k * step - x, dy = arr[k] - y, d = dx * dx + dy * dy; if (d < best) { best = d; hit = k; } }
                return best;
            };
            const nearB = (x, y, R) => {
                let best = nearCoast(by, x, y, R), bx = x0 + hit * step, byy = by[hit];
                for (let k = 0; k < ni; k++) { const dx = ix[k] - x, dy = iy[k] - y, d = dx * dx + dy * dy; if (d < best) { best = d; bx = ix[k]; byy = iy[k]; } }
                s.hx = bx; s.hy = byy;
                return best;
            };
            /* the median itself, solved only at its turning points and joined by straight segments */
            const ts = clamp(w / 16, 14, 42), mx = [], my = [];
            for (let x = -ts; x <= w + ts; x += ts) {
                let a = at(ay, x), b = at(by, x);
                const R = b - a;
                for (let it = 0; it < 14; it++) { const y = (a + b) / 2; if (nearCoast(ay, x, y, R) < nearB(x, y, R)) a = y; else b = y; }
                mx.push(x); my.push((a + b) / 2);
            }
            const medAt = x => { const f = (x + ts) / ts, k = clamp(Math.floor(f), 0, mx.length - 2), u = f - k; return my[k] + (my[k + 1] - my[k]) * u; };
            ground(ctx, s, p);
            /* land, hatched */
            const land = new Path2D();
            land.moveTo(x0, -2);
            for (let k = 0; k < n; k++) land.lineTo(x0 + k * step, ay[k]);
            land.lineTo(x0 + (n - 1) * step, -2); land.closePath();
            land.moveTo(x0, h + 2);
            for (let k = 0; k < n; k++) land.lineTo(x0 + k * step, by[k]);
            land.lineTo(x0 + (n - 1) * step, h + 2); land.closePath();
            land.moveTo(ix[0], iy[0]);
            for (let k = 1; k < ni; k++) land.lineTo(ix[k], iy[k]);
            land.closePath();
            ctx.save(); ctx.clip(land);
            ctx.lineWidth = .5; ctx.strokeStyle = p.i(p.light ? .22 : .17); ctx.stroke(s.hatch);
            ctx.restore();
            ctx.lineWidth = .8; ctx.strokeStyle = p.i(.62); ctx.lineJoin = 'round'; ctx.stroke(land);
            /* territorial sea limits: the envelope of arcs swung from the coast, stopped at the median */
            const L = Math.min(w, h) * .085, cs = 3, la = new Path2D(), lb = new Path2D();
            let pa = false, pb = false;
            const kL = Math.ceil(L / step);
            for (let x = 0; x <= w; x += cs) {
                const kc = Math.round((x - x0) / step);
                let ea = -1e9, eb = 1e9;
                for (let k = Math.max(0, kc - kL); k <= Math.min(n - 1, kc + kL); k++) {
                    const dx = x0 + k * step - x, q = L * L - dx * dx;
                    if (q <= 0) continue;
                    const r = Math.sqrt(q);
                    if (ay[k] + r > ea) ea = ay[k] + r;
                    if (by[k] - r < eb) eb = by[k] - r;
                }
                const md = medAt(x);
                if (ea < md - 1) { pa ? la.lineTo(x, ea) : la.moveTo(x, ea); pa = true; } else pa = false;
                if (eb > md + 1) { pb ? lb.lineTo(x, eb) : lb.moveTo(x, eb); pb = true; } else pb = false;
            }
            for (let k = 0; k <= ni; k++) {
                const j = k % ni, dx = ix[j] - icx, dy = iy[j] - icy, d = Math.hypot(dx, dy) || 1, f = (d + L * .8) / d;
                k ? lb.lineTo(icx + dx * f, icy + dy * f) : lb.moveTo(icx + dx * f, icy + dy * f);
            }
            ctx.setLineDash([2, 3]); ctx.lineWidth = .6; ctx.strokeStyle = p.i(.36);
            ctx.stroke(la); ctx.stroke(lb);
            ctx.setLineDash([]);
            /* a construction point slides along the line, with the circle that touches both coasts */
            const px = w * (.16 + .68 * (.5 - .5 * Math.cos(t * .00011))), py = medAt(px);
            const dA = Math.sqrt(nearCoast(ay, px, py, h)), ax = x0 + hit * step, aY = ay[hit];
            nearB(px, py, h);
            ctx.lineWidth = .5; ctx.strokeStyle = p.i(.3);
            ctx.beginPath(); ctx.arc(px, py, dA, 0, TAU); ctx.stroke();
            ctx.strokeStyle = p.g(.55); ctx.lineWidth = .6;
            ctx.beginPath(); ctx.moveTo(ax, aY); ctx.lineTo(px, py); ctx.lineTo(s.hx, s.hy); ctx.stroke();
            ctx.fillStyle = p.g(.85);
            ctx.beginPath(); ctx.arc(ax, aY, 1.5, 0, TAU); ctx.moveTo(s.hx + 1.5, s.hy); ctx.arc(s.hx, s.hy, 1.5, 0, TAU); ctx.fill();
            /* the line, and its turning points */
            ctx.lineWidth = 1.2; ctx.strokeStyle = p.g(.95);
            ctx.beginPath();
            for (let k = 0; k < mx.length; k++) k ? ctx.lineTo(mx[k], my[k]) : ctx.moveTo(mx[k], my[k]);
            ctx.stroke();
            ctx.fillStyle = p.bgS; ctx.lineWidth = .8;
            const tp = new Path2D();
            for (let k = 0; k < mx.length; k++) { tp.moveTo(mx[k] + 1.9, my[k]); tp.arc(mx[k], my[k], 1.9, 0, TAU); }
            ctx.fill(tp); ctx.stroke(tp);
        }
    });

    /* ───────────────────────── XXVIII. Ratification map ───────────────────────── */
    plate('g-ratify', 'Ratification map',
        'States sign a new treaty one after another and later ratify it, until enough have joined for it to enter into force.', {
        edge: false,
        init(s) {
            const r = s.rand, w = s.w, h = s.h;
            const sp = clamp(Math.min(w, h) / 23, 5.5, 11), rh = sp * Math.sqrt(3) / 2;
            s.sp = sp; s.fs = clamp(h / 24, 7, 10);
            const sc = 3.4 / Math.max(w, h * 1.2), oz = r() * 100;
            const top = rh, bottom = h - s.fs * 3.6;
            const cells = new Map(), pts = [];
            const pos = (j, i) => [(j % 2 ? sp / 2 : 0) + sp * (i + .5), top + j * rh];
            const J = Math.floor((bottom - top) / rh), I = Math.floor(w / sp) - 1;
            /* land is the highest two fifths of a noise field that falls away towards the margins */
            const vals = [];
            for (let j = 0; j <= J; j++) for (let i = 0; i < I; i++) {
                const [x, y] = pos(j, i);
                const e = Math.hypot(x / w - .5, (y - top) / (bottom - top) - .5) * 2;
                if (x < sp * 1.6 || x > w - sp * 1.6 || y < sp * 1.2) continue;
                vals.push([noise3(x * sc, y * sc, oz) + .45 * noise3(x * sc * 2.2, y * sc * 2.2, oz + 3) - .8 * smooth((e - .4) / .6), j, i, x, y]);
            }
            const cut = vals.map(v => v[0]).sort((a, b) => b - a)[Math.floor(vals.length * .4)];
            for (const [v, j, i, x, y] of vals) if (v >= cut) { cells.set(j * 10000 + i, pts.length); pts.push({ x, y, j, i, st: -1 }); }
            /* states: clusters of cells around scattered capitals */
            const K = Math.max(10, Math.round(pts.length / 12));
            const caps = [];
            for (let k = 0; k < K * 4 && caps.length < K; k++) {
                const q = pts[Math.floor(r() * pts.length)];
                if (caps.every(c => (c.x - q.x) ** 2 + (c.y - q.y) ** 2 > (sp * 2.2) ** 2)) caps.push(q);
            }
            for (const q of pts) {
                let best = 1e12;
                caps.forEach((c, k) => { const d = (c.x - q.x) ** 2 + (c.y - q.y) ** 2 * 1.15; if (d < best) { best = d; q.st = k; } });
            }
            s.K = caps.length; s.pts = pts;
            /* borders between states and the coastline, as hexagon edges */
            const borders = new Path2D(), coast = new Path2D(), adj = Array.from({ length: s.K }, () => new Set());
            const e2 = sp / Math.sqrt(3) / 2;
            const edge = (path, x, y, nx, ny) => {
                const mxp = (x + nx) / 2, myp = (y + ny) / 2, dx = nx - x, dy = ny - y, l = Math.hypot(dx, dy);
                path.moveTo(mxp - dy / l * e2, myp + dx / l * e2); path.lineTo(mxp + dy / l * e2, myp - dx / l * e2);
            };
            for (const q of pts) {
                const odd = q.j % 2;
                const nb = [[0, 1], [0, -1], [-1, odd ? 0 : -1], [-1, odd ? 1 : 0], [1, odd ? 0 : -1], [1, odd ? 1 : 0]];
                for (const [dj, di] of nb) {
                    const jj = q.j + dj, ii = q.i + di, k = cells.get(jj * 10000 + ii);
                    const [nx, ny] = pos(jj, ii);
                    if (k === undefined) edge(coast, q.x, q.y, nx, ny);
                    else if (pts[k].st !== q.st && (dj > 0 || (dj === 0 && di > 0))) { edge(borders, q.x, q.y, nx, ny); adj[q.st].add(pts[k].st); adj[pts[k].st].add(q.st); }
                }
            }
            s.borders = borders; s.coast = coast; s.adj = adj.map(a => [...a]);
            s.year = 1950 + Math.floor(r() * 50);
            this.fresh(s);
            /* start part way through a treaty; a still frame waits until it has entered into force */
            for (let k = 0; k < 600; k++) {
                this.step(s, 50);
                if (s.reduced ? s.force >= 0 && s.clock - s.force > 2000 : s.clock >= 9000) break;
            }
        },
        fresh(s) {
            const r = s.rand, K = s.K;
            s.status = new Int8Array(K); s.changed = new Float32Array(K).fill(-1e9); s.ratAt = new Float32Array(K).fill(1e12);
            s.will = Array.from({ length: K }, () => r() < .86);
            s.need = Math.max(3, Math.round(K * .35)); s.force = -1; s.done = -1;
            s.clock = 0; s.next = 600; s.year += 3 + Math.floor(r() * 9); if (s.year > 2024) s.year = 1950 + Math.floor(r() * 20);
        },
        step(s, dt) {
            const r = s.rand, K = s.K;
            s.clock += dt;
            if (s.done >= 0) {
                if (s.clock - s.done > 8000) this.fresh(s);
                return;
            }
            s.next -= dt;
            if (s.next <= 0) {
                s.next = 260 + r() * 520;
                let total = 0;
                const wts = new Float32Array(K);
                for (let k = 0; k < K; k++) {
                    if (s.status[k] || !s.will[k]) continue;
                    let wgt = 1;
                    for (const a of s.adj[k]) if (s.status[a]) wgt += 3;
                    wts[k] = wgt; total += wgt;
                }
                if (total > 0) {
                    let pick = r() * total, k = 0;
                    for (; k < K; k++) { pick -= wts[k]; if (pick <= 0 && wts[k] > 0) break; }
                    k = Math.min(k, K - 1);
                    if (!s.status[k] && s.will[k]) this.sign(s, k);
                }
            }
            let rat = 0, pending = 0;
            for (let k = 0; k < K; k++) {
                if (s.status[k] === 1 && s.clock >= s.ratAt[k]) { s.status[k] = 2; s.changed[k] = s.clock; }
                if (s.status[k] === 2) rat++;
                if (s.will[k] && s.status[k] < 2) pending++;
            }
            if (s.force < 0 && rat >= s.need) s.force = s.clock;
            if (!pending) s.done = s.clock;
        },
        sign(s, k) {
            s.status[k] = 1; s.changed[k] = s.clock; s.ratAt[k] = s.clock + 2200 + s.rand() * 7000;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, sp, pts, fs } = s;
            this.step(s, dt);
            if (m.k > .5) {
                const x = m.x * w, y = m.y * h;
                for (const q of pts) if ((q.x - x) ** 2 + (q.y - y) ** 2 < sp * sp && !s.status[q.st] && s.done < 0) { s.will[q.st] = true; this.sign(s, q.st); break; }
            }
            const out = s.done >= 0 ? 1 - smooth((s.clock - s.done - 5600) / 2000) : 1;
            ground(ctx, s, p);
            ctx.lineWidth = .55; ctx.strokeStyle = p.i(.26); ctx.stroke(s.borders);
            ctx.lineWidth = .7; ctx.strokeStyle = p.i(.42); ctx.stroke(s.coast);
            const none = new Path2D(), ring = new Path2D(), full = new Path2D(), pulse = new Path2D();
            const glow = s.force >= 0 ? Math.max(0, 1 - (s.clock - s.force) / 1600) : 0;
            for (const q of pts) {
                const st = out > .02 ? s.status[q.st] : 0, age = s.clock - s.changed[q.st];
                const pop = age < 600 ? 1 + .4 * (1 - age / 600) : 1;
                if (st === 0) { const rr = sp * .1; none.moveTo(q.x + rr, q.y); none.arc(q.x, q.y, rr, 0, TAU); }
                else if (st === 1) { const rr = sp * .2 * pop; ring.moveTo(q.x + rr, q.y); ring.arc(q.x, q.y, rr, 0, TAU); }
                else {
                    const rr = sp * (.25 + .04 * glow) * pop; full.moveTo(q.x + rr, q.y); full.arc(q.x, q.y, rr, 0, TAU);
                    if (glow > 0) { const g = sp * (.45 + 1.1 * (1 - glow)); pulse.moveTo(q.x + g, q.y); pulse.arc(q.x, q.y, g, 0, TAU); }
                }
            }
            ctx.fillStyle = p.i(.32); ctx.fill(none);
            ctx.lineWidth = .75; ctx.strokeStyle = p.g(.8 * out); ctx.stroke(ring);
            ctx.fillStyle = p.g(.92 * out); ctx.fill(full);
            if (glow > 0) { ctx.lineWidth = .5; ctx.strokeStyle = p.g(.5 * glow * out); ctx.stroke(pulse); }
            /* the tally */
            let sig = 0, rat = 0;
            for (let k = 0; k < s.K; k++) { if (s.status[k] >= 1) sig++; if (s.status[k] === 2) rat++; }
            ctx.font = `${fs}px ${MONO}`; ctx.textBaseline = 'alphabetic';
            const y = h - fs * .9, x0 = Math.max(10, w * .04);
            const parts = [[String(s.year), p.g(.85)], ['   signed ' + sig, p.i(.55)], ['   ratified ' + rat, p.i(.55)]];
            parts.push(s.force >= 0 ? ['   in force', p.g(.95)] : ['   in force at ' + s.need, p.i(.4)]);
            let x = x0;
            for (const [str, col] of parts) { ctx.fillStyle = col; ctx.fillText(str, x, y); x += ctx.measureText(str).width; }
        }
    });

    /* ───────────────────────── XXIX. Wax seal ───────────────────────── */
    plate('g-seal', 'Wax seal',
        'A seal pressed in wax on a treaty ribbon, its relief picked out by a low light that circles slowly round it.', {
        edge: true, every: 33,
        init(s, p) {
            const r = s.rand;
            const q = Math.min(1.6, s.dpr);
            const D = Math.min(400, Math.round(Math.min(s.w * .8, s.h * .94) * q));
            s.D = D; s.q = q;
            const cv = document.createElement('canvas'); cv.width = cv.height = D;
            const c = cv.getContext('2d', { willReadFrequently: true });
            const R = D / 2 * .89, cx = D / 2, cy = D / 2, oz = r() * 50;
            const grab = () => { const d = c.getImageData(0, 0, D, D).data, a = new Float32Array(D * D); for (let i = 0; i < a.length; i++) a[i] = d[i * 4] / 255; c.clearRect(0, 0, D, D); return a; };
            c.fillStyle = '#fff'; c.strokeStyle = '#fff';
            /* the poured wax */
            c.beginPath();
            for (let k = 0; k <= 120; k++) {
                const a = k / 120 * TAU, ca = Math.cos(a), sa = Math.sin(a);
                const rr = R * (.9 + .045 * noise3(ca * 1.4, sa * 1.4, oz) + .03 * noise3(ca * 4, sa * 4, oz + 5));
                k ? c.lineTo(cx + ca * rr, cy + sa * rr) : c.moveTo(cx + ca * rr, cy + sa * rr);
            }
            c.fill();
            const alpha = grab();
            const dome = boxBlur(boxBlur(alpha.slice(), D, R * .07), D, R * .07);
            s.sh = boxBlur(boxBlur(alpha.slice(), D, R * .045), D, R * .045);
            /* the impression left by the matrix */
            c.beginPath(); c.arc(cx, cy, R * .72, 0, TAU); c.fill();
            const field = boxBlur(grab(), D, R * .018);
            /* the device: rim, legend and a balance */
            const P = R * .72;
            c.lineWidth = P * .05; c.beginPath(); c.arc(cx, cy, P * .93, 0, TAU); c.stroke();
            c.lineWidth = P * .018; c.beginPath(); c.arc(cx, cy, P * .66, 0, TAU); c.stroke();
            const legend = 'PACTA \u00b7 SUNT \u00b7 SERVANDA \u00b7 ';
            c.font = `600 ${Math.round(P * .15)}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
            const tw = c.measureText(legend).width, rr = P * .795, span = Math.min(TAU * .98, tw / rr);
            let a = -Math.PI / 2 - span / 2;
            for (const ch of legend) {
                const cw = c.measureText(ch).width / rr;
                a += cw / 2;
                c.save(); c.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); c.rotate(a + Math.PI / 2); c.fillText(ch, 0, 0); c.restore();
                a += cw / 2 + (TAU - span) / legend.length;
            }
            c.lineCap = 'round'; c.lineWidth = P * .045;
            c.beginPath();
            c.moveTo(cx, cy - P * .44); c.lineTo(cx, cy + P * .36);
            c.moveTo(cx - P * .4, cy - P * .3); c.lineTo(cx + P * .4, cy - P * .3);
            c.stroke();
            c.lineWidth = P * .018;
            c.beginPath();
            for (const sx of [-1, 1]) {
                const bx = cx + sx * P * .4, by = cy - P * .3;
                c.moveTo(bx, by); c.lineTo(bx - P * .15, cy + P * .02);
                c.moveTo(bx, by); c.lineTo(bx + P * .15, cy + P * .02);
            }
            c.stroke();
            for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * P * .4, cy + P * .02, P * .16, 0, Math.PI); c.closePath(); c.fill(); }
            c.beginPath(); c.arc(cx, cy - P * .47, P * .05, 0, TAU); c.fill();
            c.fillRect(cx - P * .2, cy + P * .35, P * .4, P * .06);
            const relief = boxBlur(grab(), D, R * .007);
            /* height, then normals and a cavity term for the shading */
            const H = new Float32Array(D * D);
            for (let i = 0; i < H.length; i++) {
                const x = i % D, y = (i / D) | 0;
                H[i] = R * (.16 * Math.pow(dome[i], .55) - .055 * field[i] + .05 * relief[i] * field[i] + .004 * noise3(x * .05, y * .05, oz + 9));
            }
            const Hb = boxBlur(H.slice(), D, R * .03);
            s.nx = new Float32Array(D * D); s.ny = new Float32Array(D * D); s.nz = new Float32Array(D * D); s.ao = new Float32Array(D * D);
            s.al = new Uint8Array(D * D);
            for (let y = 1; y < D - 1; y++) for (let x = 1; x < D - 1; x++) {
                const i = y * D + x;
                s.al[i] = Math.round(clamp(alpha[i], 0, 1) * 255);
                if (!s.al[i]) continue;
                const gx = (H[i + 1] - H[i - 1]) / 2, gy = (H[i + D] - H[i - D]) / 2, l = Math.hypot(gx, gy, 1);
                s.nx[i] = -gx / l; s.ny[i] = -gy / l; s.nz[i] = 1 / l;
                s.ao[i] = clamp(1 - (Hb[i] - H[i]) / (R * .03), .45, 1.1);
            }
            s.off = document.createElement('canvas'); s.off.width = s.off.height = D;
            s.octx = s.off.getContext('2d', { willReadFrequently: true });
            s.img = s.octx.createImageData(D, D); s.px = new Uint32Array(s.img.data.buffer);
            s.lut = null; s.az0 = r() * TAU;
        },
        draw(ctx, s, p, m) {
            const { w, h, t, D } = s;
            if (!s.lut) {
                const lut = new Uint32Array(256), g = p.gold;
                const lo = p.light ? p.mix(g, [40, 22, 6], .62) : p.mix(g, p.bg, .78);
                const hi = p.light ? p.mix(g, [255, 246, 226], .62) : p.mix(g, [255, 240, 205], .55);
                for (let i = 0; i < 256; i++) {
                    const v = i / 255;
                    const c = v < .62 ? lo.map((b, j) => b + (g[j] - b) * Math.pow(v / .62, .9)) : g.map((b, j) => b + (hi[j] - b) * (v - .62) / .38);
                    lut[i] = (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
                }
                s.lut = lut;
            }
            const az = s.az0 + t * .00016 + (m.sx - .5) * 1.2 * m.k, el = .42 + (.5 - m.sy) * .3 * m.k;
            const lx = Math.cos(az) * Math.cos(el), ly = Math.sin(az) * Math.cos(el), lz = Math.sin(el);
            let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
            const { nx, ny, nz, ao, al, px, lut, sh } = s;
            /* the shadow is the blurred outline of the wax, shifted away from the light */
            const so = D * .035 / Math.cos(el), off = Math.round(-ly * so) * D + Math.round(-lx * so), shk = (p.light ? .3 : .6) * 255;
            for (let i = 0; i < px.length; i++) {
                const a = al[i];
                if (!a) { const j = i - off, v = j >= 0 && j < px.length ? sh[j] : 0; px[i] = v > .004 ? ((v * shk) | 0) << 24 : 0; continue; }
                const d = nx[i] * lx + ny[i] * ly + nz[i] * lz;
                let sp = nx[i] * hx + ny[i] * hy + nz[i] * hz;
                sp = sp > 0 ? sp * sp : 0; sp *= sp; sp *= sp; sp *= sp;
                const v = (.2 + .95 * (d > 0 ? d : 0)) * ao[i] * .72 + sp * .45;
                px[i] = (a << 24) | lut[v >= 1 ? 255 : (v * 255) | 0];
            }
            s.octx.putImageData(s.img, 0, 0);
            ground(ctx, s, p);
            const S = D / s.q, cx = w / 2, cy = h / 2;
            /* the ribbon the seal is pressed onto */
            const rw = S * .18;
            ctx.lineJoin = 'miter';
            for (const [ang, len] of [[Math.PI * .62, h * .9], [Math.PI * .4, h * .85]]) {
                const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy * rw / 2, vy = ux * rw / 2;
                const ex = cx + ux * len, ey = cy + uy * len;
                ctx.beginPath();
                ctx.moveTo(cx + vx, cy + vy); ctx.lineTo(ex + vx, ey + vy); ctx.lineTo(ex - ux * rw * .35, ey - uy * rw * .35);
                ctx.lineTo(ex - vx, ey - vy); ctx.lineTo(cx - vx, cy - vy); ctx.closePath();
                ctx.fillStyle = p.g(p.light ? .12 : .1); ctx.fill();
                ctx.lineWidth = .6; ctx.strokeStyle = p.g(.45); ctx.stroke();
                ctx.lineWidth = .5; ctx.strokeStyle = p.g(.22);
                ctx.beginPath(); ctx.moveTo(cx + vx * .55, cy + vy * .55); ctx.lineTo(ex + vx * .55, ey + vy * .55);
                ctx.moveTo(cx - vx * .55, cy - vy * .55); ctx.lineTo(ex - vx * .55, ey - vy * .55); ctx.stroke();
            }
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
            ctx.drawImage(s.off, cx - S / 2, cy - S / 2, S, S);
        }
    });

    /* ───────────────────────── XXX. Roll-call vote ───────────────────────── */
    plate('g-hemicycle', 'Roll-call vote',
        'A hemicycle of 193 seats records a vote seat by seat, and the blocs shift a little from one resolution to the next.', {
        edge: false,
        init(s) {
            const r = s.rand, w = s.w, h = s.h, N = 193;
            s.fs = clamp(h / 22, 7, 10.5);
            s.cx = w / 2; s.cy = h * .8;
            const R1 = Math.min(w * .46, s.cy - h * .05), R0 = R1 * .5;
            const rows = clamp(Math.round((R1 - R0) / Math.max(6, R1 / 14)), 6, 11);
            const radii = Array.from({ length: rows }, (_, k) => R0 + (R1 - R0) * k / (rows - 1));
            const sum = radii.reduce((a, b) => a + b, 0);
            const counts = radii.map(x => Math.round(N * x / sum));
            counts[rows - 1] += N - counts.reduce((a, b) => a + b, 0);
            const seats = [];
            radii.forEach((rad, k) => {
                for (let i = 0; i < counts[k]; i++) {
                    const a = Math.PI * (1 - (i + .5) / counts[k]);
                    seats.push({ x: s.cx + Math.cos(a) * rad, y: s.cy - Math.sin(a) * rad, a });
                }
            });
            seats.sort((p1, p2) => p2.a - p1.a);
            s.sr = clamp(Math.min((R1 - R0) / (rows - 1), Math.PI * R0 / counts[0]) * .36, 1.4, 9);
            /* blocs as wedges of the chamber */
            const B = 7, wts = Array.from({ length: B }, () => .5 + r());
            const tot = wts.reduce((a, b) => a + b, 0);
            let acc = 0, b = 0;
            seats.forEach((q, k) => { while (b < B - 1 && k >= (acc + wts[b]) / tot * N) { acc += wts[b]; b++; } q.bloc = b; });
            s.seats = seats; s.B = B; s.N = N;
            s.lean = Array.from({ length: B }, () => r());
            this.fresh(s);
            if (s.reduced) { s.pos = N; for (const q of s.seats) q.at = -1e5; s.clock = 1001; s.doneAt = 1; }
            else { s.pos = Math.floor(N * .55); for (let k = 0; k < s.pos; k++) s.seats[s.order[k]].at = -1e5; }
        },
        fresh(s) {
            const r = s.rand;
            s.lean = s.lean.map(v => clamp(v + (r() - .5) * .5, 0, 1));
            const line = s.lean.map(v => v < .62 ? 0 : v < .82 ? 2 : 1);
            for (const q of s.seats) {
                const u = r();
                q.vote = u < .84 ? line[q.bloc] : u < .93 ? 0 : u < .97 ? 2 : 1;
                q.at = 1e12;
            }
            s.order = Array.from({ length: s.N }, (_, k) => k);
            for (let k = s.N - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); const x = s.order[k]; s.order[k] = s.order[j]; s.order[j] = x; }
            s.pos = 0; s.clock = 0; s.acc = 0; s.doneAt = -1;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, seats, sr, fs, cx, cy } = s;
            s.clock += dt;
            if (s.doneAt < 0) {
                s.acc += dt;
                while (s.acc > 34 && s.pos < s.N) { s.acc -= 34; seats[s.order[s.pos++]].at = s.clock; }
                if (s.pos >= s.N) s.doneAt = s.clock;
            } else if (s.clock - s.doneAt > 6500) this.fresh(s);
            const out = s.doneAt >= 0 ? 1 - smooth((s.clock - s.doneAt - 5000) / 1200) : 1;
            ground(ctx, s, p);
            ctx.lineWidth = .6; ctx.strokeStyle = p.i(.3);
            ctx.beginPath(); ctx.moveTo(cx - w * .46, cy + sr * 3); ctx.lineTo(cx + w * .46, cy + sr * 3); ctx.stroke();
            const empty = new Path2D(), yes = new Path2D(), no = new Path2D(), abst = new Path2D();
            const px = m.sx * w, py = m.sy * h, sig2 = 2 * (Math.min(w, h) * .12) ** 2;
            let Y = 0, Nn = 0, A = 0;
            for (const q of seats) {
                const age = s.clock - q.at;
                let rr = sr;
                if (m.k > .05) { const dx = q.x - px, dy = q.y - py; rr *= 1 + .5 * m.k * Math.exp(-(dx * dx + dy * dy) / sig2); }
                if (age < 0 || out < .03) { const e = rr * .45; empty.moveTo(q.x + e, q.y); empty.arc(q.x, q.y, e, 0, TAU); continue; }
                const pop = age < 260 ? .5 + .5 * smooth(age / 260) + .25 * Math.sin(Math.PI * age / 260) : 1;
                const e = rr * pop;
                if (q.vote === 0) { Y++; yes.moveTo(q.x + e, q.y); yes.arc(q.x, q.y, e, 0, TAU); }
                else if (q.vote === 1) { Nn++; no.moveTo(q.x + e, q.y); no.arc(q.x, q.y, e, 0, TAU); }
                else { A++; const e2 = e * .82; abst.moveTo(q.x + e2, q.y); abst.arc(q.x, q.y, e2, 0, TAU); }
            }
            ctx.fillStyle = p.i(.24); ctx.fill(empty);
            ctx.fillStyle = p.g(.95 * out + .05); ctx.fill(yes);
            ctx.fillStyle = p.i(.72 * out + .05); ctx.fill(no);
            ctx.lineWidth = .8; ctx.strokeStyle = p.g(.75 * out + .05); ctx.stroke(abst);
            /* the tally in the well of the chamber */
            ctx.font = `${fs}px ${MONO}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
            const parts = [[String(Y), p.g(.95)], [' \u00b7 ', p.i(.35)], [String(Nn), p.i(.8)], [' \u00b7 ', p.i(.35)], [String(A), p.i(.5)]];
            const tw = parts.reduce((a, [str]) => a + ctx.measureText(str).width, 0);
            let x = cx - tw / 2;
            ctx.globalAlpha = out;
            for (const [str, col] of parts) { ctx.fillStyle = col; ctx.fillText(str, x, cy - fs * .1); x += ctx.measureText(str).width; }
            ctx.font = `${fs * .82}px ${MONO}`; ctx.textAlign = 'center';
            ctx.fillStyle = p.i(.42);
            ctx.fillText('yes \u00b7 no \u00b7 abstain', cx, cy + sr * 3 + fs * 1.5);
            if (s.doneAt >= 0) {
                const k = smooth((s.clock - s.doneAt) / 500);
                ctx.globalAlpha = out * k;
                ctx.font = `${fs * .82}px ${MONO}`;
                ctx.fillStyle = Y > Nn ? p.g(.95) : p.i(.7);
                ctx.fillText(Y > Nn ? 'ADOPTED' : 'NOT ADOPTED', cx, cy - fs * 1.5);
            }
            ctx.globalAlpha = 1; ctx.textAlign = 'start';
        }
    });

    /* ───────────────────────── XXXI. Card index ───────────────────────── */
    const CASES = ['Mavrommatis, 1924', 'Lotus, 1927', 'Chorz\u00f3w Factory, 1928', 'Island of Palmas, 1928', 'Trail Smelter, 1941',
        'Corfu Channel, 1949', 'Reparation for Injuries, 1949', 'Asylum, 1950', 'Anglo-Norwegian Fisheries, 1951', 'Nottebohm, 1955',
        'Lac Lanoux, 1957', 'Van Gend en Loos, 1963', 'North Sea Continental Shelf, 1969', 'Barcelona Traction, 1970', 'Namibia, 1971',
        'Nuclear Tests, 1974', 'Western Sahara, 1975', 'Tehran Hostages, 1980', 'Gulf of Maine, 1984', 'Nicaragua, 1986',
        'East Timor, 1995', 'Tadi\u0107, 1995', 'Gab\u010d\u00edkovo-Nagymaros, 1997', 'LaGrand, 2001', 'Arrest Warrant, 2002',
        'Wall, 2004', 'Bosnian Genocide, 2007', 'Kadi, 2008', 'Pulp Mills, 2010', 'Jurisdictional Immunities, 2012',
        'Whaling in the Antarctic, 2014', 'South China Sea, 2016', 'Chagos, 2019'];
    plate('g-cards', 'Card index',
        'A drawer of case cards, ordered by date, which a hand leafs through at an unhurried pace, stopping now and then on a card.', {
        edge: false,
        init(s) {
            const r = s.rand;
            s.N = 30; s.P = 9 + r() * 10; s.target = s.P; s.next = 2500;
            s.start = Math.floor(r() * (CASES.length - s.N + 1));
            s.fs = clamp(s.h / 24, 6.5, 10.5);
            s.cards = Array.from({ length: s.N }, (_, i) => ({
                label: CASES[s.start + s.N - 1 - i],
                guide: i % 6 === 3, tab: (i / 6 | 0) % 3,
                lines: Array.from({ length: 6 }, () => .35 + r() * .55)
            }));
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, N, fs } = s, r = s.rand;
            s.next -= dt;
            if (s.next <= 0) { s.next = 3200 + r() * 3400; s.target = 2 + r() * (N - 9); }
            const goal = m.k > .3 ? lerp(s.target, clamp((1 - m.sy) * N * 1.15 - 2, 1, N - 4), m.k) : s.target;
            s.P += (goal - s.P) * Math.min(1, dt / 900);
            ground(ctx, s, p);
            const beta = .62, cb = Math.cos(beta);
            const base = h * .9, depth = h * .36, W0 = w * .6, H0 = h * .52, cx = w / 2;
            const fill = p.rgb(p.light ? p.mix(p.bg, [255, 253, 247], .7) : p.mix(p.bg, p.ink, .07));
            const guideFill = p.rgb(p.light ? p.mix(p.bg, p.gold, .16) : p.mix(p.bg, p.gold, .14));
            /* drawer sides */
            const backY = base - depth, sb = 1 - .2;
            ctx.lineWidth = .7; ctx.strokeStyle = p.i(.28);
            ctx.beginPath();
            ctx.moveTo(cx - W0 * .53, base + 2); ctx.lineTo(cx - W0 * .53 * sb, backY);
            ctx.moveTo(cx + W0 * .53, base + 2); ctx.lineTo(cx + W0 * .53 * sb, backY);
            ctx.stroke();
            ctx.textBaseline = 'alphabetic';
            for (let i = N - 1; i >= 0; i--) {
                const c = s.cards[i], u = i / (N - 1), sc = 1 - .2 * u;
                const yb = base - depth * Math.pow(u, .9), cw = W0 * sc, ch = H0 * sc;
                const f = smooth(clamp((s.P - i + .6) / 1.6, 0, 1));
                const th = lerp(-.12, .5, f);
                const k = Math.cos(th + beta) / cb, ytop = yb - ch * k, spread = 1 + .07 * Math.sin(th);
                const xl = cx - cw / 2, xr = cx + cw / 2, tl = cx - cw / 2 * spread, tr = cx + cw / 2 * spread;
                ctx.beginPath();
                ctx.moveTo(xl, yb); ctx.lineTo(tl, ytop);
                if (c.guide) {
                    const tw = (tr - tl) * .22, t0 = tl + (tr - tl) * (.06 + c.tab * .36), th2 = ch * .1 * k;
                    ctx.lineTo(t0, ytop); ctx.lineTo(t0 + th2 * .4, ytop - th2); ctx.lineTo(t0 + tw - th2 * .4, ytop - th2); ctx.lineTo(t0 + tw, ytop);
                }
                ctx.lineTo(tr, ytop); ctx.lineTo(xr, yb); ctx.closePath();
                ctx.fillStyle = c.guide ? guideFill : fill; ctx.fill();
                ctx.lineWidth = .6; ctx.strokeStyle = c.guide ? p.g(.6) : p.i(.34); ctx.stroke();
                if (k < .08) continue;
                /* the face: a heading and ruled lines, foreshortened with the card */
                const fy = v => ytop + (yb - ytop) * v, fx = (v, x) => lerp(lerp(tl, xl, v), lerp(tr, xr, v), x);
                ctx.lineWidth = .5;
                ctx.strokeStyle = p.g(.4);
                ctx.beginPath(); ctx.moveTo(fx(.2, .04), fy(.2)); ctx.lineTo(fx(.2, .96), fy(.2)); ctx.stroke();
                if (c.guide) {
                    const t0 = tl + (tr - tl) * (.06 + c.tab * .36), tw = (tr - tl) * .22;
                    const yr = +c.label.slice(-4), letter = String(yr - yr % 10);
                    if (k > .35) {
                        ctx.font = `${fs * sc}px ${MONO}`; ctx.fillStyle = p.g(.95); ctx.textAlign = 'center';
                        ctx.save(); ctx.translate(t0 + tw / 2, ytop - ch * .015 * k); ctx.scale(1, Math.min(1, k)); ctx.fillText(letter, 0, 0); ctx.restore();
                        ctx.textAlign = 'start';
                    }
                    continue;
                }
                if (k > .3) {
                    ctx.save(); ctx.translate(fx(.14, .05), fy(.14)); ctx.scale(1, Math.min(1, k));
                    ctx.font = `${fs * sc}px ${MONO}`; ctx.fillStyle = p.i(.72);
                    ctx.fillText(c.label, 0, 0);
                    ctx.restore();
                }
                ctx.strokeStyle = p.i(.16);
                ctx.beginPath();
                for (let l = 0; l < c.lines.length; l++) {
                    const v = .32 + l * .1;
                    ctx.moveTo(fx(v, .05), fy(v)); ctx.lineTo(fx(v, .05 + .9 * c.lines[l]), fy(v));
                }
                ctx.stroke();
            }
            /* drawer front, with its label holder and pull */
            const fh = h - base + 2;
            ctx.fillStyle = p.bgS; ctx.fillRect(0, base, w, fh);
            ctx.lineWidth = .8; ctx.strokeStyle = p.i(.4);
            ctx.beginPath(); ctx.moveTo(cx - W0 * .58, base + .5); ctx.lineTo(cx + W0 * .58, base + .5); ctx.stroke();
            ctx.strokeStyle = p.g(.75); ctx.lineWidth = .8;
            const lw = W0 * .16, lh = Math.min(fh * .5, fs * 1.3);
            ctx.strokeRect(cx - lw / 2, base + fh * .22, lw, lh);
            ctx.fillStyle = p.g(.5); ctx.fillRect(cx - lw * .32, base + fh * .22 + lh * .45, lw * .64, .8);
        }
    });

    /* ───────────────────────── XXXII. Braided river ───────────────────────── */
    plate('g-braid', 'Braided river',
        'Channels of a braided river part and rejoin across a widening plain, their courses shifting as the gravel bars move.', {
        edge: true, every: 33,
        init(s) { s.oz = s.rand() * 100; s.K = 8; },
        draw(ctx, s, p, m) {
            const { w, h, t, K } = s;
            const z = s.oz + t * .000035, sc = 1.6 / w, sc2 = 3.6 / w;
            const step = clamp(w / 110, 3, 6);
            const cy = x => h * .5 + h * .1 * noise3(x * sc, .5, s.oz) + (m.sy - .5) * h * .12 * m.k * Math.exp(-((x / w - m.sx) ** 2) / .05);
            const half = x => h * (.07 + .24 * Math.pow(clamp(x / w, 0, 1), 1.3));
            ground(ctx, s, p);
            /* banks and the old floodplain terraces */
            const banks = new Path2D(), terr = new Path2D();
            for (const sgn of [-1, 1]) {
                for (let x = -step, first = true; x <= w + step; x += step, first = false) {
                    const y = cy(x) + sgn * (half(x) * 1.18 + 5 + 3 * noise3(x * sc2 * 2, sgn * 9, s.oz));
                    first ? banks.moveTo(x, y) : banks.lineTo(x, y);
                }
                for (let k = 1; k <= 2; k++) for (let x = -step, first = true; x <= w + step; x += step, first = false) {
                    const y = cy(x) + sgn * (half(x) * (1.18 + .28 * k) + 5 + k * 6 + 5 * noise3(x * sc2, sgn * 9 + k * 3, s.oz));
                    first ? terr.moveTo(x, y) : terr.lineTo(x, y);
                }
            }
            ctx.lineWidth = .5; ctx.strokeStyle = p.i(p.light ? .22 : .16); ctx.stroke(terr);
            ctx.lineWidth = .8; ctx.strokeStyle = p.i(.42); ctx.stroke(banks);
            /* the channels */
            const ch = Array.from({ length: K }, () => new Path2D());
            const widths = [];
            for (let k = 0; k < K; k++) {
                widths.push(k < 3 ? 1.5 - k * .2 : .55 + .1 * (k % 3));
                for (let x = -step, first = true; x <= w + step; x += step, first = false) {
                    const o = Math.tanh(2 * noise3(x * sc2, k * 4.7, z) + .35 * noise3(x * sc2 * 3, k * 2.1 + 40, z * 1.4));
                    const y = cy(x) + half(x) * o;
                    first ? ch[k].moveTo(x, y) : ch[k].lineTo(x, y);
                }
            }
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            /* water as the union of the channels: an outline pass, then the water laid over it */
            const ws = clamp(Math.min(w, h) / 70, 2, 5);
            const rim = p.rgb(p.mix(p.bg, p.gold, p.light ? .85 : .7)), water = p.rgb(p.mix(p.bg, p.gold, p.light ? .2 : .16));
            ctx.strokeStyle = rim;
            for (let k = 0; k < K; k++) { ctx.lineWidth = widths[k] * ws + 1.6; ctx.stroke(ch[k]); }
            ctx.strokeStyle = water;
            for (let k = 0; k < K; k++) { ctx.lineWidth = widths[k] * ws; ctx.stroke(ch[k]); }
            ctx.lineWidth = .5; ctx.strokeStyle = p.g(.35);
            for (let k = 0; k < 3; k++) ctx.stroke(ch[k]);
            /* flow, as small bright dashes carried downstream */
            ctx.setLineDash([1.2, 13]);
            ctx.lineDashOffset = -t * .018;
            ctx.lineWidth = 1.4; ctx.strokeStyle = p.g(.95);
            for (let k = 0; k < 3; k++) ctx.stroke(ch[k]);
            ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = 'butt';
        }
    });

    /* ───────────────────────── XXXIII. Penrose tiling ───────────────────────── */
    plate('g-penrose', 'Penrose tiling',
        'Two rhombs that tile the plane without ever repeating, laid outwards from a centre, with arcs that join into endless curves.', {
        edge: true,
        init(s) { s.cycleN = 0; this.build(s); s.cycle = s.reduced ? 20000 : 9000; },
        build(s) {
            const r = s.rand, PHI = (1 + Math.sqrt(5)) / 2;
            const Rb = Math.hypot(s.w, s.h) * .56;
            const target = clamp(Math.min(s.w, s.h) / 7.5, 16, 46);
            const nsub = clamp(Math.round(Math.log(Rb / target) / Math.log(PHI)), 3, 7);
            let tris = [];
            for (let i = 0; i < 10; i++) {
                let a1 = (2 * i - 1) * Math.PI / 10, a2 = (2 * i + 1) * Math.PI / 10;
                let B = [Math.cos(a1) * Rb, Math.sin(a1) * Rb], C = [Math.cos(a2) * Rb, Math.sin(a2) * Rb];
                if (i % 2 === 0) { const x = B; B = C; C = x; }
                tris.push([0, [0, 0], B, C]);
            }
            for (let n = 0; n < nsub; n++) {
                const out = [];
                for (const [c, A, B, C] of tris) {
                    if (c === 0) {
                        const P = [A[0] + (B[0] - A[0]) / PHI, A[1] + (B[1] - A[1]) / PHI];
                        out.push([0, C, P, B], [1, P, C, A]);
                    } else {
                        const Q = [B[0] + (A[0] - B[0]) / PHI, B[1] + (A[1] - B[1]) / PHI];
                        const R = [B[0] + (C[0] - B[0]) / PHI, B[1] + (C[1] - B[1]) / PHI];
                        out.push([1, R, C, A], [1, Q, R, B], [0, R, Q, A]);
                    }
                }
                tris = out;
            }
            const NB = 18, bands = Array.from({ length: NB }, () => ({ edges: new Path2D(), thick: new Path2D(), arcs: new Path2D(), arcs2: new Path2D() }));
            const maxD = Rb * .98;
            for (const [c, A, B, C] of tris) {
                const gx = (A[0] + B[0] + C[0]) / 3, gy = (A[1] + B[1] + C[1]) / 3, d = Math.hypot(gx, gy);
                if (d > maxD) continue;
                const b = bands[Math.min(NB - 1, Math.floor(d / maxD * NB))];
                b.edges.moveTo(C[0], C[1]); b.edges.lineTo(A[0], A[1]); b.edges.lineTo(B[0], B[1]);
                if (c === 1) { b.thick.moveTo(A[0], A[1]); b.thick.lineTo(B[0], B[1]); b.thick.lineTo(C[0], C[1]); b.thick.closePath(); }
                const s1 = Math.hypot(B[0] - A[0], B[1] - A[1]);
                const a0 = Math.atan2(B[1] - A[1], B[0] - A[0]), a1 = Math.atan2(C[1] - A[1], C[0] - A[0]);
                let da = a1 - a0; da = Math.atan2(Math.sin(da), Math.cos(da));
                const path = c === 1 ? b.arcs : b.arcs2, rr = s1 / 2;
                path.moveTo(A[0] + Math.cos(a0) * rr, A[1] + Math.sin(a0) * rr);
                path.arc(A[0], A[1], rr, a0, a0 + da, da < 0);
            }
            s.bands = bands; s.NB = NB;
            s.rot0 = r() * TAU; s.cycle = 0;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, t } = s;
            s.cycle += dt;
            const grow = 16000, hold = 14000, fade = 2600;
            if (s.cycle > grow + hold + fade) { s.cycleN++; this.build(s); }
            const out = 1 - smooth((s.cycle - grow - hold) / fade);
            const front = s.cycle / grow * (s.NB + 2);
            ground(ctx, s, p);
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.rotate(s.rot0 + t * .000006 + (m.sx - .5) * .25 * m.k);
            ctx.lineJoin = 'round';
            for (let b = 0; b < s.NB; b++) {
                const a = clamp(front - b, 0, 1) * out;
                if (a <= .01) continue;
                const B = s.bands[b];
                ctx.fillStyle = p.g(.075 * a); ctx.fill(B.thick);
                ctx.lineWidth = .5; ctx.strokeStyle = p.i((p.light ? .26 : .22) * a); ctx.stroke(B.edges);
                ctx.lineWidth = p.light ? 1.1 : .95; ctx.strokeStyle = p.g(.85 * a); ctx.stroke(B.arcs);
                ctx.lineWidth = .7; ctx.strokeStyle = p.g(.5 * a); ctx.stroke(B.arcs2);
            }
            ctx.restore();
        }
    });

    /* ───────────────────────── XXXIV. Reading beam ───────────────────────── */
    const ART31 = '1. A treaty shall be interpreted in {good faith} in accordance with the {ordinary meaning} to be given to the terms of the treaty in their {context} and in the light of its {object and purpose}. '
        + '2. The context for the purpose of the interpretation of a treaty shall comprise, in addition to the text, including its preamble and annexes: (a) any agreement relating to the treaty which was made between all the parties in connection with the conclusion of the treaty; (b) any instrument which was made by one or more parties in connection with the conclusion of the treaty and accepted by the other parties as an instrument related to the treaty. '
        + '3. There shall be taken into account, together with the context: (a) any {subsequent agreement} between the parties regarding the interpretation of the treaty or the application of its provisions; (b) any {subsequent practice} in the application of the treaty which establishes the agreement of the parties regarding its interpretation; (c) any {relevant rules of international law} applicable in the relations between the parties. '
        + '4. A {special meaning} shall be given to a term if it is established that the parties so intended.';
    plate('g-beam', 'Reading beam',
        'A scanning beam passes over the rule of treaty interpretation as it scrolls by, and the words glow for a moment after it has read them.', {
        edge: true,
        init(s, p) {
            const w = s.w, h = s.h, dpr = s.dpr;
            const fs = clamp(Math.min(h / 13, w / 26), 9, 17), lh = Math.round(fs * 1.5), mx = Math.max(14, w * .08);
            const font = `${fs}px ${SERIF}`, kfont = `italic ${fs}px ${SERIF}`, hfont = `${fs * .72}px ${MONO}`;
            const meas = document.createElement('canvas').getContext('2d');
            const words = [];
            let key = false;
            for (const raw of ART31.split(' ')) {
                let wd = raw, k0 = key;
                if (wd.startsWith('{')) { wd = wd.slice(1); k0 = key = true; }
                if (wd.includes('}')) { wd = wd.replace('}', ''); key = false; }
                words.push({ wd, key: k0 });
            }
            const lines = [{ head: true }];
            let line = [], x = 0;
            const sw = (meas.font = font, meas.measureText(' ').width);
            for (const q of words) {
                meas.font = q.key ? kfont : font;
                const ww = meas.measureText(q.wd).width;
                if (x + ww > w - 2 * mx && line.length) { lines.push(line); line = []; x = 0; }
                line.push({ ...q, x, ww }); x += ww + sw;
            }
            lines.push(line, null);
            const Hb = lines.length * lh;
            s.Hb = Hb; s.lh = lh;
            const make = bright => {
                const c = document.createElement('canvas');
                c.width = Math.ceil(w * dpr); c.height = Math.ceil(Hb * dpr);
                const g = c.getContext('2d');
                g.setTransform(dpr, 0, 0, dpr, 0, 0);
                g.textBaseline = 'alphabetic';
                lines.forEach((ln, j) => {
                    const y = j * lh + lh * .72;
                    if (!ln) return;
                    if (ln.head) { g.font = hfont; g.fillStyle = bright ? p.g(1) : p.g(.55); g.fillText('ARTICLE 31 \u00b7 GENERAL RULE OF INTERPRETATION', mx, y); return; }
                    for (const q of ln) {
                        g.font = q.key ? kfont : font;
                        g.fillStyle = bright ? (q.key ? p.g(1) : p.g(.9)) : (q.key ? p.g(.62) : p.i(p.light ? .3 : .2));
                        g.fillText(q.wd, mx + q.x, y);
                        if (q.key && !bright) { g.fillStyle = p.g(.35); g.fillRect(mx + q.x, y + fs * .2, q.ww, .7); }
                    }
                });
                return c;
            };
            s.dim = make(false); s.bright = make(true);
        },
        draw(ctx, s, p, m) {
            const { w, h, t, Hb, dpr } = s;
            ground(ctx, s, p);
            const oy = -((t * .005) % Hb) + s.lh * .4;
            const blit = (img, x0, x1, a) => {
                x0 = Math.max(0, x0); x1 = Math.min(w, x1);
                if (x1 - x0 < .5 || a <= .004) return;
                ctx.globalAlpha = a;
                for (let y = oy; y < h; y += Hb) ctx.drawImage(img, x0 * dpr, 0, (x1 - x0) * dpr, img.height, x0, y, x1 - x0, Hb);
            };
            blit(s.dim, 0, w, 1);
            const period = 10000, u = (t % period) / period;
            let bx = lerp(-w * .05, w * 1.3, u);
            if (m.k > .05) bx = lerp(bx, m.sx * w, m.k);
            const trail = w * .4, S = 14;
            for (let k = 0; k < S; k++) {
                const x1 = bx - k * trail / S, x0 = x1 - trail / S;
                blit(s.bright, x0, x1, .85 * Math.pow(1 - k / S, 1.7));
            }
            ctx.globalAlpha = 1;
            const gw = Math.max(10, w * .035);
            const gr = ctx.createLinearGradient(bx - gw, 0, bx + gw, 0);
            gr.addColorStop(0, p.g(0)); gr.addColorStop(.5, p.g(.16)); gr.addColorStop(1, p.g(0));
            ctx.fillStyle = gr; ctx.fillRect(bx - gw, 0, gw * 2, h);
            ctx.fillStyle = p.g(.75); ctx.fillRect(bx - .4, 0, .8, h);
        }
    });

    /* ───────────────────────── XXXV. Murmuration ───────────────────────── */
    plate('g-murmuration', 'Murmuration',
        'A flock of starlings, each drawn as a short stroke, stretches into a sheet and folds over itself as it wheels about.', {
        edge: true,
        init(s) {
            const r = s.rand, w = s.w, h = s.h;
            const N = clamp(Math.round(w * h / 110), 260, 1100);
            s.N = N; s.oz = r() * 100;
            s.u = new Float32Array(N); s.v = new Float32Array(N); s.z = new Float32Array(N); s.ph = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                /* each bird keeps a place in a disc, thicker towards the middle; the disc is then bent about */
                const a = r() * TAU, d = Math.pow(r(), .65);
                s.u[i] = Math.cos(a) * d; s.v[i] = Math.sin(a) * d * .36; s.z[i] = r(); s.ph[i] = r() * TAU;
            }
            s.x = new Float32Array(N); s.y = new Float32Array(N); s.px = new Float32Array(N); s.py = new Float32Array(N);
        },
        place(s, t, X, Y, m, du) {
            const { w, h, N, u, v, ph, oz } = s;
            const T = t * .00007;
            const R = Math.min(w * .34, h * .62);
            const A = .95 + .35 * noise3(T, 3.1, oz), B = .9 + .7 * noise3(T, 7.9, oz);
            const fold = .4 + 1.4 * noise3(T * .8, 12.5, oz), fk = 2.4 + 1.4 * noise3(T * .5, 4.4, oz);
            const th = 1.4 * noise3(T * .6, 21.1, oz) + (m ? (m.sx - .5) * .6 * m.k : 0);
            const ct = Math.cos(th), st = Math.sin(th);
            const cx = w * (.5 + .22 * noise3(T * .7, 30.3, oz)), cy = h * (.5 + .16 * noise3(T * .7, 33.7, oz));
            for (let i = 0; i < N; i++) {
                let x = (u[i] + du) * A, y = v[i] * B;
                y += fold * .35 * Math.sin(fk * x + T * 3);
                x += .22 * noise3(x * 1.3 + 5, y * 1.3, T * 2);
                y += .2 * noise3(x * 1.3, y * 1.3 + 9, T * 2);
                const wob = .012 * Math.sin(t * .002 + ph[i]);
                X[i] = cx + (x * ct - y * st) * R + wob * R;
                Y[i] = cy + (x * st + y * ct) * R * .9 + wob * R * Math.cos(ph[i]);
            }
        },
        draw(ctx, s, p, m, dt) {
            const { N, x, y, px, py, z } = s;
            /* birds fly along the sheet: the heading is taken from a second point a little further along it */
            this.place(s, s.t, x, y, m, 0);
            this.place(s, s.t, px, py, m, .03);
            ground(ctx, s, p);
            const B = 3, paths = Array.from({ length: B }, () => new Path2D()), ink = new Path2D();
            const L = clamp(Math.min(s.w, s.h) / 90, 1.6, 3.4), lw = clamp(Math.min(s.w, s.h) / 200, .9, 1.7) * (p.light ? 1.2 : 1);
            for (let i = 0; i < N; i++) {
                let dx = px[i] - x[i], dy = py[i] - y[i];
                const d = Math.hypot(dx, dy) || 1, j = (z[i] - .5) * .5, cj = Math.cos(j), sj = Math.sin(j);
                dx /= d; dy /= d;
                const ex = dx * cj - dy * sj; dy = dx * sj + dy * cj; dx = ex;
                const l = L * (.7 + .6 * z[i]);
                const path = i % 9 === 0 ? ink : paths[Math.min(B - 1, Math.floor(z[i] * B))];
                path.moveTo(x[i] - dx * l, y[i] - dy * l); path.lineTo(x[i] + dx * l * .4, y[i] + dy * l * .4);
            }
            ctx.lineCap = 'round';
            for (let b = 0; b < B; b++) { ctx.lineWidth = lw * (1 + b * .3); ctx.strokeStyle = p.g(.4 + b * .25); ctx.stroke(paths[b]); }
            ctx.lineWidth = lw; ctx.strokeStyle = p.i(p.light ? .62 : .5); ctx.stroke(ink);
            ctx.lineCap = 'butt';
        }
    });

    /* ───────────────────────── XXXVI. Signature page ───────────────────────── */
    plate('g-signatures', 'Signature page',
        'The closing page of a treaty, where each plenipotentiary signs in turn and a seal is set beside the name.', {
        edge: false,
        init(s) {
            const w = s.w, h = s.h;
            s.fs = clamp(Math.min(h / 24, w / 46), 6.5, 10);
            const c = document.createElement('canvas').getContext('2d');
            c.font = `${s.fs}px ${MONO}`;
            const mx = Math.max(14, w * .07), maxW = w - 2 * mx;
            const text = 'IN WITNESS WHEREOF the undersigned, being duly authorised thereto, have signed the present Convention.';
            const head = []; let line = '';
            for (const wd of text.split(' ')) { const tr = line ? line + ' ' + wd : wd; if (c.measureText(tr).width > maxW && line) { head.push(line); line = wd; } else line = tr; }
            head.push(line);
            s.head = head; s.mx = mx; s.lh = s.fs * 1.55;
            const top = s.fs * 1.6 + head.length * s.lh + s.fs * .6;
            const cols = w > 520 ? 3 : 2, rows = h > 300 ? 3 : 2;
            const cw = maxW / cols, ch = (h - top - s.fs * .6) / rows;
            s.blocks = [];
            for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
                const x0 = mx + i * cw + cw * .04, x1 = mx + (i + 1) * cw - cw * .1, y = top + j * ch + ch * .64;
                s.blocks.push({ x0, x1, y, ch, sig: null, done: false });
            }
            s.k = 0; s.prog = 0; s.pause = 400; s.doneAt = -1; s.clock = 0;
            this.fresh(s);
            const warm = s.reduced ? s.blocks.length : Math.max(1, s.blocks.length - 2);
            for (let k = 0; k < warm; k++) this.finish(s);
        },
        fresh(s) {
            for (const b of s.blocks) { b.sig = this.make(s, b); b.done = false; b.at = 0; }
            s.k = 0; s.prog = 0; s.pause = 500; s.doneAt = -1;
        },
        finish(s) { const b = s.blocks[s.k]; b.done = true; b.at = -1e5; s.k++; s.prog = 0; if (s.k >= s.blocks.length) s.doneAt = s.clock; },
        make(s, b) {
            const r = s.rand, xs = [], ys = [], pen = [];
            let X = 0;
            const words = r() < .7 ? 2 : 1;
            for (let wd = 0; wd < words; wd++) {
                const L = wd === 0 && words > 1 ? 2 + Math.floor(r() * 3) : 4 + Math.floor(r() * 4);
                const hs = [];
                for (let i = 0; i <= L; i++) hs.push(i === 0 ? 2.3 + r() * .9 : i === L ? .3 : r() < .2 ? 1.9 + r() * .6 : r() < .1 ? -1.4 : .7 + r() * .45);
                const axs = hs.map(() => r() < .35 ? .08 + r() * .1 : .26 + r() * .14), slant = .25 + r() * .15, vx = .95 + r() * .2, ph = r() * .5;
                const steps = L * 22;
                for (let k = 0; k <= steps; k++) {
                    const tt = k / 22, li = Math.min(L - 1, Math.floor(tt)), fr = tt - li;
                    const amp = lerp(hs[li], hs[li + 1], smooth((fr - .55) / .45));
                    const a = TAU * tt;
                    let y = -amp * .5 * (1 - Math.cos(a));
                    const ax = lerp(axs[li], axs[li + 1], smooth(fr));
                    let x = X + vx * tt + ax * Math.sin(a + ph) * (1 + Math.abs(amp) * .25);
                    x -= y * slant;
                    xs.push(x); ys.push(y + .04 * noise3(tt * 2, wd * 7, 0)); pen.push(k === 0 ? 0 : 1);
                }
                X = xs[xs.length - 1] + .7 + r() * .4;
            }
            /* a closing flourish under the name */
            const ex = xs[xs.length - 1], ey = ys[ys.length - 1], sx = xs[0] + r() * 1.2;
            for (let k = 1; k <= 40; k++) {
                const u = k / 40, v = 1 - u;
                const x = v * v * ex + 2 * u * v * (ex + 1.4) + u * u * sx, y = v * v * ey + 2 * u * v * 1.2 + u * u * .5;
                xs.push(x); ys.push(y); pen.push(1);
            }
            let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
            for (let i = 0; i < xs.length; i++) { minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]); minY = Math.min(minY, ys[i]); maxY = Math.max(maxY, ys[i]); }
            const bw = (b.x1 - b.x0) * (.72 + r() * .2), bh = b.ch * .78;
            const k = Math.min(bw / (maxX - minX), bh / (maxY - minY));
            const ox = b.x0 + (b.x1 - b.x0) * .16 + r() * (b.x1 - b.x0 - bw) * .3 - minX * k, oy = b.y - b.ch * .06;
            const P = new Float32Array(xs.length * 2);
            for (let i = 0; i < xs.length; i++) { P[i * 2] = ox + xs[i] * k; P[i * 2 + 1] = oy + ys[i] * k; }
            /* pen pressure from speed: three widths */
            const lv = new Uint8Array(xs.length);
            for (let i = 1; i < xs.length; i++) { const d = Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]); lv[i] = d > 2.4 ? 0 : d > 1.2 ? 1 : 2; }
            return { P, pen, lv, n: xs.length, paths: null };
        },
        strokes(sig, upto) {
            const out = [new Path2D(), new Path2D(), new Path2D()], P = sig.P;
            for (let i = 1; i < upto; i++) {
                if (!sig.pen[i]) continue;
                const q = out[sig.lv[i]];
                q.moveTo(P[i * 2 - 2], P[i * 2 - 1]); q.lineTo(P[i * 2], P[i * 2 + 1]);
            }
            return out;
        },
        draw(ctx, s, p, m, dt) {
            const { w, h, fs, blocks } = s;
            s.clock += dt;
            if (s.doneAt < 0) {
                if (s.pause > 0) s.pause -= dt;
                else {
                    const b = blocks[s.k];
                    s.prog += dt * .085;
                    if (s.prog >= b.sig.n) { b.done = true; b.at = s.clock; s.k++; s.prog = 0; s.pause = 700; if (s.k >= blocks.length) s.doneAt = s.clock; }
                }
            } else if (s.clock - s.doneAt > 8500) this.fresh(s);
            const out = s.doneAt >= 0 ? 1 - smooth((s.clock - s.doneAt - 6800) / 1500) : 1;
            ground(ctx, s, p);
            ctx.font = `${s.fs}px ${MONO}`; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = p.i(.5);
            s.head.forEach((ln, j) => ctx.fillText(ln, s.mx, fs * 1.6 + j * s.lh));
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const widths = [.55, .85, 1.2];
            blocks.forEach((b, j) => {
                ctx.lineWidth = .6; ctx.strokeStyle = p.i(.32);
                ctx.beginPath(); ctx.moveTo(b.x0, b.y + .5); ctx.lineTo(b.x1, b.y + .5); ctx.stroke();
                ctx.font = `${fs * .82}px ${MONO}`; ctx.fillStyle = p.i(.36);
                ctx.fillText('For Party ' + 'ABCDEFGHI'[j], b.x0, b.y + fs * 1.55);
                let paths = null;
                if (b.done) paths = b.sig.paths || (b.sig.paths = this.strokes(b.sig, b.sig.n));
                else if (j === s.k && s.doneAt < 0 && s.pause <= 0) paths = this.strokes(b.sig, Math.floor(s.prog));
                if (paths) for (let l = 0; l < 3; l++) { ctx.lineWidth = widths[l]; ctx.strokeStyle = p.g(.9 * out); ctx.stroke(paths[l]); }
                if (j === s.k && s.doneAt < 0 && s.pause <= 0) {
                    const i = Math.max(0, Math.floor(s.prog) - 1);
                    ctx.fillStyle = p.g(1); ctx.beginPath(); ctx.arc(b.sig.P[i * 2], b.sig.P[i * 2 + 1], 1.5, 0, TAU); ctx.fill();
                }
                if (b.done) {
                    const k = smooth((s.clock - b.at - 200) / 450) * out;
                    if (k > 0) {
                        const sr = clamp(b.ch * .14, 5, 11) * (1 + .25 * (1 - k)), sx = b.x1 + sr * .2, sy = b.y - b.ch * .3;
                        ctx.globalAlpha = k;
                        ctx.fillStyle = p.g(.18); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
                        ctx.lineWidth = .8; ctx.strokeStyle = p.g(.85); ctx.stroke();
                        ctx.lineWidth = .5; ctx.beginPath(); ctx.arc(sx, sy, sr * .74, 0, TAU); ctx.stroke();
                        ctx.font = `italic ${sr * .78}px ${SERIF}`; ctx.fillStyle = p.g(.95); ctx.textAlign = 'center';
                        ctx.fillText('L.S.', sx, sy + sr * .27);
                        ctx.textAlign = 'start'; ctx.globalAlpha = 1;
                    }
                }
            });
            ctx.lineCap = 'butt';
        }
    });

    /* ───────────────────────── machinery ───────────────────────── */
    const entries = new Map();
    let seedCounter = Math.floor(Math.random() * 1e6);
    const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

    function makeState(def, w, h, dpr) {
        const s = { w, h, dpr, t: def.t0 || 0, rand: rng(++seedCounter * 7919 + 13), reduced };
        if (reduced) s.t = def.stillT || 26000;
        if (def.init) def.init(s, palette());
        return s;
    }

    function render(e, dt) {
        const c = e.canvas, def = e.def;
        /* data-dpr on a canvas caps its density (the homepage intro draws its passing plates at 1x) */
        const dpr = c.dataset.dpr ? Math.min(dprOf(), +c.dataset.dpr || 1) : dprOf();
        const cw = e.cw || c.clientWidth || c.width, ch = e.ch || c.clientHeight || c.height;
        if (!cw || !ch) return;
        const W = Math.max(1, Math.min(4096, Math.round(cw * dpr))), H = Math.max(1, Math.min(4096, Math.round(ch * dpr)));
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; e.s = null; }
        const p = palette();
        if (!e.s) { e.s = makeState(def, W / dpr, H / dpr, dpr); dt = 0; e.acc = 0; }
        else if (def.every && dt > 0) {
            /* slow plates are redrawn at about thirty frames a second; the canvas keeps the last frame in between */
            e.acc = (e.acc || 0) + dt;
            if (e.acc < def.every - 4) return;
            dt = Math.min(64, e.acc); e.acc = 0;
        }
        const s = e.s, m = e.m;
        s.t += dt;
        const ease = 1 - Math.pow(.92, Math.max(1, dt / 16.7));
        const tx = m.in ? m.x : .5, ty = m.in ? m.y : .5;
        m.sx += (tx - m.sx) * ease; m.sy += (ty - m.sy) * ease;
        m.k += ((m.in ? 1 : 0) - m.k) * ease;
        const ctx = e.ctx || (e.ctx = c.getContext('2d'));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const drew = def.draw(ctx, s, p, m, dt);
        m.vx = 0; m.vy = 0;
        if (drew !== false && def.edge) edgeFade(ctx, s, p);
        e.drawn = true;
    }

    const io = 'IntersectionObserver' in window ? new IntersectionObserver(list => {
        for (const it of list) { const e = entries.get(it.target); if (e) { e.visible = it.isIntersecting; if (e.visible) wake(); } }
    }, { rootMargin: '80px' }) : null;
    const ro = 'ResizeObserver' in window ? new ResizeObserver(list => {
        for (const it of list) {
            const e = entries.get(it.target); if (!e) continue;
            e.cw = it.contentRect.width; e.ch = it.contentRect.height; e.dirty = true;
        }
        wake();
    }) : null;

    function register(canvas) {
        if (entries.has(canvas)) return;
        const e = { canvas, id: null, def: null, s: null, visible: !io, drawn: false, dirty: true, m: { x: .5, y: .5, sx: .5, sy: .5, k: 0, in: false, vx: 0, vy: 0 } };
        entries.set(canvas, e);
        if (io) io.observe(canvas);
        if (ro) ro.observe(canvas);
        const surf = canvas.closest('.specimen, .stage-generative, .gen-plate, [data-gen-pointer]') || canvas;
        surf.addEventListener('pointermove', ev => {
            const r = canvas.getBoundingClientRect(); if (!r.width) return;
            const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height, m = e.m;
            if (m.in) { m.vx += (x - m.x) * r.width; m.vy += (y - m.y) * r.height; }
            m.x = x; m.y = y; m.in = x >= 0 && y >= 0 && x <= 1 && y <= 1;
        });
        surf.addEventListener('pointerleave', () => { e.m.in = false; });
    }
    const scan = node => {
        if (node.nodeType !== 1) return;
        if (node.matches('canvas[data-plate]')) register(node);
        node.querySelectorAll?.('canvas[data-plate]').forEach(register);
    };
    scan(document.body || root);
    new MutationObserver(records => records.forEach(rec => {
        if (rec.type === 'attributes') {
            if (rec.target.nodeType === 1 && rec.target.matches('canvas[data-plate]')) { register(rec.target); wake(); }
            else if (rec.target === root) themeCheck();
            return;
        }
        rec.addedNodes.forEach(scan);
        wake();
    })).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-plate', 'class'] });

    let wasLight = root.classList.contains('light-mode');
    function themeCheck(force) {
        const light = root.classList.contains('light-mode');
        if (light === wasLight && !force) return;
        wasLight = light; PAL = null;
        entries.forEach(e => { e.s = null; e.dirty = true; });
        wake();
    }
    window.addEventListener('themechange', () => themeCheck(true));
    document.fonts?.ready?.then(() => entries.forEach(e => { if (e.id === 'g-ledger' || e.id === 'g-arcs') { e.s = null; e.dirty = true; } }));
    document.fonts?.ready?.then(() => entries.forEach(e => { if (e.id === 'g-beam' || e.id === 'g-signatures' || e.id === 'g-seal') { e.s = null; e.dirty = true; } }));

    let running = false, last = 0;
    function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    function frame(now) {
        const dt = Math.min(64, Math.max(0, now - last)); last = now;
        let any = false;
        entries.forEach((e, canvas) => {
            if (!canvas.isConnected) { entries.delete(canvas); io?.unobserve(canvas); ro?.unobserve(canvas); return; }
            const id = canvas.dataset.plate;
            if (id !== e.id) { e.id = id; e.def = DEFS[id] || null; e.s = null; e.dirty = true; }
            if (!e.def || !e.visible) return;
            if (reduced) { if (e.dirty || !e.s) { render(e, 0); e.dirty = false; } return; }
            render(e, dt); any = true;
        });
        if (!reduced && !document.hidden && any) requestAnimationFrame(frame);
        else running = false;
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    wake();

    /* time one renderer off screen: average milliseconds per frame, rasterisation included */
    function bench(id, opts = {}) {
        const def = DEFS[id]; if (!def) return null;
        const w = opts.width || 400, h = opts.height || 300, dpr = opts.dpr || 1, frames = opts.frames || 60;
        const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        const ctx = c.getContext('2d');
        const t0 = performance.now();
        const s = makeState(def, w, h, dpr);
        s.always = true;
        const init = performance.now() - t0;
        const m = { x: .5, y: .5, sx: .5, sy: .5, k: 0, in: false, vx: 0, vy: 0 };
        const p = palette();
        const once = () => { s.t += 16.7; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (def.draw(ctx, s, p, m, 16.7) !== false && def.edge) edgeFade(ctx, s, p); };
        for (let k = 0; k < 5; k++) once();
        ctx.getImageData(0, 0, 1, 1);
        const t1 = performance.now();
        const times = [];
        for (let k = 0; k < frames; k++) { const a = performance.now(); once(); times.push(performance.now() - a); }
        ctx.getImageData(0, 0, 1, 1);
        const total = performance.now() - t1;
        times.sort((a, b) => a - b);
        return { id, mean: total / frames, median: times[Math.floor(frames / 2)], max: times[frames - 1], init };
    }

    window.GenMore = {
        list: ORDER.map(id => ({ id, name: DEFS[id].name, note: DEFS[id].note })),
        bench
    };
})();
