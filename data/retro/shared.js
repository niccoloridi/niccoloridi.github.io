(() => {
    const RING = %%RING%%, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

    /* publications: two plain selects and a count */
    const pubs = $$('.pub-list > li'), ft = $('#ftype'), fy = $('#fyear'), fc = $('#fcount');
    [...new Set(pubs.map(li => li.dataset.year))].sort((a, b) => (b === 'forthcoming') - (a === 'forthcoming') || b - a).forEach(y => fy.add(new Option(y, y)));
    function filter() {
        let n = 0;
        pubs.forEach(li => { const ok = (ft.value === 'all' || li.dataset.type === ft.value) && (fy.value === 'all' || li.dataset.year === fy.value); li.hidden = !ok; n += ok; });
        fc.textContent = `${n} of ${pubs.length}`;
    }
    ft.addEventListener('change', filter); fy.addEventListener('change', filter); filter();

    /* the hit counter tells only the truth: how often this browser has been here */
    let visits = 0;
    try { visits = +localStorage.getItem('retro-visits') + 1; localStorage.setItem('retro-visits', visits); } catch (e) {}
    $$('[data-visits]').forEach(el => { if (visits) el.textContent = String(visits).padStart(el.dataset.visits, '0'); else el.closest('[data-visits-line]').hidden = true; });

    /* the webring: the data essays, in order, or one at random */
    $$('[data-ring]').forEach(a => {
        const d = a.dataset.ring;
        if (d === 'prev') a.href = RING[RING.length - 1][0];
        if (d === 'next') a.href = RING[0][0];
        if (d === 'random') a.addEventListener('click', e => { e.preventDefault(); location.href = RING[Math.floor(Math.random() * RING.length)][0]; });
    });
})();
