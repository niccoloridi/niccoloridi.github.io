/* The framed certificates on the shelf, marked on the homepage photograph.
   Each mark blinks in place; hovering one draws a cartographic callout over the
   picture. Positions are held in the image's own 1080 x 720 space and projected
   through the same cover arithmetic the CSS uses, so they stay on their frames
   however far the sides are cropped away. */
(function () {
    const IMG_W = 1080, IMG_H = 720;

    const MARKS = [
        { key: 'unatra',    x: 515, y: 324, label: 'UNATRA share' },
        { key: 'beyrouth',  x: 582, y: 315, label: 'Électricité de Beyrouth share' },
        { key: 'barcelona', x: 670, y: 324, label: 'Barcelona Traction, Light and Power share' },
        { key: 'brazil',    x: 746, y: 321, label: 'Brazilian loan' }
    ];

    const RISE = 44;    // how far above the point the rule sits
    const KICK = 20;    // horizontal throw of the elbow
    const NS = 'http://www.w3.org/2000/svg';

    function init() {
        const figure = document.querySelector('.welcome-portrait');
        const img = figure && figure.querySelector('img');
        if (!figure || !img) return;

        figure.classList.add('pa-ready');

        const stage = document.createElement('div');
        stage.className = 'pa-stage';
        img.parentNode.insertBefore(stage, img);
        stage.appendChild(img);

        const bounds = figure.closest('.net-panel') || figure.parentElement;

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'pa-leaders');
        svg.setAttribute('aria-hidden', 'true');
        stage.appendChild(svg);

        const leaderCase = document.createElementNS(NS, 'polyline');
        leaderCase.setAttribute('class', 'pa-leader-case');
        svg.appendChild(leaderCase);
        const leader = document.createElementNS(NS, 'polyline');
        leader.setAttribute('class', 'pa-leader');
        svg.appendChild(leader);

        const built = MARKS.map(m => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'pa-mark';
            dot.setAttribute('aria-label', m.label);
            stage.appendChild(dot);

            const tag = document.createElement('span');
            tag.className = 'pa-tag';
            tag.textContent = m.label;
            tag.setAttribute('aria-hidden', 'true');
            stage.appendChild(tag);

            return { m, dot, tag, pos: { x: 0, y: 0 } };
        });

        /* object-fit: cover with a centred object-position — the same projection the
           browser applies to the picture, so the marks travel with the crop. */
        function project() {
            const w = stage.clientWidth, h = stage.clientHeight;
            if (!w || !h) return;
            const scale = Math.max(w / IMG_W, h / IMG_H);
            const rw = IMG_W * scale, rh = IMG_H * scale;
            const ox = (w - rw) / 2, oy = (h - rh) / 2;

            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            built.forEach(b => {
                b.pos.x = ox + (b.m.x / IMG_W) * rw;
                b.pos.y = oy + (b.m.y / IMG_H) * rh;
                b.dot.style.left = b.pos.x + 'px';
                b.dot.style.top = b.pos.y + 'px';
            });
            if (active) place(active);
        }

        /* A caption may hang outside the photograph when that reads better; it is held
           inside the reading panel, which is what would clip it. Because the clamp can
           move the label, the leader is drawn to whichever end of the rule survives it. */
        function place(b) {
            const w = stage.clientWidth;
            const tw = b.tag.offsetWidth;
            const sr = stage.getBoundingClientRect();
            const br = (bounds || stage).getBoundingClientRect();
            const minLeft = br.left + 10 - sr.left;
            const maxLeft = br.right - 10 - tw - sr.left;
            const minRuleY = br.top + 12 - sr.top;

            const toLeft = b.pos.x > w / 2;
            let left = toLeft ? b.pos.x - KICK - tw : b.pos.x + KICK;
            left = Math.max(minLeft, Math.min(left, maxLeft));
            const ruleY = Math.max(minRuleY + b.tag.offsetHeight, b.pos.y - RISE);
            const nearX = Math.abs(left - b.pos.x) < Math.abs(left + tw - b.pos.x) ? left : left + tw;

            b.tag.style.left = left + 'px';
            b.tag.style.top = ruleY + 'px';
            const pts = `${nearX},${ruleY} ${b.pos.x},${Math.min(ruleY + KICK, b.pos.y - 9)} ${b.pos.x},${b.pos.y - 9}`;
            leader.setAttribute('points', pts);
            leaderCase.setAttribute('points', pts);
        }

        let active = null;
        function show(b) {
            if (active === b) return;
            if (active) active.tag.classList.remove('is-on');
            active = b;
            place(b);
            b.tag.classList.add('is-on');
            stage.classList.add('pa-showing');
        }
        function clear() {
            if (active) active.tag.classList.remove('is-on');
            active = null;
            stage.classList.remove('pa-showing');
        }

        built.forEach(b => {
            b.dot.addEventListener('mouseenter', () => show(b));
            b.dot.addEventListener('focus', () => show(b));
            b.dot.addEventListener('mouseleave', clear);
            b.dot.addEventListener('blur', clear);
            b.dot.addEventListener('click', e => e.preventDefault());
        });
        stage.addEventListener('mouseleave', clear);

        project();
        if ('ResizeObserver' in window) new ResizeObserver(project).observe(stage);
        window.addEventListener('resize', project);
        if (img.complete) project(); else img.addEventListener('load', project, { once: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
