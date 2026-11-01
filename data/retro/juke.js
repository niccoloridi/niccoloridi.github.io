/* The Secret of Monkey Island, in the supplied game order. Audio starts only on Play.
   MIDI events retain their tempo map, programs, percussion and controllers; TinySynth
   supplies the General MIDI voices locally, without samples or a third-party service. */
(() => {
    const MIDI_FILES = [
        ['Introduction and Opening Themes', '01 Introduction and Opening Themes.mid'],
        ['Mêlée Island', '02 Melee Island.mid'],
        ['Scumm Bar', '03 Scumm Bar.mid'],
        ['Mêlée Forest Loop', '04 Melee Forest Loop.mid'],
        ['Mêlée Island Fork', '05 Melee Island Fork.mid'],
        ['The Voodoo Shop', '06 The Voodoo Shop.mid'],
        ['The Fabulous Fettucini Brothers', '07 The Fabulous Fettucini Brothers.mid'],
        ["Stan's Theme", "08 Stan's Theme.mid"],
        ['Following the Shop Keeper', '09 Following the Shop Keeper.mid'],
        ['The Journey', '10 The Journey.mid'],
        ['Monkey Island', '11 Monkey Island.mid'],
        ['Ghost Ship Shuffle', '12 Ghost Ship Shuffle.mid'],
        ['LeChuck', '13 LeChuck.mid'],
        ['The Carnival', '14 The Carnival.mid'],
        ['Organ Prelude', '15 Organ Prelude.mid'],
        ['Closing Themes', '16 Closing Themes.mid'],
    ].map(([name, file]) => ({ name, url: '/retro/midi/' + encodeURIComponent(file) }));

    // Read format 0/1 SMF files, including running status and tempo changes on any track.
    // Bounds checks also turn a missing file / HTML response into a visible player error.
    function parseMidi(buffer) {
        const d = new DataView(buffer), events = [], text = [];
        let p = 0, limit = d.byteLength, endTick = 0, noteCount = 0;
        const fail = () => { throw new Error('Invalid or unsupported MIDI file'); };
        const u8 = () => { if (p >= limit) fail(); return d.getUint8(p++); };
        const u16 = () => u8() * 256 + u8();
        const u32 = () => u16() * 65536 + u16();
        const vlq = () => {
            let value = 0;
            for (let i = 0; i < 4; i++) {
                const b = u8(); value = value * 128 + (b & 127);
                if (!(b & 128)) return value;
            }
            fail();
        };
        if (u32() !== 0x4d546864) fail();
        const header = u32(), format = u16(), tracks = u16(), division = u16();
        if (header < 6 || header + 8 > limit || format > 1 || !tracks || !division || division & 0x8000) fail();
        p = header + 8;
        for (let k = 0; k < tracks; k++) {
            limit = d.byteLength;
            if (u32() !== 0x4d54726b) fail();
            const size = u32(), end = p + size;
            if (end > limit) fail();
            limit = end;
            let tick = 0, running = 0;
            while (p < end) {
                tick += vlq();
                let status = u8(), first;
                if (status < 128) { if (!running) fail(); first = status; status = running; }
                if (status === 255 || status === 240 || status === 247) {
                    running = 0;
                    const type = status === 255 ? u8() : null, length = vlq(), finish = p + length;
                    if (finish > end) fail();
                    if (type === 81) {
                        if (length !== 3) fail();
                        const tempo = u8() * 65536 + u16();
                        if (!tempo) fail();
                        events.push({ tick, tempo });
                    } else if (type >= 1 && type <= 7) {
                        text.push(new TextDecoder('windows-1252').decode(new Uint8Array(buffer, p, length)).trim());
                    } else if (status === 240) {
                        events.push({ tick, message: [240, ...new Uint8Array(buffer, p, length)] });
                    }
                    p = finish;
                    if (type === 47) break;
                } else {
                    if (status < 128 || status >= 240) fail();
                    running = status;
                    const hi = status & 240, a = first === undefined ? u8() : first;
                    const message = [status, a];
                    if (hi !== 192 && hi !== 208) message.push(u8());
                    if (message.slice(1).some(b => b > 127)) fail();
                    if (hi === 144 && message[2]) noteCount++;
                    events.push({ tick, message });
                }
            }
            endTick = Math.max(endTick, tick); p = end;
        }
        if (!noteCount) fail();
        events.sort((a, b) => a.tick - b.tick);
        let seconds = 0, last = 0, tempo = 500000;
        const timeline = [];
        for (const event of events) {
            seconds += (event.tick - last) * tempo / division / 1e6; last = event.tick;
            if (event.tempo) tempo = event.tempo;
            else timeline.push({ time: seconds, message: event.message });
        }
        const duration = seconds + (endTick - last) * tempo / division / 1e6;
        return { events: timeline, duration, noteCount, text };
    }

    const $ = id => document.getElementById(id);
    const name = $('jname'), play = $('jplay'), volume = $('jvol'), list = $('jtracks');
    const status = $('jstatus'), time = $('jtime'), box = $('juke');
    if (!box) return;
    let synth, ac, timer, song, at = 0, cursor = 0, base = 0, offset = 0;
    let playing = false, loading = false, needsReset = true, request = 0, error = '';
    const cache = new Map();
    const clock = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
    const position = () => song ? Math.max(0, Math.min(song.duration,
        playing && !needsReset ? ac.currentTime - base : offset)) : 0;
    const write = (element, value) => { if (element.textContent !== value) element.textContent = value; };
    function label() {
        write(name, MIDI_FILES[at].name);
        if (list.value !== String(at)) list.value = String(at);
        write(play, playing ? '❚❚' : '▶');
        const action = playing ? 'Pause' : 'Play';
        if (play.getAttribute('aria-label') !== action) play.setAttribute('aria-label', action);
        box.classList.toggle('on', playing && !loading);
        if (box.getAttribute('aria-busy') !== String(loading)) box.setAttribute('aria-busy', String(loading));
        const message = error || (loading ? 'Loading music…' : playing ? 'Playing · continues in order' : 'Press play for a little adventure.');
        write(status, message);
        write(time, `${clock(position())} / ${song ? clock(song.duration) : '–:––'}`);
        $('jback').disabled = $('jfwd').disabled = !song;
    }
    function silence() {
        if (!synth) return;
        // A fresh output graph also cuts percussion tails and queued controller changes.
        synth.reset();
        synth.out.disconnect(); synth.comp.disconnect(); synth.lfo.stop();
        synth.setMasterVol(0);
        synth.setAudioContext(ac);
        if (!playing) ac.suspend().catch(() => {});
    }
    function prepare() {
        if (!song || !ac || !playing) return;
        cursor = 0;
        // Restore instrument/controller state at the seek point, without replaying notes.
        for (; cursor < song.events.length && song.events[cursor].time < offset; cursor++) {
            const message = song.events[cursor].message, hi = message[0] & 240;
            if (hi !== 128 && hi !== 144 && hi !== 160) synth.send(message);
        }
        base = ac.currentTime + .08 - offset;
        needsReset = false;
        synth.setMasterVol(+volume.value);
    }
    function fail(e) {
        console.warn('Jukebox:', e);
        playing = false; loading = false;
        error = 'Could not play this track. Press play to retry, or choose another.';
        if (synth) { silence(); ac.suspend().catch(() => {}); }
        needsReset = true; label();
    }
    async function load() {
        const selected = at, token = ++request, track = MIDI_FILES[at];
        loading = true; error = ''; label();
        try {
            if (!cache.has(track.url)) {
                cache.set(track.url, fetch(track.url).then(response => {
                    if (!response.ok) throw new Error(`MIDI HTTP ${response.status}`);
                    return response.arrayBuffer();
                }).then(parseMidi).catch(e => { cache.delete(track.url); throw e; }));
            }
            const loaded = await cache.get(track.url);
            if (token !== request || selected !== at) return;
            song = loaded; loading = false;
            if (playing) { prepare(); pump(); }
            label();
        } catch (e) { if (token === request) fail(e); }
    }
    function choose(index) {
        at = (index + MIDI_FILES.length) % MIDI_FILES.length;
        song = null; offset = cursor = 0; needsReset = true;
        silence(); load();
    }
    function pump() {
        if (!playing || !song || needsReset || ac.state !== 'running') return;
        const now = ac.currentTime;
        while (cursor < song.events.length && base + song.events[cursor].time < now + .12) {
            const event = song.events[cursor++];
            synth.send(event.message, Math.max(now, base + event.time));
        }
        if (now >= base + song.duration + .6) choose(at + 1);
        label();
    }
    async function start() {
        try {
            if (!synth) {
                if (!(window.AudioContext || window.webkitAudioContext) || !window.WebAudioTinySynth) {
                    throw new Error('Web Audio or synth unavailable');
                }
                synth = new window.WebAudioTinySynth({ quality: 1, voices: 64 });
                ac = synth.getAudioContext(); synth.setMasterVol(0);
                timer = setInterval(pump, 40);
            }
            playing = true; error = ''; label();
            await ac.resume();
            if (!playing) return;
            if (!song) { if (!loading) load(); }
            else { if (needsReset) prepare(); pump(); }
        } catch (e) { fail(e); }
    }
    function pause() {
        offset = position(); playing = false;
        if (ac) ac.suspend().catch(fail);
        label();
    }
    function seek(direction) {
        if (!song) return;
        offset = Math.max(0, Math.min(song.duration, position() + direction * 10));
        silence(); needsReset = true;
        if (playing) { prepare(); pump(); }
        label();
    }
    MIDI_FILES.forEach((track, index) => {
        const option = document.createElement('option');
        option.value = String(index); option.textContent = `${String(index + 1).padStart(2, '0')} · ${track.name}`;
        list.append(option);
    });
    play.addEventListener('click', () => playing ? pause() : start());
    $('jnext').addEventListener('click', () => choose(at + 1));
    $('jprev').addEventListener('click', () => choose(at - 1));
    $('jfwd').addEventListener('click', () => seek(1));
    $('jback').addEventListener('click', () => seek(-1));
    list.addEventListener('change', () => choose(+list.value));
    volume.addEventListener('input', () => { if (synth && !needsReset) synth.setMasterVol(+volume.value); });
    // The panel starts folded. On wide screens it unrolls in the card pile and stays until folded;
    // on narrow screens the ♪ button opens it as a floating card that any outside click dismisses.
    const quick = $('jquick'), fold = $('jfold');
    const floating = () => matchMedia('(max-width: 1040px)').matches;
    let panelOpen = false;
    function panel(open) {
        panelOpen = open; box.classList.toggle('jopen', open);
        if (fold) fold.setAttribute('aria-expanded', String(open));
        if (quick) {
            quick.setAttribute('aria-expanded', String(open));
            quick.setAttribute('aria-label', open ? 'Close jukebox' : 'Open jukebox');
        }
    }
    if (fold) fold.addEventListener('click', () => panel(!panelOpen));
    if (quick) {
        quick.addEventListener('click', () => panel(!panelOpen));
        addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen && floating()) { panel(false); quick.focus(); } });
        addEventListener('click', e => { if (panelOpen && floating() && !box.contains(e.target) && !quick.contains(e.target)) panel(false); });
    }
    addEventListener('pagehide', () => { pause(); clearInterval(timer); timer = null; });
    addEventListener('pageshow', () => { if (synth && !timer) timer = setInterval(pump, 40); });
    label();
    // Kept for the same local MIDI/scheduler checks as the original player.
    window.__juke = { MIDI_FILES, parseMidi, get at() { return at; }, get playing() { return playing; } };
})();
