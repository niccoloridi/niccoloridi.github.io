/* The jukebox: three original tunes as note lists, played by a small Web Audio synth in the manner of an old sound card.
   It also reads standard .mid files: a visitor can load one from their own computer, and any file the site may
   lawfully host can be listed in MIDI_FILES as { name, url }. Nothing plays until it is asked to. */
(() => {
    const M = n => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); return 12 * (+m[3] + 1) + 'C D EF G A B'.indexOf(m[1]) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
    const CH = { D: 'D3 F#3 A3', Bm: 'B2 D3 F#3', G: 'G2 B2 D3', A: 'A2 C#3 E3', Em: 'E3 G3 B3', 'F#m': 'F#2 A2 C#3', F: 'F3 A3 C4', Dm: 'D3 F3 A3', Bb: 'Bb2 D3 F3', C: 'C3 E3 G3', Am: 'A2 C3 E3', Gm: 'G2 Bb2 D3' };
    const TUNES = [
        { name: 'Harbour Lights', bpm: 92, beat: 8, style: 'lilt', swing: .12,
          chords: 'D Bm G A D Bm Em A G A F#m Bm G A D D',
          tune: 'F#5:3 A5:1 A5:2 F#5:2 F#5:2 D5:2 B4:4 G4:2 B4:2 D5:3 E5:1 E5:2 C#5:2 A4:4 A4:1 D5:1 F#5:2 A5:3 B5:1 A5:2 F#5:2 D5:2 F#5:2 G5:3 F#5:1 E5:2 B4:2 C#5:2 E5:2 A4:2 -:2 B5:3 A5:1 G5:4 A5:3 G5:1 E5:4 F#5:2 A5:2 C#6:3 A5:1 B5:6 -:2 G5:2 B5:2 D6:2 B5:2 C#6:2 A5:2 E5:2 C#5:2 D5:3 F#5:1 A5:4 D5:6 -:2' },
        { name: 'Low Tide Waltz', bpm: 138, beat: 6, style: 'waltz', swing: 0,
          chords: 'F Dm Bb C F Am Bb C Dm Am Bb F Gm C F F',
          tune: 'C5:2 F5:2 A5:2 A5:3 G5:1 F5:2 D5:2 F5:2 Bb5:2 G5:4 E5:2 F5:2 A5:2 C6:2 C6:3 A5:1 E5:2 F5:2 D5:2 Bb4:2 C5:6 D5:2 F5:2 A5:2 E5:2 A5:2 C6:2 Bb5:3 A5:1 G5:2 A5:4 F5:2 G5:2 Bb5:2 D6:2 C6:2 G5:2 E5:2 F5:6 -:6' },
        { name: 'The Quay at Night', bpm: 100, beat: 8, style: 'lilt', swing: .16,
          chords: 'Em A Em A C D Em Em',
          tune: 'E5:2 G5:1 A5:1 B5:4 A5:2 C#6:2 B5:1 A5:3 G5:2 E5:2 B4:4 C#5:2 E5:2 A5:4 G5:2 E5:1 G5:1 C6:4 A5:2 F#5:1 A5:1 D6:4 B5:2 G5:2 E5:2 G5:2 E5:6 -:2' },
    ];
    TUNES.forEach(t => {
        t.seq = []; let at = 0;
        t.tune.split(' ').forEach(tok => { const [n, l] = tok.split(':'); if (n !== '-') t.seq.push([at, M(n), +l]); at += +l; });
        t.bars = t.chords.split(' ').map(c => CH[c].split(' ').map(M));
        t.steps = t.bars.length * t.beat;
        if (at !== t.steps) console.warn('tune length', t.name, at, t.steps);
    });
    const MIDI_FILES = [];
    TUNES.push(...MIDI_FILES);

    function parseMidi(buf) {
        const d = new DataView(buf); let p = 0;
        const u8 = () => d.getUint8(p++), u16 = () => { p += 2; return d.getUint16(p - 2); }, u32 = () => { p += 4; return d.getUint32(p - 4); };
        const vlq = () => { let v = 0, b; do { b = u8(); v = v * 128 + (b & 127); } while (b & 128); return v; };
        if (u32() !== 0x4d546864) throw new Error('not a MIDI file');
        p = 10; const tracks = u16(), div = u16();
        const tempos = [[0, 500000]], ev = [];
        for (let k = 0; k < tracks; k++) {
            u32(); const end = u32() + p; let tick = 0, st = 0;
            while (p < end) {
                tick += vlq();
                if (d.getUint8(p) & 128) st = u8();
                if (st === 255) { const type = u8(), l = vlq(); if (type === 81) tempos.push([tick, d.getUint8(p) * 65536 + d.getUint8(p + 1) * 256 + d.getUint8(p + 2)]); p += l; }
                else if (st === 240 || st === 247) p += vlq();
                else { const hi = st & 240, a = u8(), b = hi === 192 || hi === 208 ? 0 : u8(); ev.push([tick, hi, st & 15, a, b]); }
            }
            p = end;
        }
        tempos.sort((a, b) => a[0] - b[0]); ev.sort((a, b) => a[0] - b[0]);
        const secs = t => { let s = 0, last = 0, us = 500000; for (const [tk, u] of tempos) { if (tk >= t) break; s += (tk - last) * us; last = tk; us = u; } return (s + (t - last) * us) / div / 1e6; };
        const notes = [], open = {}, prog = new Array(16).fill(0);
        ev.forEach(([tick, hi, ch, a, b]) => {
            if (hi === 192) prog[ch] = a;
            const key = ch * 128 + a;
            if (hi === 144 && b) { (open[key] = open[key] || []).push(notes.length); notes.push([secs(tick), ch, a, b, .25, prog[ch]]); }
            else if ((hi === 128 || hi === 144) && open[key] && open[key].length) { const n = notes[open[key].shift()]; n[4] = Math.max(.05, secs(tick) - n[0]); }
        });
        return notes.sort((x, y) => x[0] - y[0]);
    }
    const hz = m => 440 * 2 ** ((m - 69) / 12);

    function tone(ac, out, type, m, t, len, vol, cut) {
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = type; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = cut;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(vol * .55, t + len * .5); g.gain.exponentialRampToValueAtTime(.0008, t + len);
        o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + len + .02);
    }
    function tick(ac, out, t) {
        const n = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(), b = ac.createBuffer(1, 1400, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
        n.buffer = b; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = .035; n.connect(f); f.connect(g); g.connect(out); n.start(t);
    }
    /* one step of a tune, an eighth note */
    function step(ac, out, T, s, t, dur) {
        const i = s % T.steps, bar = Math.floor(i / T.beat), inBar = i % T.beat, ch = T.bars[bar];
        T.seq.filter(n => n[0] === i).forEach(n => tone(ac, out, 'square', n[1], t, n[2] * dur * 1.1, .085, 2100));
        if (T.style === 'lilt') {
            if (inBar === 0) tone(ac, out, 'triangle', ch[0] - 12, t, dur * 2.6, .3, 700);
            if (inBar === 4) tone(ac, out, 'triangle', ch[2] - 12, t, dur * 2.2, .24, 700);
            if (inBar === 7) tone(ac, out, 'triangle', ch[0] - 12, t, dur * .9, .2, 700);
            if (inBar % 2 === 1) ch.forEach(m => tone(ac, out, 'sawtooth', m + 12, t, dur * .55, .032, 1500));
            tick(ac, out, t);
        } else {
            if (inBar === 0) tone(ac, out, 'triangle', ch[0] - 12, t, dur * 5, .28, 600);
            if (inBar > 1) tone(ac, out, 'triangle', ch[(inBar - 2) % 3] + 12, t, dur * 1.8, .07, 1600);
        }
    }

    const $ = id => document.getElementById(id);
    let ac, master, timer, at = 0, s = 0, next = 0, base = 0, idx = 0, playing = false;
    const name = $('jname'), play = $('jplay'), vol = $('jvol'), quick = $('jquick'), box = $('juke');
    function label() {
        name.textContent = TUNES[at].name;
        if (play) { play.textContent = playing ? '❚❚' : '▶'; play.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
        if (quick) { quick.textContent = playing ? '♪ on' : '♪'; quick.setAttribute('aria-pressed', playing); }
        if (box) box.classList.toggle('on', playing);
    }
    function pump() {
        const T = TUNES[at];
        if (T.url && !T.notes) return;
        if (T.notes) {
            while (idx < T.notes.length && base + T.notes[idx][0] < ac.currentTime + .25) {
                const [t, ch, m, v, len, pr] = T.notes[idx++], w = Math.max(ac.currentTime, base + t), g = .1 * v / 127;
                if (ch === 9) tick(ac, master, w);
                else tone(ac, master, pr >= 32 && pr < 40 ? 'triangle' : pr < 32 ? 'triangle' : pr < 80 ? 'sawtooth' : 'square', m, w, Math.min(len, 3), g, 2400);
            }
            if (idx >= T.notes.length && ac.currentTime > base + T.notes[T.notes.length - 1][0] + 2) skip();
            return;
        }
        const d = 60 / T.bpm / 2;
        while (next < ac.currentTime + .25) {
            step(ac, master, T, s, next + (s % 2 ? d * T.swing : 0), d);
            next += d; s++;
        }
    }
    function start() {
        if (!ac) {
            ac = new (window.AudioContext || window.webkitAudioContext)();
            const c = ac.createDynamicsCompressor(); master = ac.createGain(); master.gain.value = vol ? +vol.value : .5; master.connect(c); c.connect(ac.destination);
        }
        ac.resume(); next = ac.currentTime + .08; if (TUNES[at].notes && !idx) base = next; playing = true; fetchTune(); timer = setInterval(pump, 60); pump(); label();
    }
    function stop() { playing = false; clearInterval(timer); if (ac) ac.suspend(); label(); }
    const toggle = () => (playing ? stop() : start());
    if (play) play.addEventListener('click', toggle);
    if (quick) quick.addEventListener('click', toggle);
    function fetchTune() {
        const T = TUNES[at];
        if (T.url && !T.notes) fetch(T.url).then(r => r.arrayBuffer()).then(b => { T.notes = parseMidi(b); idx = 0; if (ac) base = ac.currentTime + .08; }).catch(() => skip(1));
    }
    function begin() { s = 0; idx = 0; if (ac) { next = base = ac.currentTime + .08; } fetchTune(); label(); }
    function skip(d = 1) { at = (at + d + TUNES.length) % TUNES.length; begin(); }
    /* move within the tune: four bars of the built-in tunes, ten seconds of a .mid file */
    function seek(d) {
        const T = TUNES[at];
        if (T.notes && ac) {
            base = Math.min(base - d * 10, ac.currentTime);
            idx = 0; while (idx < T.notes.length && base + T.notes[idx][0] < ac.currentTime) idx++;
        } else if (T.bars) s = Math.max(0, s + d * T.beat * 4);
    }
    if ($('jnext')) $('jnext').addEventListener('click', () => skip(1));
    if ($('jprev')) $('jprev').addEventListener('click', () => skip(-1));
    if ($('jfwd')) $('jfwd').addEventListener('click', () => seek(1));
    if ($('jback')) $('jback').addEventListener('click', () => seek(-1));
    if ($('jfile')) $('jfile').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        f.arrayBuffer().then(b => {
            const notes = parseMidi(b);
            if (!notes.length) throw new Error('empty');
            TUNES.push({ name: f.name.replace(/\.midi?$/i, ''), notes }); at = TUNES.length - 1; begin(); if (!playing) start();
        }).catch(() => { name.textContent = 'That file would not play'; });
    });
    if (vol) vol.addEventListener('input', () => { if (master) master.gain.value = +vol.value; });
    addEventListener('pagehide', () => { if (playing) stop(); });
    label();
    window.__juke = { TUNES, step, parseMidi, get at() { return at; }, get s() { return s; }, get playing() { return playing; } };
})();
