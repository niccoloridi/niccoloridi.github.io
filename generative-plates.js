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

    function surface(canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
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

    function fadeEdges(ctx, w, h) {
        const fx = Math.max(18, w * .14), fy = Math.max(14, h * .2);
        const edge = (x0, y0, x1, y1, rect, reverse = false) => {
            const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
            gradient.addColorStop(0, reverse ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)');
            gradient.addColorStop(1, reverse ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(...rect);
        };
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        edge(0, 0, fx, 0, [0, 0, fx, h]);
        edge(w - fx, 0, w, 0, [w - fx, 0, fx, h], true);
        edge(0, 0, 0, fy, [0, 0, w, fy]);
        edge(0, h - fy, 0, h, [0, h - fy, w, fy], true);
        ctx.restore();
    }

    function flow(canvas, time) {
        const { ctx, w, h } = surface(canvas);
        const p = palette();
        let s = state.get(canvas);
        if (!s) {
            const count = Math.min(520, Math.round(w * h / 260));
            s = { particles: Array.from({ length: count }, () => ({
                x: Math.random() * w, y: Math.random() * h, life: 18 + Math.random() * 70
            })) };
            state.set(canvas, s);
            wash(ctx, w, h);
        }
        wash(ctx, w, h, .042);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(p.light ? 1.7 : 1.3, w / 650);
        for (let i = 0; i < s.particles.length; i++) {
            const q = s.particles[i], ox = q.x, oy = q.y;
            const angle = Math.sin(q.x * .011 + time * .00022 + seed) + Math.cos(q.y * .014 - time * .00017) * 1.4;
            q.x += Math.cos(angle) * Math.max(.65, w / 430);
            q.y += Math.sin(angle) * Math.max(.65, w / 430);
            q.life--;
            ctx.strokeStyle = `rgba(${p.gold.join(',')},${(p.light ? .82 : .48) + (i % 9) * .018})`;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(q.x, q.y); ctx.stroke();
            if (q.x < 0 || q.x > w || q.y < 0 || q.y > h || q.life < 0) {
                q.x = Math.random() * w; q.y = Math.random() * h; q.life = 24 + Math.random() * 70;
            }
        }
        fadeEdges(ctx, w, h);
    }

    function moire(canvas, time) {
        const { ctx, w, h } = surface(canvas), p = palette(), m = pointer.get(canvas);
        wash(ctx, w, h);
        ctx.lineWidth = Math.max(.6, w / 1100);
        for (let set = 0; set < 2; set++) {
            ctx.strokeStyle = set ? `rgba(${p.gold.join(',')},${p.light ? .72 : .82})` : `rgba(${p.ink.join(',')},${p.light ? .3 : .38})`;
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
        ctx.lineWidth = Math.max(.7, w / 900);
        for (let k = 0; k < 11; k++) {
            ctx.strokeStyle = `rgba(${(k % 4 ? p.gold : p.ink).join(',')},${.1 + k * .024})`;
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
            const hue = (28 + q * 175 + time * .004) % 360;
            const lightness = p.light ? 30 + q * 27 : 47 + q * 40;
            ctx.strokeStyle = `hsla(${hue},${p.light ? 78 : 86}%,${lightness}%,${(p.light ? .17 : .14) + q * .24})`;
            ctx.lineWidth = 1 + q * 2.1;
            ctx.stroke();
        }
    }

    function dither(canvas, time) {
        const { ctx, w, h } = surface(canvas), m = pointer.get(canvas), p = palette();
        wash(ctx, w, h);
        const step = Math.max(5, Math.round(w / 54));
        for (let y = step / 2; y < h; y += step) {
            for (let x = step / 2; x < w; x += step) {
                const u = x / w, v = y / h;
                const wave = (Math.sin(u * 12 + time * .0011) + Math.cos(v * 15 - time * .0008) + Math.sin((u + v) * 9 - time * .0004)) / 3;
                const pull = Math.max(0, 1 - Math.hypot(u - m.x, v - m.y) * 3.2);
                const size = step * (.11 + .35 * (wave * .5 + .5) + pull * .2);
                const hue = (28 + 120 * (wave * .5 + .5) + time * .008) % 360;
                const lightness = p.light ? 27 + wave * 13 : 54 + wave * 18;
                ctx.fillStyle = `hsla(${hue},${p.light ? 72 : 82}%,${lightness}%,${(p.light ? .35 : .32) + pull * .35})`;
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
                const color = set ? p.gold : p.ink;
                ctx.strokeStyle = `rgba(${color.join(',')},${set ? (p.light ? .78 : .74) : (p.light ? .22 : .2)})`;
                ctx.lineWidth = Math.max(1, w / 760) + k * .045;
                ctx.stroke();
            }
        }
        fadeEdges(ctx, w, h);
    }

    const renderers = { flow, moire, orbit, chrome, dither, weave };
    const profileVariant = new URLSearchParams(location.search).get('profile') === 'weave';
    const rendererFor = canvas => profileVariant && canvas.dataset.plate === 'flow' ? 'weave' : canvas.dataset.plate;
    function register(canvas) {
        if (registered.has(canvas)) return;
        registered.add(canvas);
        canvases.add(canvas);
        if (profileVariant && canvas.dataset.plate === 'flow') canvas.setAttribute('aria-label', 'Animated vector weave');
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
            renderers[rendererFor(canvas)](canvas, time);
        });
        if (!reduced && !document.hidden) requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !reduced) requestAnimationFrame(frame);
    });
    requestAnimationFrame(frame);
})();
