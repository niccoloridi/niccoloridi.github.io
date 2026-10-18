(() => {
    const canvases = new Set();
    const registered = new WeakSet();
    const state = new Map();
    const pointer = new WeakMap();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tau = Math.PI * 2;
    let seed = Math.random() * 900;

    function themeColor(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const hex = value.match(/^#([0-9a-f]{6})$/i);
        if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
        return fallback;
    }
    const palette = () => {
        const light = document.documentElement.classList.contains('light-mode');
        return {
            bg: themeColor('--bg', light ? [236, 231, 220] : [10, 10, 12]),
            gold: themeColor('--gold', light ? [154, 117, 33] : [215, 161, 59]),
            ink: themeColor('--fg', light ? [22, 20, 15] : [236, 232, 223]),
            light
        };
    };

    /* light theme: ink and gold on parchment; mixes toward the deeper golds of the light palette */
    const mixRGB = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    function surface(canvas) {
        const rect = canvas.getBoundingClientRect();
        /* data-dpr on a canvas caps its density (the homepage intro draws its passing plates at 1x) */
        const dpr = Math.min(devicePixelRatio || 1, 2, +canvas.dataset.dpr || 2);
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            state.delete(canvas);
        }
        return { ctx: canvas.getContext('2d'), w, h };
    }

    function wash(ctx, w, h, alpha = 1) {
        const p = palette();
        ctx.fillStyle = `rgba(${p.bg.join(',')},${alpha})`;
        ctx.fillRect(0, 0, w, h);
    }

    /* edges dissolve into the ground colour (destination-in on partial rects cleared the whole canvas) */
    function fadeEdges(ctx, w, h) {
        const bg = palette().bg.join(',');
        const fx = Math.max(18, w * .14), fy = Math.max(14, h * .2);
        const edge = (x0, y0, x1, y1, rect) => {
            const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
            gradient.addColorStop(0, `rgba(${bg},1)`);
            gradient.addColorStop(1, `rgba(${bg},0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(...rect);
        };
        edge(0, 0, fx, 0, [0, 0, fx, h]);
        edge(w, 0, w - fx, 0, [w - fx, 0, fx, h]);
        edge(0, 0, 0, fy, [0, 0, w, fy]);
        edge(0, h, 0, h - fy, [0, h - fy, w, fy]);
    }

    /* light: trails fade by the same faint wash of the ground as in the dark plate, followed by a three-level step
       towards the ground capped at the ground colour. On parchment the wash alone stalls a few levels short of the
       ground (8-bit rounding) and leaves a tinted haze over the whole plate; the step clears that residue, so old
       trails pale along their own hue and then vanish exactly into the parchment. */
    function flowLight(canvas, time, ctx, w, h, p) {
        let s = state.get(canvas);
        if (!s) {
            const count = Math.max(180, Math.min(520, Math.round(w * h / 260)));
            s = { particles: Array.from({ length: count }, () => ({
                x: Math.random() * w, y: Math.random() * h, life: 18 + Math.random() * 70
            })), fresh: true };
            state.set(canvas, s);
            wash(ctx, w, h);
        }
        const ground = `rgb(${p.bg.join(',')})`;
        const fade = () => {
            wash(ctx, w, h, .05);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgb(3,3,3)';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'darken';
            ctx.fillStyle = ground;
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
        };
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.9, w / 560);
        /* three inks: deep gold for most strands, the page gold and a brown-black for a few */
        const inks = [mixRGB(p.gold, [92, 74, 40], .45), p.gold, mixRGB(p.ink, p.gold, .3)];
        const speed = Math.max(.65, w / 430), fadeZone = Math.max(16, Math.min(w, h) * .16);
        const drawPass = (at, strength = 1) => {
            for (let i = 0; i < s.particles.length; i++) {
                const q = s.particles[i], ox = q.x, oy = q.y;
                const angle = Math.sin(q.x * .011 + at * .00022 + seed) + Math.cos(q.y * .014 - at * .00017) * 1.4;
                q.x += Math.cos(angle) * speed;
                q.y += Math.sin(angle) * speed;
                q.life--;
                const edgeFade = Math.max(0, Math.min(1, Math.min(q.x, q.y, w - q.x, h - q.y) / fadeZone));
                const ink = i % 7 === 0;
                ctx.strokeStyle = rgba(inks[ink ? 2 : i % 3 === 0 ? 1 : 0], ((ink ? .62 : .86) + (i % 9) * .015) * strength * edgeFade);
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(q.x, q.y); ctx.stroke();
                if (q.x < 0 || q.x > w || q.y < 0 || q.y > h || q.life < 0) {
                    q.x = Math.random() * w; q.y = Math.random() * h; q.life = 24 + Math.random() * 70;
                }
            }
        };
        if (s.fresh) {
            for (let warm = 40; warm > 0; warm--) { fade(); drawPass(time - warm * 16); }
            s.fresh = false;
        }
        fade();
        drawPass(time);
    }

    function flow(canvas, time) {
        const { ctx, w, h } = surface(canvas);
        const p = palette();
        if (p.light) return flowLight(canvas, time, ctx, w, h, p);
        let s = state.get(canvas);
        if (!s) {
            const count = Math.max(180, Math.min(520, Math.round(w * h / 260)));
            s = { particles: Array.from({ length: count }, () => ({
                x: Math.random() * w, y: Math.random() * h, life: 18 + Math.random() * 70
            })), fresh: true };
            state.set(canvas, s);
            wash(ctx, w, h);
        }
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(p.light ? 1.7 : 1.3, w / 650);
        const drawPass = (at, strength = 1) => {
            for (let i = 0; i < s.particles.length; i++) {
                const q = s.particles[i], ox = q.x, oy = q.y;
                const angle = Math.sin(q.x * .011 + at * .00022 + seed) + Math.cos(q.y * .014 - at * .00017) * 1.4;
                q.x += Math.cos(angle) * Math.max(.65, w / 430);
                q.y += Math.sin(angle) * Math.max(.65, w / 430);
                q.life--;
                const fadeZone = Math.max(16, Math.min(w, h) * .16);
                const edgeDistance = Math.min(q.x, q.y, w - q.x, h - q.y);
                const edgeFade = Math.max(0, Math.min(1, edgeDistance / fadeZone));
                const alpha = ((p.light ? .82 : .48) + (i % 9) * .018) * strength * edgeFade;
                ctx.strokeStyle = `rgba(${p.gold.join(',')},${alpha})`;
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(q.x, q.y); ctx.stroke();
                if (q.x < 0 || q.x > w || q.y < 0 || q.y > h || q.life < 0) {
                    q.x = Math.random() * w; q.y = Math.random() * h; q.life = 24 + Math.random() * 70;
                }
            }
        };
        if (s.fresh) {
            for (let warm = 28; warm > 0; warm--) drawPass(time - warm * 16, .68);
            s.fresh = false;
        }
        wash(ctx, w, h, .042);
        drawPass(time);
    }

    function moire(canvas, time) {
        const { ctx, w, h } = surface(canvas), p = palette(), m = pointer.get(canvas);
        wash(ctx, w, h);
        ctx.lineWidth = p.light ? Math.max(1.1, w / 1000) : Math.max(.6, w / 1100);
        for (let set = 0; set < 2; set++) {
            ctx.strokeStyle = p.light ? (set ? rgba(mixRGB(p.gold, [126, 94, 22], .5), .9) : rgba(p.ink, .42))
                : set ? `rgba(${p.gold.join(',')},.82)` : `rgba(${p.ink.join(',')},.38)`;
            for (let j = -15; j < 24; j++) {
                ctx.beginPath();
                for (let x = -8; x <= w + 8; x += 4) {
                    const u = x / w, phase = j * .13 + (set ? 1 : -1) * time * .00017;
                    const y = h * (.5 + j * .035) + Math.sin(u * 8 + phase + (m.x - .5)) * h * .17 + Math.sin(u * 18 - phase) * h * .035;
                    x === -8 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }
    }

    function orbit(canvas, time) {
        const { ctx, w, h } = surface(canvas), p = palette(), m = pointer.get(canvas);
        wash(ctx, w, h, .16);
        const r = Math.min(w, h) * .34;
        ctx.save();
        ctx.translate(w * (.5 + (m.x - .5) * .06), h * (.5 + (m.y - .5) * .06));
        ctx.rotate(time * .000028);
        ctx.lineWidth = p.light ? Math.max(1.1, w / 640) : Math.max(.7, w / 900);
        for (let k = 0; k < 11; k++) {
            ctx.strokeStyle = p.light ? rgba(k % 4 ? mixRGB(p.gold, [92, 74, 40], .3) : p.ink, .26 + k * .05)
                : `rgba(${(k % 4 ? p.gold : p.ink).join(',')},${.1 + k * .024})`;
            ctx.beginPath();
            for (let i = 0; i <= 300; i++) {
                const a = i / 300 * tau, drift = time * .0001 + k * .14;
                const rr = r * (.72 + .17 * Math.sin(3 * a + drift) + .08 * Math.cos(7 * a - drift));
                const x = Math.cos(a + k * .02) * rr, y = Math.sin(a) * rr * (.64 + .13 * Math.sin(drift));
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function chrome(canvas, time) {
        const { ctx, w, h } = surface(canvas), m = pointer.get(canvas), p = palette();
        wash(ctx, w, h);
        const bands = 31;
        for (let j = bands; j >= 0; j--) {
            const q = j / bands, phase = time * .00038 + q * 4 + seed;
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const u = i / 100, x = u * w, envelope = Math.sin(u * Math.PI);
                const y = h * (.5 + Math.sin(u * 6.2 + phase) * .15 * envelope + Math.cos(u * 2.1 - phase * .35) * .1)
                    + (q - .5) * h * .4 * (.28 + envelope) + (m.y - .5) * h * .07 * envelope;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            if (p.light) {
                /* light: the spectrum becomes a slow sheen from deep gold through gold to ink-brown */
                const f = .5 + .5 * Math.sin(q * 5.2 - time * .0007 + seed);
                const c = f < .5 ? mixRGB([92, 74, 40], p.gold, f * 2) : mixRGB(p.gold, p.ink, (f - .5) * .9);
                ctx.strokeStyle = rgba(c, .3 + q * .45);
                ctx.lineWidth = 1.3 + q * 2.4;
            } else {
                const hue = (28 + q * 175 + time * .004) % 360;
                ctx.strokeStyle = `hsla(${hue},86%,${47 + q * 40}%,${.14 + q * .24})`;
                ctx.lineWidth = 1 + q * 2.1;
            }
            ctx.stroke();
        }
    }

    function dither(canvas, time) {
        const { ctx, w, h } = surface(canvas), m = pointer.get(canvas), p = palette();
        wash(ctx, w, h);
        const customHue = Number.parseFloat(canvas.dataset.hue);
        const customSpan = Number.parseFloat(canvas.dataset.hueSpan);
        const hueBase = Number.isFinite(customHue) ? customHue : 28;
        const hueSpan = Number.isFinite(customSpan) ? customSpan : 120;
        const glow = canvas.dataset.glow === 'true' && !p.light;
        const strongLight = p.light && canvas.dataset.lightContrast === 'strong';
        /* light theme only: a hue on the canvas tints the gold toward an ink of that hue (data-tint, 0 to 1,
           default 1), and data-soft prints smaller, lighter dots; the dark theme ignores both */
        const tintRaw = Number.parseFloat(canvas.dataset.tint);
        const tint = p.light && Number.isFinite(customHue) ? (Number.isFinite(tintRaw) ? Math.max(0, Math.min(1, tintRaw)) : 1) : 0;
        const soft = p.light && canvas.dataset.soft === 'true';
        const hsl = (hh, ss, ll) => { const a = ss * Math.min(ll, 1 - ll), f = n => { const k = (n + hh / 30) % 12; return Math.round(255 * (ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
        const animationTime = strongLight ? time * 1.18 : time;
        const step = Math.max(5, Math.round(w / 54));
        for (let y = step / 2; y < h; y += step) {
            for (let x = step / 2; x < w; x += step) {
                const u = x / w, v = y / h;
                const wave = (Math.sin(u * 12 + animationTime * .0011) + Math.cos(v * 15 - animationTime * .0008) + Math.sin((u + v) * 9 - animationTime * .0004)) / 3;
                const pull = Math.max(0, 1 - Math.hypot(u - m.x, v - m.y) * 3.2);
                const size = step * (strongLight ? .18 + .42 * (wave * .5 + .5) + pull * .18
                    : soft ? .1 + .3 * (wave * .5 + .5) + pull * .15
                    : p.light ? .15 + .4 * (wave * .5 + .5) + pull * .2 : .11 + .35 * (wave * .5 + .5) + pull * .2);
                if (p.light) {
                    /* light: printed in gold and ink, the crests darkening towards ink-brown */
                    const f = (wave * .5 + .5 + .25 * Math.sin(u * 5 - v * 3 + animationTime * .0005)) / 1.25;
                    let c = f < .55 ? mixRGB(p.gold, [126, 94, 22], f / .55) : mixRGB([126, 94, 22], [92, 74, 40], Math.min(.7, (f - .55) / .45));
                    if (tint > 0) c = mixRGB(c, hsl((hueBase + hueSpan * (wave * .5 + .5) + animationTime * .008) % 360, .46, .3 + .06 * wave), tint);
                    ctx.fillStyle = rgba(c, Math.min(1, (soft ? .42 : strongLight ? .76 : .6) + .25 * f + pull * .2));
                } else {
                    const hue = (hueBase + hueSpan * (wave * .5 + .5) + animationTime * .008) % 360;
                    const lightness = glow ? 58 + wave * 17 : 54 + wave * 18;
                    const alpha = (glow ? .48 : .32) + pull * .35;
                    ctx.fillStyle = `hsla(${hue},${glow ? 92 : 82}%,${lightness}%,${alpha})`;
                }
                ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.max(1, Math.round(size)), Math.max(1, Math.round(size)));
            }
        }
    }

    function weave(canvas, time) {
        const { ctx, w, h } = surface(canvas), p = palette(), m = pointer.get(canvas);
        wash(ctx, w, h);
        ctx.lineCap = 'round';
        for (let set = 0; set < 2; set++) {
            for (let k = 0; k < 18; k++) {
                ctx.beginPath();
                for (let i = 0; i <= 120; i++) {
                    const u = i / 120, x = u * w, phase = k * .3 + time * .0003 * (set ? 1 : -1);
                    const y = h * (.5 + (k - 8.5) * .025)
                        + Math.sin(u * (set ? 9 : 6) + phase) * h * .17 * Math.sin(u * Math.PI)
                        + (m.y - .5) * h * .06;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                if (p.light) {
                    /* light: one set of threads in gold, the other in ink */
                    ctx.strokeStyle = set ? rgba(mixRGB(p.gold, [92, 74, 40], k / 34), .5 + k * .015) : rgba(p.ink, .2 + k * .012);
                    ctx.lineWidth = Math.max(1.4, w / 600) + k * .06;
                } else {
                    const hue = (set ? 38 : 190) + k * 3 + time * .003;
                    ctx.strokeStyle = `hsla(${hue},90%,${58 + k}%,.32)`;
                    ctx.lineWidth = Math.max(1.1, w / 760) + k * .055;
                }
                ctx.stroke();
            }
        }
        fadeEdges(ctx, w, h);
    }

    const renderers = { flow, moire, orbit, chrome, dither, weave };
    function register(canvas) {
        if (registered.has(canvas)) return;
        registered.add(canvas);
        canvases.add(canvas);
        pointer.set(canvas, { x: .5, y: .5 });
        const surface = canvas.closest('.specimen, .stage-generative') || canvas;
        surface.addEventListener('pointermove', event => {
            const rect = canvas.getBoundingClientRect(), m = pointer.get(canvas);
            m.x = (event.clientX - rect.left) / rect.width;
            m.y = (event.clientY - rect.top) / rect.height;
        });
    }
    document.querySelectorAll('canvas[data-plate]').forEach(register);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('canvas[data-plate]')) register(node);
        node.querySelectorAll?.('canvas[data-plate]').forEach(register);
    }))).observe(document.body, { childList: true, subtree: true });

    let wasLight = document.documentElement.classList.contains('light-mode');
    function frame(time) {
        const light = document.documentElement.classList.contains('light-mode');
        if (light !== wasLight) { state.clear(); wasLight = light; }
        canvases.forEach(canvas => {
            if (!canvas.isConnected) { canvases.delete(canvas); state.delete(canvas); return; }
            const render = renderers[canvas.dataset.plate];
            if (render) render(canvas, time);
        });
        if (!reduced && !document.hidden) requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !reduced) requestAnimationFrame(frame);
    });
    requestAnimationFrame(frame);
})();
