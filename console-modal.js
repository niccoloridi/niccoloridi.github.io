/* The site console: a window centred over a dimmed page, opened from the reading
   pane and closed by anything else. Desktop only — below 881px the terminal keeps
   its stacked, in-flow layout and its own console toggle. */
(function () {
    const DESKTOP = '(min-width: 881px)';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    }

    ready(function () {
        const body = document.body;
        const term = document.getElementById('terminal');
        const panel = document.getElementById('net-panel');
        const heroCols = document.querySelector('.hero-cols');
        const bar = term && term.querySelector('.term-bar');
        const input = document.getElementById('term-input');
        const log = document.getElementById('term-body');
        if (!term || !panel || !heroCols || !bar) return;

        const mq = window.matchMedia(DESKTOP);

        const scrim = document.createElement('div');
        scrim.className = 'console-scrim';
        scrim.addEventListener('click', close);

        const launch = document.createElement('button');
        launch.type = 'button';
        launch.className = 'console-launch';
        launch.setAttribute('aria-controls', 'terminal');
        launch.setAttribute('aria-expanded', 'false');
        launch.setAttribute('aria-label', 'Open console');
        launch.innerHTML = '<span aria-hidden="true">&gt;_</span><span>console</span>';
        launch.addEventListener('click', e => { e.stopPropagation(); toggle(); });
        panel.appendChild(launch);

        const closer = document.createElement('button');
        closer.type = 'button';
        closer.className = 'console-closer';
        closer.setAttribute('aria-label', 'Close console');
        closer.innerHTML = '<span aria-hidden="true">&gt;_</span><span>close</span>';
        closer.addEventListener('click', e => { e.stopPropagation(); close(); });
        bar.appendChild(closer);

        let openSeq = 0;

        function open() {
            if (!mq.matches) return;
            openSeq++;
            body.classList.add('console-open');
            body.classList.remove('console-unread');
            launch.setAttribute('aria-expanded', 'true');
            if (input) setTimeout(() => input.focus(), 240);
        }
        function close() {
            body.classList.remove('console-open');
            launch.setAttribute('aria-expanded', 'false');
            if (input && document.activeElement === input) input.blur();
        }
        function toggle() { body.classList.contains('console-open') ? close() : open(); }

        /* The centred window hosts on <body>: the reading panel sets a containment
           context, which would otherwise trap position: fixed inside it. On narrow
           screens the terminal goes back where it came from. */
        function applyMode() {
            if (mq.matches) {
                body.classList.add('console-modal');
                if (term.parentElement !== body) { body.appendChild(scrim); body.appendChild(term); }
            } else {
                close();
                body.classList.remove('console-modal');
                if (term.parentElement === body) {
                    heroCols.insertBefore(term, panel);
                    if (scrim.parentElement) scrim.remove();
                }
            }
        }
        applyMode();
        mq.addEventListener('change', applyMode);

        /* The tiles' right-hand rail is driven by .terminal-folded, so it is held on:
           opening the console can then never reflow the generative plates. */
        let onSection = body.classList.contains('mode-section');
        const watchBody = () => {
            if (!body.classList.contains('terminal-folded')) body.classList.add('terminal-folded');
            // a command that opened a section has done its job; let the console get out of the way
            const now = body.classList.contains('mode-section');
            if (now && !onSection && body.classList.contains('console-open')) {
                const seq = openSeq;
                setTimeout(() => { if (seq === openSeq) close(); }, 900);
            }
            onSection = now;
        };
        new MutationObserver(watchBody).observe(body, { attributes: true, attributeFilter: ['class'] });
        watchBody();

        const redDot = term.querySelector('.terminal-close-dot');
        if (redDot) redDot.addEventListener('click', close);

        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        /* A click anywhere but the console itself puts it away. Nothing here opens it:
           tiles, chips and links autotype into the transcript without summoning the
           window, so cycling through sections never makes it appear. */
        document.addEventListener('click', e => {
            if (!body.classList.contains('console-open')) return;
            if (e.target.closest('#terminal, .console-launch')) return;
            close();
        });

        // an unread marker while the console is shut and the transcript is still writing
        if (log) new MutationObserver(() => {
            if (!body.classList.contains('console-open')) body.classList.add('console-unread');
        }).observe(log, { childList: true });
    });
})();
