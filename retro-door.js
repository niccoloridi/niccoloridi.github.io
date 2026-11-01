/* The theme button offers three choices: dark, light and 1990s, which leads to /retro. With a mouse a click opens the menu.
   On touch screens a tap still just switches the theme, and a long press opens the menu. */
(function () {
    const HOLD = 600, mouse = matchMedia('(hover: hover) and (pointer: fine)');
    let timer = 0, fired = false, pop = null;
    const style = document.createElement('style');
    style.textContent = '.tog { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation; }'
        + '@media (hover: hover) and (pointer: fine) { .tog::after { content: " \\25BE"; } }'
        + '.theme-pop { position: fixed; z-index: 2000; min-width: 7.5rem; padding: 0.25rem; list-style: none; margin: 0; background: var(--bg); border: 1px solid var(--gold); box-shadow: 0 6px 22px rgba(0,0,0,.35); }'
        + '.theme-pop button { display: block; width: 100%; padding: 0.42rem 0.6rem; border: 0; background: none; color: var(--fg); font: 0.72rem/1.2 var(--mono); letter-spacing: 0.08em; text-align: left; cursor: pointer; }'
        + '.theme-pop button[aria-current] { color: var(--gold); }'
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
            if (label === (light ? 'light' : 'dark')) b.setAttribute('aria-current', 'true');
            b.addEventListener('click', () => { close(); go(); });
            li.appendChild(b); pop.appendChild(li);
        });
        document.body.appendChild(pop);
        const r = tog.getBoundingClientRect(), w = pop.offsetWidth;
        pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
        pop.style.top = r.bottom + 6 + 'px';
        pop.querySelector('button').focus({ preventScroll: true });
    }
    const cancel = () => clearTimeout(timer);
    document.addEventListener('pointerdown', e => {
        const tog = e.target.closest && e.target.closest('.tog');
        if (!tog) { if (pop && !e.target.closest('.theme-pop')) close(); return; }
        if (mouse.matches) return;
        fired = false; cancel();
        timer = setTimeout(() => { fired = true; open(tog); }, HOLD);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => document.addEventListener(n, cancel));
    /* the click never reaches the button's own handler when it opened the menu, or when a long press just did */
    document.addEventListener('click', e => {
        const tog = e.target.closest && e.target.closest('.tog');
        if (!tog) return;
        if (mouse.matches) { e.stopPropagation(); e.preventDefault(); if (pop) { close(); tog.focus(); } else open(tog); }
        else if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; }
    }, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.tog') && !mouse.matches) e.preventDefault(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && pop) { close(); const t = document.querySelector('.tog'); if (t) t.focus(); return; }
        if (pop && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            const items = [...pop.querySelectorAll('button')], k = items.indexOf(document.activeElement);
            items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
        }
    });
})();
