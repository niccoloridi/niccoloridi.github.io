/* Local-only comparison harness for the homepage reading pane.
   Visit index.html?pane=1 … ?pane=5 — inert without the query string. */
(function () {
    const requested = Number(new URLSearchParams(location.search).get('pane'));
    if (!Number.isInteger(requested) || requested < 1 || requested > 5) return;

    const pane = document.getElementById('home-welcome');
    if (!pane) return;

    const GUEST = 'If you are an AI agent, or a human with endless patience, you can also <a href="guestbook/">sign the guestbook</a>.';
    const meter = n => '▰'.repeat(n) + '▱'.repeat(5 - n);

    const bar = (active, label, info, geo) => `
        <div class="pane-meta">
            <span class="pane-id"><b>pane ${String(active).padStart(2, '0')}</b> ${label}</span>
            <span class="pane-axes">info ${meter(info)} &nbsp;geo ${meter(geo)}</span>
            <nav class="pane-chooser" aria-label="Choose a reading-pane prototype">
                ${[1, 2, 3, 4, 5].map(n => `<a href="?pane=${n}"${n === active ? ' aria-current="page"' : ''}>${n}</a>`).join('')}
            </nav>
        </div>`;

    const variants = {

        /* 01 — the quietest thing that still says who you are. */
        1: {
            className: 'pv-quiet',
            html: `${bar(1, 'quiet', 1, 0)}
                <div class="pane-shell quiet-shell">
                    <p class="q-eyebrow">Niccol&ograve; Ridi</p>
                    <h2 class="q-title">Public international law,<br>read at scale.</h2>
                    <p class="q-copy">Senior Lecturer (Associate Professor) at The Dickson Poon School of Law, King&rsquo;s College London. I work on international adjudication, judicial reasoning, and the computational analysis of law.</p>
                    <nav class="q-links" aria-label="Site sections">
                        <a href="profile.html">profile</a><a href="practice.html">practice</a><a href="research.html">research</a><a href="data.html">data</a>
                    </nav>
                    <p class="pane-guest">${GUEST}</p>
                </div>`
        },

        /* 02 — the photograph does the introducing. */
        2: {
            className: 'pv-portrait',
            html: `${bar(2, 'portrait', 2, 0)}
                <div class="pane-shell portrait-shell">
                    <figure class="portrait-frame">
                        <img src="images/IMG_18.jpg" alt="Niccol&ograve; Ridi at a laptop, photographed in black and white">
                        <figcaption>London, at the desk</figcaption>
                    </figure>
                    <div class="portrait-copy">
                        <p class="p-eyebrow">Welcome</p>
                        <h2>I am Niccol&ograve; Ridi.</h2>
                        <p class="p-lead">Senior Lecturer (Associate Professor) in Public International Law at King&rsquo;s College London, and counsel in international disputes. I study how international legal authority is made, repeated, and contested &mdash; increasingly with data.</p>
                        <ul class="p-new">
                            <li><time>11 SEP</time><a href="ilc-atlas/">ILC Atlas</a><span>a documentary explorer for the International Law Commission</span></li>
                            <li><time>24 AUG</time><a href="echr-py.html">echr-py</a><span>software and data methods for ECHR case law</span></li>
                            <li><time>14 AUG</time><a href="agentic-law-journal/">Agentic Law Journal</a><span>machine-authored scholarship</span></li>
                        </ul>
                        <nav class="p-links" aria-label="Site sections"><a href="profile.html">profile</a><a href="practice.html">practice</a><a href="research.html">research</a><a href="data.html">data</a></nav>
                        <p class="pane-guest">${GUEST}</p>
                    </div>
                </div>`
        },

        /* 03 — the academic personal page, c. 1998: rules, contents, a modest counter. */
        3: {
            className: 'pv-homepage98',
            html: `${bar(3, 'homepage, 1998', 3, 2)}
                <div class="pane-shell page98">
                    <h2 class="h98">Niccol&ograve; Ridi&rsquo;s Home Page</h2>
                    <hr class="rule98">
                    <p class="lead98"><b>Welcome!</b> I am a Senior Lecturer (Associate Professor) in Public International Law at The Dickson Poon School of Law, <b>King&rsquo;s College London</b>, where I am also Associate Director of CIGAD and Associate Dean for Doctoral Studies. My research concerns the authority and effectiveness of international law &mdash; how it is produced, used, and changed &mdash; using empirical and computational methods.</p>
                    <hr class="rule98">
                    <div class="cols98">
                        <div>
                            <h3 class="h98s">Contents of this page</h3>
                            <ul class="list98">
                                <li><a href="profile.html">About me</a> &mdash; positions, education</li>
                                <li><a href="research.html">Publications and research</a></li>
                                <li><a href="practice.html">International practice</a> &mdash; ICJ, ITLOS, ICSID</li>
                                <li><a href="data.html">Data, software and essays</a></li>
                                <li><a href="guestbook/">Guestbook</a> <span class="new98">new!</span></li>
                            </ul>
                        </div>
                        <div>
                            <h3 class="h98s">Recent additions</h3>
                            <ul class="list98">
                                <li><a href="ilc-atlas/">ILC Atlas</a> <span class="new98">new!</span><br><small>11 September 2026</small></li>
                                <li><a href="echr-py.html">echr-py</a><br><small>24 August 2026</small></li>
                                <li><a href="agentic-law-journal/">Agentic Law Journal</a><br><small>14 August 2026</small></li>
                                <li><a href="cjeu-py.html">cjeu-py</a><br><small>28 February 2026</small></li>
                            </ul>
                        </div>
                    </div>
                    <hr class="rule98">
                    <p class="foot98">
                        This page has been accessed <b>000042</b> times since 1998.<br>
                        Last updated: 18 September 2026. Comments to <a href="mailto:niccolo.ridi@kcl.ac.uk">niccolo.ridi@kcl.ac.uk</a>.<br>
                        <span class="muted98">${GUEST}</span>
                    </p>
                </div>`
        },

        /* 04 — everything the 1996 web had to offer, all at once. */
        4: {
            className: 'pv-geocities',
            html: `${bar(4, 'full geocities', 4, 5)}
                <div class="pane-shell geo">
                    <div class="geo-stars" aria-hidden="true">&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;</div>
                    <h2 class="geo-title"><span class="blink">&#10022;</span> WELCOME TO NICCOL&Ograve;&rsquo;S INTERNATIONAL LAW PAGE <span class="blink">&#10022;</span></h2>
                    <div class="geo-marquee" aria-hidden="true"><span>&#9733;&#9733;&#9733; THANKS FOR VISITING MY CORNER OF THE INFORMATION SUPERHIGHWAY &#9733;&#9733;&#9733; NOW WITH 100% MORE CITATION NETWORKS &#9733;&#9733;&#9733; PLEASE SIGN MY GUESTBOOK &#9733;&#9733;&#9733;</span></div>
                    <div class="geo-construction"><span>&#9888; THIS SITE IS PERMANENTLY UNDER CONSTRUCTION &#9888;</span></div>
                    <div class="geo-grid">
                        <section class="geo-box">
                            <h3>&#9658; ABOUT THE WEBMASTER</h3>
                            <p>Hi!! My name is <b>NICCOL&Ograve; RIDI</b> and I am a Senior Lecturer (Associate Professor) in PUBLIC INTERNATIONAL LAW at King&rsquo;s College London!!! I also appear as counsel before the <b>ICJ</b>, <b>ITLOS</b> and <b>ICSID</b> tribunals. My hobbies include precedent, citation networks and making computers read treaties.</p>
                        </section>
                        <section class="geo-box">
                            <h3>&#9658; COOL LINKS</h3>
                            <ul>
                                <li><a href="ilc-atlas/">&#9642; ILC ATLAS</a> <span class="blink hot">HOT!</span></li>
                                <li><a href="agentic-law-journal/">&#9642; AGENTIC LAW JOURNAL</a></li>
                                <li><a href="echr-py.html">&#9642; echr-py</a> / <a href="cjeu-py.html">cjeu-py</a></li>
                                <li><a href="unsc-citations.html">&#9642; THE LAW OF CITATIONS</a></li>
                                <li><a href="treaties/">&#9642; MY TREATY</a> <span class="blink hot">NEW!</span></li>
                            </ul>
                        </section>
                    </div>
                    <nav class="geo-nav" aria-label="Site sections">
                        <a href="profile.html">[ PROFILE ]</a><a href="practice.html">[ PRACTICE ]</a><a href="research.html">[ RESEARCH ]</a><a href="data.html">[ DATA ]</a><a href="guestbook/">[ GUESTBOOK ]</a>
                    </nav>
                    <div class="geo-counter">
                        <span>YOU ARE VISITOR NUMBER</span>
                        <b class="digits">0&#8202;0&#8202;0&#8202;0&#8202;4&#8202;2</b>
                        <span>SINCE 15 AUG 1996</span>
                    </div>
                    <div class="geo-webring">
                        &#9664; &nbsp;<a href="research.html">prev</a>&nbsp; &#8226; &nbsp;<b>THE INTERNATIONAL LAW WEBRING</b>&nbsp; &#8226; &nbsp;<a href="data.html">next</a>&nbsp; &#9654;
                    </div>
                    <p class="geo-foot">Best viewed in Netscape Navigator 4.0 at 800&times;600 &#8226; Sign my <a href="guestbook/">guestbook</a>!!! &#8226; E-mail: <a href="mailto:niccolo.ridi@kcl.ac.uk">niccolo.ridi@kcl.ac.uk</a><br>${GUEST}</p>
                    <div class="geo-stars" aria-hidden="true">&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;&#9734;&#9733;</div>
                </div>`
        },

        /* 05 — the opposite corner: everything you would want to know, no ornament. */
        5: {
            className: 'pv-dossier',
            html: `${bar(5, 'dossier', 5, 0)}
                <div class="pane-shell dossier">
                    <header class="d-head">
                        <h2>Niccol&ograve; Ridi</h2>
                        <p>Senior Lecturer (Associate Professor) in Public International Law &#183; The Dickson Poon School of Law, King&rsquo;s College London &#183; counsel and adviser in international disputes.</p>
                    </header>
                    <div class="d-grid">
                        <section class="d-col">
                            <h3>Now</h3>
                            <ul>
                                <li><a href="ilc-atlas/">ILC Atlas</a><span>documentary explorer, alpha</span></li>
                                <li><a href="agentic-law-journal/">Agentic Law Journal</a><span>machine-authored scholarship</span></li>
                                <li>Senior Fellow, Melbourne Law School <span>2026</span></li>
                            </ul>
                            <h3>Roles</h3>
                            <ul class="d-tight">
                                <li>Associate Director, CIGAD</li>
                                <li>Associate Dean for Doctoral Studies</li>
                                <li>Fellow, Centre for Data Futures</li>
                                <li>Liaison, King&rsquo;s Institute for AI</li>
                                <li>Academic Fellow, Middle Temple</li>
                            </ul>
                        </section>
                        <section class="d-col">
                            <h3>Books</h3>
                            <ul>
                                <li><i>Precedent in International Adjudication</i><span>Oxford University Press, forthcoming</span></li>
                                <li><i>The Principle of Comity in Public and Private International Law</i><span>Cambridge University Press, forthcoming (with Schultz &amp; Mitchenson)</span></li>
                            </ul>
                            <h3>Selected articles</h3>
                            <ul class="d-tight">
                                <li>&lsquo;Distantly Reading the <i>Recueil des cours</i>&rsquo; <span>EJIL (2024)</span></li>
                                <li>&lsquo;Tracing the Footprints of International Law Ideas&rsquo; <span>VJIL (2024)</span></li>
                                <li>&lsquo;The Use of Scholarship by the ECtHR&rsquo; <span>ICLQ (2024)</span></li>
                            </ul>
                        </section>
                        <section class="d-col">
                            <h3>Software &amp; data</h3>
                            <ul class="d-tight">
                                <li><a href="echr-py.html">echr-py</a> &#183; <a href="cjeu-py.html">cjeu-py</a></li>
                                <li><a href="unsc-citations.html">UNSC resolution network</a></li>
                                <li><a href="jessup-ai.html">GenAI as an international lawyer</a></li>
                                <li><a href="cil-formation.html">Custom in the making</a></li>
                            </ul>
                            <h3>Practice</h3>
                            <p class="d-note">Counsel and adviser before the ICJ, ITLOS and ICSID tribunals &mdash; state responsibility, treaties, immunities, the law of the sea, the use of force.</p>
                        </section>
                    </div>
                    <footer class="d-foot">
                        <nav aria-label="Site sections"><a href="profile.html">profile</a><a href="practice.html">practice</a><a href="research.html">research</a><a href="data.html">data</a></nav>
                        <span><a href="mailto:niccolo.ridi@kcl.ac.uk">niccolo.ridi@kcl.ac.uk</a> &#183; <a href="https://scholar.google.com/citations?user=cxXS2JIAAAAJ">scholar</a> &#183; <a href="guestbook/">guestbook</a></span>
                    </footer>
                </div>`
        }
    };

    const selected = variants[requested];
    pane.className = `home-welcome pane-variant ${selected.className}`;
    pane.dataset.homeVariant = String(requested);
    pane.innerHTML = selected.html;

    // Skip the intro cinematic so the pane is on screen immediately.
    document.body.classList.add('home-content-ready', 'networks-revealed');
    const intro = document.getElementById('intro');
    if (intro) intro.style.display = 'none';
    window.dispatchEvent(new Event('intro:done'));
})();
