/* Terminal placement tests (?term=a|b|c) — inert without the query string.
   a: corner button that opens a floating window over the reading pane
   b: thin bar across the top of the reading pane that drops down
   c: live prompt docked at the foot of the reading pane; the transcript rises
   All three keep body.terminal-folded, so the generative tiles never reflow. */
(function () {
    const which = (new URLSearchParams(location.search).get('term') || '').toLowerCase();
    if (!['a', 'b', 'c'].includes(which)) return;

    const LABELS = {
        a: 'corner button → floating window',
        b: 'top bar → drops down',
        c: 'bottom prompt → transcript rises'
    };

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
        else fn();
    }

    ready(function () {
        const body = document.body;
        const term = document.getElementById('terminal');
        const panel = document.getElementById('net-panel');
        const pane = document.getElementById('home-welcome');
        const input = document.getElementById('term-input');
        const log = document.getElementById('term-body');
        if (!term || !panel) return;

        body.classList.add('tlx', 'tlx-' + which);

        const chooser = document.createElement('nav');
        chooser.className = 'tlx-chooser';
        chooser.setAttribute('aria-label', 'Terminal placement tests');
        chooser.innerHTML = '<span>console</span>'
            + ['a', 'b', 'c'].map(k => `<a href="?term=${k}"${k === which ? ' aria-current="page"' : ''}>${k}</a>`).join('')
            + '<a class="tlx-plain" href="index.html">current</a>'
            + `<em>${LABELS[which]}</em>`;
        body.appendChild(chooser);

        /* The tiles' right-hand rail is driven by .terminal-folded. Holding it on means
           opening the console can never reflow the generative plates. */
        let openSeq = 0;
        let onSection = body.classList.contains('mode-section');
        const watchBody = () => {
            if (!body.classList.contains('terminal-folded')) body.classList.add('terminal-folded');
            // a command that opens a section has done its job; let the console get out of the way
            const now = body.classList.contains('mode-section');
            if (now && !onSection && body.classList.contains('tlx-open')) {
                const seq = openSeq;
                setTimeout(() => { if (seq === openSeq) close(); }, 900);
            }
            onSection = now;
        };
        new MutationObserver(watchBody).observe(body, { attributes: true, attributeFilter: ['class'] });
        watchBody();

        /* Skip the intro cinematic so a test lands straight on the homepage; add
           &intro=1 to watch the intro hand over to the new console placement. */
        if (!new URLSearchParams(location.search).has('intro')) {
            const intro = document.getElementById('intro');
            if (intro) intro.style.display = 'none';
            body.classList.add('home-content-ready', 'networks-revealed');
            window.addEventListener('load', () => window.dispatchEvent(new Event('intro:done')), { once: true });
        }

        if (!window.matchMedia('(min-width: 881px)').matches) return;   // mobile keeps the stock stacked layout

        /* a centres the console over the whole page, so it hosts on <body>; the panel
           sets a containment context, which would otherwise trap position: fixed. */
        const host = which === 'a' ? document.body : panel;
        host.appendChild(term);

        const scrim = document.createElement('div');
        scrim.className = 'tlx-scrim';
        host.insertBefore(scrim, term);

        function open() {
            openSeq++;
            body.classList.add('tlx-open');
            body.classList.remove('tlx-activity');
            if (input) setTimeout(() => input.focus(), 240);
        }
        function close() {
            body.classList.remove('tlx-open');
            if (input && document.activeElement === input) input.blur();
        }
        function toggle() { body.classList.contains('tlx-open') ? close() : open(); }

        scrim.addEventListener('click', close);

        let launch = null;
        if (which === 'a') {
            launch = document.createElement('button');
            launch.type = 'button';
            launch.className = 'tlx-launch';
            launch.setAttribute('aria-controls', 'terminal');
            launch.innerHTML = '<span class="tlx-caret" aria-hidden="true">&gt;_</span><span class="tlx-word">console</span>';
            launch.addEventListener('click', e => { e.stopPropagation(); toggle(); });
            panel.appendChild(launch);

            const closer = document.createElement('button');
            closer.type = 'button';
            closer.className = 'tlx-launch tlx-closer';
            closer.setAttribute('aria-label', 'Close terminal');
            closer.innerHTML = '<span class="tlx-caret" aria-hidden="true">&gt;_</span><span class="tlx-word">close</span>';
            closer.addEventListener('click', e => { e.stopPropagation(); close(); });
            term.querySelector('.term-bar').appendChild(closer);
        } else {
            const chev = document.createElement('button');
            chev.type = 'button';
            chev.className = 'tlx-chevron';
            chev.setAttribute('aria-label', 'Toggle console');
            chev.innerHTML = '<span aria-hidden="true"></span>';   // arrow drawn in CSS
            chev.addEventListener('click', e => { e.stopPropagation(); toggle(); });

            if (which === 'b') {
                const bar = term.querySelector('.term-bar');
                const hint = document.createElement('span');
                hint.className = 'tlx-hint';
                hint.textContent = 'niccolo@website:~$  type a command';
                bar.insertBefore(hint, bar.querySelector('.ttl'));
                bar.appendChild(chev);
                bar.addEventListener('click', e => {
                    if (e.target.closest('.terminal-close-dot, .tlx-chevron')) return;
                    toggle();
                });
            } else {
                term.appendChild(chev);
            }
        }

        /* In test c the prompt stays live while the transcript is rolled up, so a
           command submitted from the closed state unrolls it to show the answer. */
        if (input) {
            if (which === 'c') input.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
            else if (which === 'b') input.addEventListener('focus', open);
        }

        const redDot = term.querySelector('.terminal-close-dot');
        if (redDot) redDot.addEventListener('click', close);

        document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        /* A click anywhere but the console itself puts it away. Nothing here opens it:
           tiles, chips and links autotype into the transcript without summoning the
           window, so cycling through sections never makes it appear. */
        document.addEventListener('click', e => {
            if (!body.classList.contains('tlx-open')) return;
            if (e.target.closest('#terminal, .tlx-launch, .tlx-chevron')) return;
            close();
        });

        // an unread marker while the console is rolled up
        if (log) new MutationObserver(() => {
            if (!body.classList.contains('tlx-open')) body.classList.add('tlx-activity');
        }).observe(log, { childList: true });

        /* &open=1 renders the unrolled state synchronously, with a stand-in transcript,
           so a headless capture shows the console as it looks in use. Capture aid only —
           the live page fills this in itself from the boot sequence. */
        if (new URLSearchParams(location.search).has('open')) {
            if (log) {
                const line = html => `<div class="ln" data-tlx-capture>${html}</div>`;
                log.insertAdjacentHTML('beforeend',
                    line('<span class="p">niccolo@website:~$</span> whoami')
                    + line('Dr Niccol\u00f2 Ridi \u2014 academic &amp; practitioner in <span class="gold">public international law</span>.')
                    + line('<span class="muted">international dispute resolution \u00b7 computational analysis of law</span>')
                    + line('<span class="p">niccolo@website:~$</span> man')
                    + line('<span class="muted">sections </span><span class="chip">profile/</span>   <span class="chip">practice/</span>   <span class="chip">research/</span>   <span class="chip">data/</span>')
                    + line('<span class="muted">try </span><span class="chip">about</span><span class="muted">, </span><span class="chip">contact</span><span class="muted">, or </span><span class="gold">\u21b9 Tab</span><span class="muted"> to complete</span>'));
            }
            body.classList.add('tlx-open');
        }

        window.__tlxTest = which;
        window.__tlxOpen = open;
        window.__tlxClose = close;
    });
})();
