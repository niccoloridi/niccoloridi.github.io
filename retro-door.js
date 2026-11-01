/* A hidden door: a long press on the theme button opens a small menu with a third option, 1990s, which leads to /retro.
   A normal click still just switches the theme. Holding Enter or Space on the button opens the menu too. */
(function () {
    const HOLD = 600;
    let timer = 0, fired = false, pop = null;
    const style = document.createElement('style');
    style.textContent = '.tog { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation; }'
        + '.theme-pop { position: fixed; z-index: 2000; min-width: 7.5rem; padding: 0.25rem; list-style: none; margin: 0; background: var(--bg); border: 1px solid var(--gold); box-shadow: 0 6px 22px rgba(0,0,0,.35); }'
        + '.theme-pop button { display: block; width: 100%; padding: 0.42rem 0.6rem; border: 0; background: none; color: var(--fg); font: 0.72rem/1.2 var(--mono); letter-spacing: 0.08em; text-align: left; cursor: pointer; }'
        + '.theme-pop button:hover, .theme-pop button:focus-visible { background: var(--gold); color: var(--bg); outline: 0; }';
    document.head.appendChild(style);
    function close() { if (pop) { pop.remove(); pop = null; } }
    function open(tog) {
        close();
        const light = document.documentElement.classList.contains('light-mode');
        pop = document.createElement('ul');
        pop.className = 'theme-pop'; pop.setAttribute('role', 'menu');
        [['dark', () => { if (light) toggleTheme(); }], ['light', () => { if (!light) toggleTheme(); }], ['1990s', () => { location.href = '/retro/'; }]].forEach(([label, go]) => {
            const li = document.createElement('li'), b = document.createElement('button');
            b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = label;
            b.addEventListener('click', () => { close(); go(); });
            li.appendChild(b); pop.appendChild(li);
        });
        document.body.appendChild(pop);
        const r = tog.getBoundingClientRect(), w = pop.offsetWidth;
        pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
        pop.style.top = r.bottom + 6 + 'px';
        pop.querySelector('button:last-child') && pop.querySelector('li:last-child button').focus();
    }
    const cancel = () => clearTimeout(timer);
    document.addEventListener('pointerdown', e => {
        const tog = e.target.closest && e.target.closest('.tog');
        if (!tog) { if (pop && !e.target.closest('.theme-pop')) close(); return; }
        fired = false; cancel();
        timer = setTimeout(() => { fired = true; open(tog); }, HOLD);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => document.addEventListener(n, cancel));
    /* after a long press the release must not also switch the theme */
    document.addEventListener('click', e => {
        if (fired && e.target.closest && e.target.closest('.tog')) { e.stopPropagation(); e.preventDefault(); fired = false; }
    }, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.tog')) e.preventDefault(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { close(); return; }
        const tog = e.target.closest && e.target.closest('.tog');
        if (tog && e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!pop) { fired = true; open(tog); } }
    });
})();
