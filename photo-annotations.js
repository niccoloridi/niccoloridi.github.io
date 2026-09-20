/* The framed certificates on the shelf, captioned on request. "Explore this photo"
   under the picture lays out all four callouts at once, stacked in rows above the
   shelf. Positions are held in the image's own 1080 x 720 space and projected
   through the same cover arithmetic the CSS uses, so the callouts stay on their
   frames however far the sides of the picture are cropped away. */
(function () {
    const IMG_W = 1080, IMG_H = 720;

    const MARKS = [
        { key: 'unatra', x: 515, y: 324, label: 'UNATRA share',
          href: 'https://www.icj-cij.org/sites/default/files/permanent-court-of-international-justice/serie_AB/AB_63/01_Oscar_Chinn_Arret.pdf' },
        { key: 'beyrouth', x: 582, y: 315, label: '\u00c9lectricit\u00e9 de Beyrouth share',
          href: 'https://www.icj-cij.org/case/20' },
        { key: 'barcelona', x: 670, y: 324, label: 'Barcelona Traction, Light and Power share',
          href: 'https://www.icj-cij.org/case/50' },
        { key: 'serbian', x: 746, y: 321, label: 'Serbian loan',
          href: 'https://www.icj-cij.org/sites/default/files/permanent-court-of-international-justice/serie_A/A_20/62_Emprunts_Serbes_Arret.pdf' }
    ];

    const LEAD = 16;    // clearance between the lowest rule and the frames
    const GAP = 9;      // between stacked labels
    const EDGE = 10;    // inset from the reading panel, which would clip anything past it
    const OVERHANG = 18; // how far a caption may hang left of the frame
    const RING = 4.5;
    const NS = 'http://www.w3.org/2000/svg';

    const svgEl = (name, cls) => {
        const n = document.createElementNS(NS, name);
        n.setAttribute('class', cls);
        return n;
    };

    function init() {
        const figure = document.querySelector('.welcome-portrait');
        const img = figure && figure.querySelector('img');
        if (!figure || !img) return;

        figure.classList.add('pa-ready');

        const stage = document.createElement('div');
        stage.className = 'pa-stage';
        img.parentNode.insertBefore(stage, img);
        stage.appendChild(img);

        const svg = svgEl('svg', 'pa-leaders');
        svg.setAttribute('aria-hidden', 'true');
        stage.appendChild(svg);

        const built = MARKS.map(m => {
            const kase = svgEl('polyline', 'pa-leader-case');
            const line = svgEl('polyline', 'pa-leader');
            const ring = svgEl('circle', 'pa-ring');
            ring.setAttribute('r', RING);
            svg.append(kase, line, ring);

            // each caption links to the case the certificate belongs to
            const tag = document.createElement('a');
            tag.className = 'pa-tag';
            tag.textContent = m.label;
            tag.href = m.href;
            tag.target = '_blank';
            tag.rel = 'noopener noreferrer';
            stage.appendChild(tag);
            return { m, tag, kase, line, ring, pos: { x: 0, y: 0 } };
        });

        let caption = figure.querySelector('figcaption');
        if (!caption) { caption = document.createElement('figcaption'); figure.appendChild(caption); }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pa-explore';
        btn.setAttribute('aria-expanded', 'false');
        caption.appendChild(btn);

        let exploring = false;

        /* object-fit: cover with a centred object-position — the same projection the
           browser applies to the picture. */
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
            });
            if (exploring) layout();
        }

        /* Rows stack upward from just above the frames, rightmost frame on the top row.
           Each leader drops straight down from the end of its rule, so a label must
           never lie across the x of any frame whose label sits higher: every row but
           the top therefore extends leftward, away from the leaders above it. */
        function layout() {
            const sr = stage.getBoundingClientRect();
            // the figure moves between the pane and the mobile strip, so its boundary is looked up each time
            const bounds = figure.closest('.net-panel, .mobile-welcome') || figure.parentElement;
            const br = bounds.getBoundingClientRect();
            const fr = figure.getBoundingClientRect();
            /* in the pane, captions may hang past the frame but not across the gutter into
               the text; in the narrow mobile strip there is no room to hang, so they stay in */
            const inStrip = bounds.classList.contains('mobile-welcome');
            const minLeft = (inStrip ? fr.left + EDGE : Math.max(br.left + EDGE, fr.left - OVERHANG)) - sr.left;
            const maxRight = (inStrip ? fr.right - EDGE : br.right - EDGE) - sr.left;

            const rows = built.slice().sort((a, b) => b.pos.x - a.pos.x);
            let ruleY = Math.min(...built.map(b => b.pos.y)) - LEAD;
            let prevRule = null, prevRight = -Infinity, top = Infinity;

            for (let i = rows.length - 1; i >= 0; i--) {
                const b = rows[i];
                const tw = b.tag.offsetWidth, th = b.tag.offsetHeight;
                const toRight = i === 0 && b.pos.x + tw <= maxRight;
                let left = toRight ? b.pos.x : b.pos.x - tw;
                left = Math.max(minLeft, Math.min(left, maxRight - tw));
                const nearX = toRight ? left : left + tw;

                /* the top label runs rightward, the one below it leftward — when they
                   clear each other they share a baseline instead of stacking */
                const shares = i === 0 && toRight && prevRule !== null && left >= prevRight + 12;
                const y = shares ? prevRule : ruleY;

                b.tag.style.left = left + 'px';
                b.tag.style.top = y + 'px';
                b.tag.style.transitionDelay = ((rows.length - 1 - i) * 0.07) + 's';

                const pts = `${nearX},${y} ${b.pos.x},${y} ${b.pos.x},${b.pos.y - RING}`;
                b.kase.setAttribute('points', pts);
                b.line.setAttribute('points', pts);
                b.ring.setAttribute('cx', b.pos.x);
                b.ring.setAttribute('cy', b.pos.y);

                if (!shares) ruleY = y - th - GAP;
                prevRule = y;
                prevRight = left + tw;
                top = Math.min(top, y - th);
            }

            /* In the mobile strip the shelf sits too near the top of a short picture for
               three rows of labels, so the frame grows at the top to make room — the
               picture moves down inside it rather than the labels running over the text. */
            figure.style.paddingTop = '';
            if (inStrip) {
                const need = -(stage.offsetTop + top) + EDGE;
                if (need > 0) figure.style.paddingTop = (parseFloat(getComputedStyle(figure).paddingTop) + need) + 'px';
            }
        }

        function setExploring(on) {
            exploring = on;
            if (on) { project(); layout(); }
            figure.classList.toggle('pa-exploring', on);
            if (!on) figure.style.paddingTop = '';
            btn.setAttribute('aria-expanded', String(on));
            btn.innerHTML = on
                ? '<span aria-hidden="true">&times;</span> hide captions'
                : '<span aria-hidden="true">&#9678;</span> explore this photo';
        }

        btn.addEventListener('click', () => setExploring(!exploring));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && exploring) setExploring(false); });

        setExploring(false);
        project();
        if ('ResizeObserver' in window) new ResizeObserver(project).observe(stage);
        window.addEventListener('resize', project);
        if (img.complete) project(); else img.addEventListener('load', project, { once: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => exploring && layout());
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
