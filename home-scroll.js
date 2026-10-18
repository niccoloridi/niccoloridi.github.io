/* The homepage as one scrolling page (html.hn-scroll, set by index.html; desktop only).
   Below the cover the four sections are written out in full, each in its own frame, and the page scrolls
   like any other. The plates column stays put and follows the reading: the section whose frame has crossed
   a line a third of the way down the window is shown open, with the same switch as a click, and its name
   follows the small name in the bar. Clicking a plate scrolls to its section; the wordmark and the small
   name scroll back to the cover. Anything else that opens a section (keys 1 to 4, the console, the back
   button) scrolls to it as well. */
(function () {
    'use strict';
    const html = document.documentElement;
    if (!html.classList.contains('hn-scroll')) return;
    const shell = window.__hnShell;
    if (!shell) return;
    const desktop = window.matchMedia('(min-width: 881px)');
    const ORDER = ['profile', 'practice', 'research', 'data'];
    const hero = document.querySelector('main > .hero');
    const cols = hero && hero.querySelector(':scope > .hero-cols');
    const tilesNav = document.querySelector('main > .tiles');
    const header = document.querySelector('body > header');
    const headerActions = header && header.querySelector('.header-actions');
    const id = header && header.querySelector('.id');
    const footer = document.querySelector('body > footer');
    if (!hero || !cols || !tilesNav || !header || !headerActions || !id || !footer) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const crumb = document.createElement('span');
    crumb.className = 'hn-crumb';
    id.appendChild(crumb);
    const progress = document.createElement('div');
    progress.className = 'hn-progress';
    header.appendChild(progress);

    /* ─── the sections, written out ─── */
    const secs = document.createElement('div');
    secs.className = 'hn-secs';
    ORDER.forEach(s => {
        const v = shell.VIEW[s];
        const body = v.srcId ? (document.getElementById(v.srcId) || {}).innerHTML || '' : v.body;
        const el = document.createElement('section');
        el.className = 'hn-sec';
        el.id = 'sec-' + s;
        el.dataset.section = s;
        el.innerHTML = '<div class="stage"><div class="stage-text"><div class="stage-num">' + v.n + ' / ' + s + '</div>'
            + '<h2 class="stage-title">' + s + '</h2>' + body + '</div></div>';
        secs.appendChild(el);
    });
    hero.appendChild(secs);
    if (shell.initResearchFilters) shell.initResearchFilters(secs.querySelector('#sec-research'));
    const secEls = Array.from(secs.children);

    let on = false, scrolled = false, cur = null, driving = false, locked = false;

    /* ─── the cover keeps the size it has on the one-screen page ─── */
    function measure() {
        const was = on;
        html.classList.remove('hn-flow', 'hn-scrolled');
        html.style.setProperty('--hn-cover-h', cols.getBoundingClientRect().height + 'px');
        html.style.setProperty('--hn-tiles-h', tilesNav.getBoundingClientRect().height + 'px');
        html.style.setProperty('--hn-foot-h', footer.getBoundingClientRect().height + 'px');
        if (was) { html.classList.add('hn-flow'); html.classList.toggle('hn-scrolled', scrolled); }
        if (scrolled) html.style.setProperty('--hn-bar-h', header.getBoundingClientRect().height + 'px');
    }

    /* ─── the bar and the plates ─── */
    function controls() {
        return { launch: document.querySelector('.console-launch'), tog: document.querySelector('.tog'), group: document.querySelector('.hn-controls') };
    }
    function setBar(v) {
        scrolled = v;
        html.classList.toggle('hn-scrolled', v);
        const { launch, tog, group } = controls();
        if (v) {
            if (tog && tog.parentNode !== headerActions) headerActions.insertBefore(tog, headerActions.firstChild);
            if (launch && launch.parentNode !== headerActions) headerActions.insertBefore(launch, tog || headerActions.firstChild);
            // the bar's height with its buttons in it: the plates are pinned just under it
            html.style.setProperty('--hn-bar-h', header.getBoundingClientRect().height + 'px');
        } else if (group) {
            if (launch) group.appendChild(launch);
            if (tog) group.appendChild(tog);
        }
    }
    function setSection(s) {
        cur = s;
        document.body.classList.toggle('mode-section', !!s);
        let slot = 1;
        document.querySelectorAll('.tiles .tile').forEach(tile => {
            const active = tile.dataset.section === s;
            tile.classList.toggle('active', active);
            if (s && !active) tile.style.setProperty('--rail-slot', slot++); else tile.style.removeProperty('--rail-slot');
            if (active) tile.setAttribute('aria-current', 'true'); else tile.removeAttribute('aria-current');
        });
        crumb.innerHTML = s ? ' / <b>' + s + '</b>' : '';
        try { history.replaceState(history.state, '', location.pathname + location.search + (s ? '#' + s : '')); } catch (e) { /* ignore */ }
    }
    function apply(bar, s) {
        if (bar === scrolled && s === cur) return;
        driving = true;
        try {
            (window.hnFlip || (f => f()))(() => {
                if (bar !== scrolled) setBar(bar);
                if (s !== cur) setSection(s);
            });
        } finally { driving = false; }
    }

    /* ─── reading the scroll ─── */
    function sectionAt() {
        const line = innerHeight * 0.36;
        let s = null;
        secEls.forEach(el => { if (el.getBoundingClientRect().top <= line) s = el.dataset.section; });
        // at the foot of the page the last section is the one being read, however short it is
        if (s && window.scrollY >= document.documentElement.scrollHeight - innerHeight - 2) s = secEls[secEls.length - 1].dataset.section;
        return s;
    }
    function update() {
        if (!on) return;
        const y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        progress.style.setProperty('--hn-progress', (y / max).toFixed(4));
        if (locked) return;
        apply(y > 6, sectionAt());
    }
    let queued = false;
    window.addEventListener('scroll', () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
    }, { passive: true });

    /* a jump: the target's state at once, then a smooth scroll that does not switch the plates on its way */
    function goTo(s, instant) {
        apply(!!s, s);
        // measured once the bar is in: its height sets where the section's frame comes to rest
        const bar = parseFloat(getComputedStyle(html).getPropertyValue('--hn-bar-h')) || header.getBoundingClientRect().height || 48;
        const top = s ? Math.max(0, Math.round(window.scrollY + secs.querySelector('#sec-' + s).getBoundingClientRect().top - bar - 14)) : 0;
        locked = true;
        // a smooth scroll can be cut short (a field taking focus, say): it then ends with a jump to the target
        const release = () => {
            if (!locked) return;
            if (Math.abs(window.scrollY - top) > 30) window.scrollTo({ top, behavior: 'instant' });
            locked = false; update();
        };
        if ('onscrollend' in window) window.addEventListener('scrollend', release, { once: true });
        setTimeout(() => { if (locked) release(); }, 1200);
        window.scrollTo({ top, behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        if (Math.abs(window.scrollY - top) < 2) release();
    }
    document.querySelectorAll('.tiles .tile').forEach(a => a.addEventListener('click', e => {
        if (!on || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const s = a.dataset.section;
        if (s === cur && document.body.classList.contains('mode-section')) return;   // the open plate's own click shows its photograph
        e.preventDefault(); e.stopImmediatePropagation();
        goTo(s);
    }, true));
    document.addEventListener('click', e => {
        if (!on) return;
        const el = e.target.closest && e.target.closest('header .id, .wordmark-home');
        if (!el) return;
        e.preventDefault(); e.stopImmediatePropagation();
        goTo(null);
    }, true);

    /* anything else that opens or closes a section scrolls to it */
    new MutationObserver(() => {
        if (driving || !on) return;
        const open = document.body.classList.contains('mode-section');
        const active = document.querySelector('.tiles .tile.active');
        const s = open && active ? active.dataset.section : null;
        if (s === cur) return;
        cur = undefined;   // let goTo apply the state again
        goTo(s);
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    function start() {
        if (on || !desktop.matches) return;
        measure();
        on = true;
        html.classList.add('hn-flow');
        const open = document.body.classList.contains('mode-section');
        const active = document.querySelector('.tiles .tile.active');
        const s = open && active ? active.dataset.section : null;
        cur = s; scrolled = false;
        // a page opened on a section (#research) starts there, without a scroll down from the cover
        if (s) { cur = undefined; goTo(s, true); } else { window.scrollTo(0, 0); update(); }
    }
    window.addEventListener('intro:done', () => setTimeout(start, 60), { once: true });
    window.addEventListener('load', () => setTimeout(() => {
        const intro = document.getElementById('intro');
        if (!intro || getComputedStyle(intro).display === 'none') start();
    }, 200), { once: true });
    window.addEventListener('resize', () => { if (on) { measure(); update(); } });
    desktop.addEventListener('change', () => location.reload());
})();
