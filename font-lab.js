/* Type lab: try the site in different font pairings. Add ?font to any page that
   loads this file, then pick a set from the switcher or press 1-6. The choice is
   kept for the browser tab, so it survives moving between sections and pages.
   Inert without the query string (or a previously chosen set in this tab). */
(function () {
    const SETS = [
        { n: 'Space Grotesk + JetBrains Mono', note: 'the site as it stands',
          display: '"Space Grotesk", system-ui, sans-serif',
          body: '"Space Grotesk", system-ui, sans-serif',
          mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
          href: null },
        { n: 'Instrument Serif + Inter', note: 'high-contrast serif over a neutral sans',
          display: '"Instrument Serif", Georgia, serif',
          body: '"Inter", system-ui, sans-serif',
          mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
          href: 'Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500',
          tweak: '.wordmark, .intro-name { letter-spacing: -0.005em; font-weight: 400; }' },
        { n: 'Fraunces + Source Serif 4', note: 'warm, scholarly, a book on a desk',
          display: '"Fraunces", Georgia, serif',
          body: '"Source Serif 4", Georgia, serif',
          mono: '"IBM Plex Mono", ui-monospace, monospace',
          href: 'Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500',
          tweak: '.wordmark, .intro-name { letter-spacing: -0.01em; }' },
        { n: 'EB Garamond + Courier Prime', note: 'the oldest room in the building',
          display: '"EB Garamond", Garamond, serif',
          body: '"EB Garamond", Garamond, serif',
          mono: '"Courier Prime", Courier, monospace',
          href: 'EB+Garamond:wght@400;500;600;700&family=Courier+Prime:wght@400;700',
          tweak: '.wordmark, .intro-name { letter-spacing: 0; } .welcome-copy { font-size: clamp(1.04rem,1.3vw,1.26rem); }' },
        { n: 'Archivo + Inter', note: 'Swiss, plain, very quiet',
          display: '"Archivo", system-ui, sans-serif',
          body: '"Inter", system-ui, sans-serif',
          mono: '"IBM Plex Mono", ui-monospace, monospace',
          href: 'Archivo:wght@500;600;700&family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500',
          tweak: '.wordmark, .intro-name { letter-spacing: -0.035em; }' },
        { n: 'IBM Plex, throughout', note: 'one superfamily doing every job',
          display: '"IBM Plex Sans", system-ui, sans-serif',
          body: '"IBM Plex Sans", system-ui, sans-serif',
          mono: '"IBM Plex Mono", ui-monospace, monospace',
          href: 'IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
          tweak: '.wordmark, .intro-name { letter-spacing: -0.02em; }' }
    ];

    const params = new URLSearchParams(location.search);
    let stored = null;
    try { stored = sessionStorage.getItem('font-lab'); } catch (e) { /* private window */ }
    if (!params.has('font') && stored === null) return;

    let current = Number(params.get('font') || stored || 1);
    if (!Number.isInteger(current) || current < 1 || current > SETS.length) current = 1;

    const styleEl = document.createElement('style');
    styleEl.id = 'font-lab-style';
    document.head.appendChild(styleEl);
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    document.head.appendChild(linkEl);

    function apply(i) {
        current = i;
        const s = SETS[i - 1];
        if (s.href) linkEl.href = 'https://fonts.googleapis.com/css2?family=' + s.href + '&display=swap';
        else linkEl.removeAttribute('href');
        styleEl.textContent =
            ':root, html.light-mode, body, body.light-mode {'
            + '--grotesk:' + s.body + ';--mono:' + s.mono + ';--fl-display:' + s.display + ';'
            + '--font-display:' + s.display + ';--font-body:' + s.body + ';--font-mono:' + s.mono + ';}'
            /* the big type takes the display face; everything else follows --grotesk */
            + '.wordmark, .intro-name, .stage-title, .tile .label .name, .essay-body h2, .essay-header h1'
            + '{ font-family: var(--fl-display); }'
            + (s.tweak || '');
        try { sessionStorage.setItem('font-lab', String(i)); } catch (e) { /* ignore */ }
        paintSwitcher();
    }

    let box;
    function paintSwitcher() {
        if (!box) return;
        const s = SETS[current - 1];
        box.querySelector('.fl-name').textContent = s.n;
        box.querySelector('.fl-note').textContent = s.note;
        box.querySelectorAll('button[data-set]').forEach(b =>
            b.setAttribute('aria-current', String(Number(b.dataset.set) === current)));
    }

    function build() {
        box = document.createElement('aside');
        box.className = 'font-lab';
        box.innerHTML = '<div class="fl-head"><span class="fl-label">type</span>'
            + SETS.map((s, i) => '<button type="button" data-set="' + (i + 1) + '" title="' + s.n + '">' + (i + 1) + '</button>').join('')
            + '<a class="fl-exit" href="' + exitUrl() + '">exit</a></div>'
            + '<div class="fl-name"></div><div class="fl-note"></div>';
        box.querySelectorAll('button[data-set]').forEach(b =>
            b.addEventListener('click', () => apply(Number(b.dataset.set))));
        box.querySelector('.fl-exit').addEventListener('click', () => {
            try { sessionStorage.removeItem('font-lab'); } catch (e) { /* ignore */ }
        });
        document.body.appendChild(box);
        paintSwitcher();
    }

    function exitUrl() {
        const q = new URLSearchParams(location.search);
        q.delete('font');
        const s = q.toString();
        return location.pathname + (s ? '?' + s : '') + location.hash;
    }

    document.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea')) return;
        const n = Number(e.key);
        if (n >= 1 && n <= SETS.length) apply(n);
    });

    if (params.has('cap')) {   /* TEMP capture aid */
        const i0 = document.getElementById('intro'); if (i0) i0.style.display = 'none';
        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('home-content-ready', 'networks-revealed');
            setTimeout(() => window.dispatchEvent(new Event('intro:done')), 150);
            const w = document.createElement('img');
            w.src = '/__slow?ms=3200';
            w.style.cssText = 'position:fixed;left:-9px;top:-9px;width:1px;height:1px';
            document.body.appendChild(w);
        });
    }

    apply(current);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true });
    else build();
})();
