/* Plated data-essay apparatus: progress rail, plate index and reveal-on-scroll.
   Builds the index from every .ep-plate carrying data-plate="I · Short name". */
(function () {
    function init() {
        if (!document.body.classList.contains('ep')) return;
        const rail = document.createElement('div');
        rail.className = 'ep-rail';
        document.body.appendChild(rail);
        const onScroll = () => {
            const h = document.documentElement;
            const max = h.scrollHeight - h.clientHeight;
            rail.style.width = (max > 0 ? 100 * h.scrollTop / max : 0) + '%';
        };
        addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        const plates = Array.from(document.querySelectorAll('.ep-plate[data-plate]'));
        if (plates.length > 1) {
            const idx = document.createElement('nav');
            idx.className = 'ep-index';
            idx.setAttribute('aria-label', 'Plates');
            plates.forEach((p, i) => {
                if (!p.id) p.id = 'plate-' + (i + 1);
                const [num, name] = p.dataset.plate.split(' · ');
                const a = document.createElement('a');
                a.href = '#' + p.id;
                a.innerHTML = num + (name ? '<span>&nbsp;' + name + '</span>' : '');
                idx.appendChild(a);
            });
            document.body.appendChild(idx);
            const links = Array.from(idx.querySelectorAll('a'));
            const io = new IntersectionObserver(es => es.forEach(e => {
                if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
            }), { rootMargin: '-40% 0px -40% 0px' });
            plates.forEach(p => io.observe(p));
        }

        const rev = Array.from(document.querySelectorAll('.ep-reveal'));
        const io2 = new IntersectionObserver(es => es.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); }
        }), { threshold: 0.08 });
        rev.forEach(el => { if (el.getBoundingClientRect().top < innerHeight * 1.1) el.classList.add('in'); else io2.observe(el); });
        setTimeout(() => rev.forEach(el => el.classList.add('in')), 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/* Shared chart helpers: window.EP.tip / EP.hide / EP.table. One tooltip element for
   the page, positioned to stay on screen, and table views written into a plate's
   caption as a <details> toggle. */
window.EP = window.EP || (function () {
    let tipEl = null;
    function el() {
        if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'ep-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
        return tipEl;
    }
    function move(ev) {
        const t = el(), w = t.offsetWidth, h = t.offsetHeight;
        let x = ev.clientX + 14, y = ev.clientY + 14;
        if (x + w > innerWidth - 8) x = ev.clientX - w - 10;
        if (y + h > innerHeight - 8) y = ev.clientY - h - 10;
        t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px';
    }
    function tip(ev, html) { const t = el(); t.innerHTML = html; t.classList.add('on'); move(ev); }
    function hide() { if (tipEl) tipEl.classList.remove('on'); }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    /* table(plateOrId, ['Col', 'Col'], rows, {summary: 'Table', numeric: [1]}) */
    function table(target, head, rows, opts) {
        opts = opts || {};
        const plate = typeof target === 'string' ? document.getElementById(target).closest('.ep-plate') : target;
        if (!plate) return;
        const cap = plate.querySelector('.ep-plate-caption');
        if (!cap) return;
        let d = cap.querySelector('details.ep-table');
        if (!d) { d = document.createElement('details'); d.className = 'ep-table'; cap.appendChild(d); }
        const num = new Set(opts.numeric || []);
        d.innerHTML = '<summary>' + esc(opts.summary || 'Table') + '</summary><div class="tbl"><table><tr>'
            + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>'
            + rows.map(r => '<tr>' + r.map((c, i) => '<td' + (num.has(i) ? ' class="num"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('')
            + '</table></div>';
    }
    addEventListener('scroll', hide, { passive: true });
    return { tip, move, hide, table, esc };
})();
