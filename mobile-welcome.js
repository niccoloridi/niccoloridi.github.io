/* On narrow screens the reading pane lives inside the console drawer, which is shut
   by default — so the welcome paragraph and the photograph would never be seen.
   Below 881px they are moved into a strip above the four tiles; above it they go
   back into the pane. The elements move rather than being copied, so the writeup
   exists once. */
(function () {
    const mq = window.matchMedia('(max-width: 880px)');

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    }

    ready(function () {
        const pane = document.getElementById('home-welcome');
        const intro = pane && pane.querySelector('.welcome-intro');
        const figure = pane && pane.querySelector('.welcome-portrait');
        const list = pane && pane.querySelector('.site-changelog');
        const tiles = document.querySelector('main > .tiles');
        if (!pane || !intro || !figure || !list || !tiles) return;

        const strip = document.createElement('section');
        strip.className = 'mobile-welcome';
        strip.setAttribute('aria-label', 'Welcome');
        tiles.parentNode.insertBefore(strip, tiles);

        function apply() {
            if (mq.matches) {
                strip.append(intro, figure);
            } else if (figure.parentNode !== pane) {
                pane.insertBefore(figure, pane.firstChild);
                pane.insertBefore(intro, list);
            }
        }
        apply();
        mq.addEventListener('change', apply);

    });
})();
