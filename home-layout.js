/* home-next: behaviour for the homepage prototype (home-next.html).
   - each plate's art drawn at the scale of a large plate and cropped to its strip
   - FLIP transitions when a section opens, switches or closes
   - the photograph behind the open Profile and Practice plates
   - keys: 1 to 4 open a section, Left and Right step through them, Escape returns home
   - the reading pane keeps the live page's photograph rules and is fitted to the screen
   - scroll areas fade at the bottom and say when there is more
   - generative-plates.js canvases rest while they are off screen
   The page's own scripts (the shell, the console, the annotations) run unchanged. */
(function () {
    'use strict';

    const html = document.documentElement;
    const body = document.body;
    const desktop = window.matchMedia('(min-width: 881px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const nav = document.querySelector('main > .tiles');
    const tiles = nav ? Array.from(nav.querySelectorAll('.tile')) : [];
    const ORDER = tiles.map(t => t.dataset.section);

    /* ─── FLIP: plates are measured, rearranged by the page's own class changes, then eased from where they were ─── */
    const FLIP_MS = 480;
    window.hnFlip = function (mutate) {
        if (!nav || !desktop.matches || reduced.matches || !Element.prototype.animate) { mutate(); return; }
        const first = tiles.map(t => t.getBoundingClientRect());
        tiles.forEach(t => t.getAnimations().forEach(a => a.cancel()));
        tiles.forEach(t => { const l = t.querySelector('.label'); if (l) l.getAnimations().forEach(a => a.cancel()); });
        mutate();
        tiles.forEach((t, i) => {
            const a = first[i], b = t.getBoundingClientRect();
            if (!a.width || !a.height || !b.width || !b.height) return;
            const dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
            t.animate([
                { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
                { transformOrigin: '0 0', transform: 'none' }
            ], { duration: FLIP_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
            // the caption would be seen stretched, so it waits and fades back in
            const label = t.querySelector('.label');
            if (label) label.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: FLIP_MS + 120 });
        });
    };

    /* ─── the photograph behind an open plate ─── */
    function hint(tile) { return tile.querySelector('.hn-hint'); }
    function loadPhoto(tile) {
        const img = tile.querySelector('img.hn-photo');
        if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
    }
    function labelFor(tile, on) {
        const name = (tile.querySelector('.name') || {}).textContent || '';
        return name + ', open: ' + (on ? 'return to the animation' : 'reveal the photograph');
    }
    window.hnTogglePhoto = function (tile, force) {
        if (!tile || !tile.classList.contains('has-photo')) return;
        loadPhoto(tile);
        const on = typeof force === 'boolean' ? force : !tile.classList.contains('photo-visible');
        tile.classList.toggle('photo-visible', on);
        const h = hint(tile); if (h) h.textContent = on ? 'click to return' : 'click to reveal';
        tile.setAttribute('aria-label', labelFor(tile, on));
    };
    tiles.forEach(t => { if (t.querySelector('img.hn-photo')) t.classList.add('has-photo'); });
    function syncActive() {
        const open = body.classList.contains('mode-section');
        tiles.forEach(t => {
            const active = open && t.classList.contains('active');
            if (!active) {
                if (t.classList.contains('photo-visible')) {
                    t.classList.remove('photo-visible');
                    const h = hint(t); if (h) h.textContent = 'click to reveal';
                }
                t.removeAttribute('aria-label');
            } else if (t.classList.contains('has-photo')) {
                loadPhoto(t);
                if (desktop.matches) t.setAttribute('aria-label', labelFor(t, t.classList.contains('photo-visible')));
            }
        });
    }
    if (nav) new MutationObserver(syncActive).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncActive).observe(body, { attributes: true, attributeFilter: ['class'] });

    /* ─── keys ─── */
    function introShowing() {
        const intro = document.getElementById('intro');
        return !!intro && intro.style.display !== 'none' && !intro.classList.contains('done');
    }
    window.addEventListener('keydown', e => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
        if (body.classList.contains('console-open') || body.classList.contains('nav-open')) return;
        const t = e.target;
        if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], #terminal')) return;
        const shell = window.__hnShell;
        if (!shell || introShowing()) return;
        const open = body.classList.contains('mode-section');
        const active = nav && nav.querySelector('.tile.active');
        const idx = open && active ? ORDER.indexOf(active.dataset.section) : -1;
        let target = null;
        if (/^[1-4]$/.test(e.key)) target = ORDER[Number(e.key) - 1];
        else if (e.key === 'ArrowRight') target = ORDER[idx >= 0 ? (idx + 1) % ORDER.length : 0];
        else if (e.key === 'ArrowLeft') target = ORDER[idx >= 0 ? (idx + ORDER.length - 1) % ORDER.length : ORDER.length - 1];
        else if (e.key === 'Escape' && open) {
            e.preventDefault();
            if (document.activeElement && nav && nav.contains(document.activeElement)) document.activeElement.blur();
            shell.closeSection();
            return;
        }
        if (!target) return;
        e.preventDefault();
        if (idx >= 0 && ORDER[idx] === target) return;
        shell.run(target);
        // the focus ring follows the open plate, so it never marks a thumbnail that is not the active one
        if (nav && nav.contains(document.activeElement)) {
            const t = nav.querySelector('.tile[data-section="' + target + '"]');
            if (t) t.focus({ preventScroll: true });
        }
    }, true);

    /* ─── the reading pane: the welcome is always whole; the photograph is as large as the space allows at 3:2 ─── */
    const pane = document.getElementById('home-welcome');
    function px(v) { return parseFloat(v) || 0; }
    const clampPx = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
    const panel = document.getElementById('net-panel');
    // what the changelog keeps when the screen is short: its heading and the first line of the first entry
    function logMinHeight() {
        const log = pane.querySelector('.site-changelog');
        if (!log) return 0;
        const head = log.querySelector('.changelog-head');
        const cs = getComputedStyle(log);
        return (head ? head.offsetHeight : 0) + 44 + px(cs.paddingTop) + px(cs.paddingBottom)
            + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    }
    function fitPane() {
        if (!pane) return;
        const fig = pane.querySelector(':scope > .welcome-portrait');
        const intro = pane.querySelector(':scope > .welcome-intro');
        const guest = pane.querySelector(':scope > .guestbook-invite');
        if (!desktop.matches || !fig || !intro) {
            pane.classList.remove('hn-fits');
            pane.style.removeProperty('--hn-fig-max'); pane.style.removeProperty('--hn-floor');
            return;
        }
        const img = fig.querySelector('img');
        if (!img) return;
        pane.classList.remove('hn-fits');
        // the live page's switch: the photograph stands beside the text from a 780px pane, above it below that
        const stacked = (panel ? panel.clientWidth : pane.clientWidth) < 780;
        const cs = getComputedStyle(pane);
        const innerH = pane.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom);
        if (pane.clientWidth < 50 || innerH < 50) return;
        const gap = px(cs.rowGap);
        // the live floor: clamp(190px, 32vh, 310px)
        const floorLive = clampPx(190, window.innerHeight * 0.32, 310);
        // size the picture for a one-line caption first; let the caption wrap only if the picture cannot be that wide
        const cap = fig.querySelector('figcaption');
        fig.classList.add('hn-cap-one');
        for (let k = 0; k < 4; k++) {
            if (k === 3 && cap && cap.scrollWidth > cap.clientWidth + 1) fig.classList.remove('hn-cap-one');
            const chromeW = fig.offsetWidth - img.offsetWidth, chromeH = fig.offsetHeight - img.offsetHeight;
            let floor, figMax;
            if (stacked) {
                // above the text the picture keeps the live width, min(100%, 72ch), unless the screen cannot hold
                // its height after the welcome, the changelog's heading and the guestbook line
                const lift = fig.classList.contains('hn-lift') ? px(fig.style.getPropertyValue('--hn-lift')) : 0;
                const fixed = innerH - intro.offsetHeight - (guest ? guest.offsetHeight : 0) - 3 * gap - (chromeH - lift);
                let hAllowed = fixed - logMinHeight();
                // while the captions are shown, the room they need above the picture comes out of the changelog
                // first; the picture gives up height only if that is not enough
                if (lift > 0) hAllowed = Math.min(hAllowed, fixed - lift);
                hAllowed = Math.max(60, hAllowed);
                floor = Math.min(floorLive, hAllowed);
                figMax = hAllowed * 1.5 + chromeW;
            } else {
                // beside the text: the live cap of calc(78vh + 1.2rem) on the frame, and never taller than the pane
                const hMax = innerH - chromeH;
                floor = Math.min(floorLive, hMax);
                figMax = Math.min(hMax * 1.5 + chromeW, window.innerHeight * 0.78 + 19.2);
            }
            pane.style.setProperty('--hn-floor', Math.floor(floor) + 'px');
            pane.style.setProperty('--hn-fig-max', Math.floor(figMax) + 'px');
        }
        // when everything fits with room to spare, the contents are centred in the pane, as in the original
        const scroller = pane.querySelector('.changelog-scroll');
        if (!stacked && scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
            pane.classList.add('hn-fits');
            const pb = pane.getBoundingClientRect().bottom - px(cs.paddingBottom);
            const over = [intro, scroller.parentNode, fig, guest].some(el => el && el.getBoundingClientRect().bottom > pb + 0.5);
            if (over) pane.classList.remove('hn-fits');
        }
    }
    if (pane && 'ResizeObserver' in window) new ResizeObserver(() => fitPane()).observe(pane);
    window.addEventListener('resize', fitPane);
    desktop.addEventListener('change', () => requestAnimationFrame(fitPane));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPane);
    const portrait = pane && pane.querySelector('.welcome-portrait img');
    if (portrait && !portrait.complete) portrait.addEventListener('load', fitPane, { once: true });
    fitPane();
    // the console, the annotations and the mobile strip set themselves up on DOMContentLoaded, after this file has run
    function settle() { moveLaunch(); fitPane(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle, { once: true });
    window.addEventListener('load', settle, { once: true });

    /* While "explore this photo" shows its captions, they stack upward from the shelf. When the picture is
       small they would run over the welcome text, so the frame grows at the top to hold them and fitPane()
       shrinks the picture, still at 3:2, to keep the frame in its box. (photo-annotations.js does the same
       in the mobile strip.) */
    let liftRun = 0;
    function frames(n) { return new Promise(r => { const step = () => (n-- > 0 ? requestAnimationFrame(step) : r()); step(); }); }
    async function liftForCaptions() {
        const fig = pane && pane.querySelector(':scope > .welcome-portrait');
        if (!fig) return;
        const run = ++liftRun;
        const exploring = fig.classList.contains('pa-exploring') && desktop.matches;
        let lift = 0;
        fig.classList.toggle('hn-lift', exploring);
        fig.style.setProperty('--hn-lift', '0px');
        fitPane();
        if (!exploring) return;
        for (let k = 0; k < 6; k++) {
            await frames(2);
            if (run !== liftRun) return;
            const tags = Array.from(fig.querySelectorAll('.pa-tag'));
            if (!tags.length) return;
            const top = Math.min(...tags.map(t => t.getBoundingClientRect().top));
            const need = fig.getBoundingClientRect().top + 6 - top;
            if (need <= 0.5) return;
            lift += Math.ceil(need);
            fig.style.setProperty('--hn-lift', lift + 'px');
            fitPane();
        }
    }
    // only the captions being shown or hidden matter here; fitPane's own class changes on the frame are ignored
    const exploringIn = v => /(^|\s)pa-exploring(\s|$)/.test(v || '');
    if (pane) new MutationObserver(records => {
        if (records.some(r => r.target.classList && r.target.classList.contains('welcome-portrait')
            && exploringIn(r.oldValue) !== r.target.classList.contains('pa-exploring'))) liftForCaptions();
    }).observe(pane, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });

    /* ─── each plate's art at the scale of a large plate, cropped to its strip ───
       The renderers lay out their drawing for the canvas they are given, so a short wide strip turned the
       stipple islands into specks and the constellation into a thin band. On the landing view (and on
       mobile) each canvas is given the size a plate's art had in the 2 x 2 grid study, scaled up just
       enough to cover its strip and centred in it, like object-fit: cover. The specimen clips the rest.
       Pointer positions are read against the canvas's own box, so they still map to the drawing. An open
       section's plate and the thumbnail rail draw at their own size, as before. */
    const mainEl = document.querySelector('main');
    function gridArtSize() {
        if (!desktop.matches || !mainEl) return { w: 232, h: 326 };
        const vw = document.documentElement.clientWidth, vh = window.innerHeight;
        const areaW = clampPx(400, vw * 0.38, 760);
        const pg = clampPx(8, Math.min(vw * 0.01, vh * 0.014), 16);
        const label = tiles[0] && tiles[0].querySelector('.label');
        const labelH = label ? label.offsetHeight : 40;
        return { w: Math.max(120, (areaW - 1 - 3 * pg) / 2 - 22), h: Math.max(120, (mainEl.clientHeight - 3 * pg) / 2 - 12 - labelH) };
    }
    function layoutArt() {
        const open = body.classList.contains('mode-section');
        const g = gridArtSize();
        tiles.forEach(t => {
            const c = t.querySelector('canvas'), sp = t.querySelector('.specimen');
            if (!c || !sp) return;
            if (desktop.matches && open) {
                ['width', 'height', 'left', 'top', 'right', 'bottom'].forEach(k => c.style.removeProperty(k));
                return;
            }
            const sw = sp.clientWidth, sh = sp.clientHeight;
            if (!sw || !sh) return;
            const k = Math.max(sw / g.w, sh / g.h);
            const w = Math.round(g.w * k), h = Math.round(g.h * k);
            c.style.width = w + 'px'; c.style.height = h + 'px';
            c.style.left = Math.round((sw - w) / 2) + 'px'; c.style.top = Math.round((sh - h) / 2) + 'px';
            c.style.right = 'auto'; c.style.bottom = 'auto';
        });
    }
    if ('ResizeObserver' in window) {
        const artRo = new ResizeObserver(layoutArt);
        tiles.forEach(t => { const sp = t.querySelector('.specimen'); if (sp) artRo.observe(sp); });
    }
    new MutationObserver(layoutArt).observe(body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', layoutArt);
    desktop.addEventListener('change', layoutArt);
    layoutArt();

    /* ─── scroll areas: fade and a hint while there is more below ─── */
    function watchScroll(scroller, host, more) {
        if (!scroller || !host) return;
        scroller.classList.add('hn-scrolls');
        const update = () => {
            const below = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 6;
            scroller.classList.toggle('hn-more-below', below);
            host.classList.toggle('hn-has-more', below);
        };
        scroller.addEventListener('scroll', update, { passive: true });
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(update);
            ro.observe(scroller);
            Array.from(scroller.children).forEach(ch => ro.observe(ch));
        }
        if (more) more.addEventListener('click', () => scroller.scrollBy({ top: scroller.clientHeight * 0.8, behavior: reduced.matches ? 'auto' : 'smooth' }));
        update();
    }
    const log = document.querySelector('.site-changelog');
    if (log) watchScroll(log.querySelector('.changelog-scroll'), log, log.querySelector('.hn-more'));
    const stage = document.getElementById('stage');
    if (stage) new MutationObserver(() => {
        const text = stage.querySelector(':scope > .stage-text');
        if (!text || text.dataset.hnWatched) return;
        text.dataset.hnWatched = '1';
        /* the section number and title stay pinned at the top of the text; the Research filters pin just
           below them, so only the introduction and the content scroll */
        const num = text.querySelector(':scope > .stage-num'), title = text.querySelector(':scope > .stage-title');
        if (num && title && !text.querySelector(':scope > .stage-head')) {
            const head = document.createElement('div');
            head.className = 'stage-head';
            text.insertBefore(head, num);
            head.appendChild(num); head.appendChild(title);
            const setH = () => text.style.setProperty('--stage-head-h', head.offsetHeight + 'px');
            if ('ResizeObserver' in window) new ResizeObserver(setH).observe(head);
            setH();
        }
        let more = stage.querySelector(':scope > .hn-more');
        if (!more) {
            more = document.createElement('span');
            more.className = 'hn-more';
            more.setAttribute('aria-hidden', 'true');
            more.textContent = 'scroll for more ↓';
            stage.appendChild(more);
        }
        watchScroll(text, stage, more);
    }).observe(stage, { childList: true });

    /* ─── the console control moves to the right of the wordmark row ─── */
    function moveLaunch() {
        const launch = document.querySelector('.console-launch');
        const hero = document.querySelector('main > .hero');
        if (launch && hero && launch.parentNode !== hero) hero.appendChild(launch);
    }

    /* ─── only plates that can be seen are drawn ───
       generative-plates.js draws every canvas it knows on every frame, so its canvases rest while they are
       off screen; generative-more.js already skips its own off-screen plates. Any plate also rests while a
       photograph covers it. A plate rests by having its data-plate renamed, which neither script draws. */
    const OWN = /^(chrome|moire|flow|dither|orbit|weave)$/;
    const onScreen = new WeakMap();
    const covered = c => !c.closest('#intro') && (document.documentElement.classList.contains('intro-cover')
        || !!c.closest('.tile.photo-visible, .stage-generative.photo-visible'));
    const tracked = new Set();
    /* the intro covers the page for its first second: the page's plates rest until it opens */
    window.addEventListener('intro:cover-change', () => tracked.forEach(apply));
    function apply(c) {
        const id = c.dataset.hnArt;
        if (!id) return;
        const draw = onScreen.get(c) !== false && !covered(c);
        const want = draw ? id : 'rest-' + id;
        if (c.dataset.plate !== want) c.dataset.plate = want;
    }
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(list => list.forEach(it => {
        onScreen.set(it.target, it.isIntersecting);
        apply(it.target);
    }), { rootMargin: '60px' }) : null;
    function track(c) {
        const id = c.dataset.plate || '';
        if (c.dataset.hnArt || !id || id.indexOf('rest-') === 0) return;
        c.dataset.hnArt = id;
        tracked.add(c);
        if (io && OWN.test(id)) io.observe(c);
    }
    document.querySelectorAll('canvas[data-plate]').forEach(track);
    new MutationObserver(records => records.forEach(r => {
        r.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches('canvas[data-plate]')) track(n);
            if (n.querySelectorAll) n.querySelectorAll('canvas[data-plate]').forEach(track);
        });
        if (io) r.removedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches('canvas')) io.unobserve(n);
            if (n.querySelectorAll) n.querySelectorAll('canvas').forEach(c => io.unobserve(c));
        });
    })).observe(body, { childList: true, subtree: true });
    const reapply = records => records.forEach(r => {
        const el = r.target;
        if (el.classList && (el.classList.contains('tile') || el.classList.contains('stage-generative')))
            el.querySelectorAll('canvas[data-hn-art]').forEach(apply);
    });
    [nav, stage].forEach(root => { if (root) new MutationObserver(reapply).observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] }); });
})();
