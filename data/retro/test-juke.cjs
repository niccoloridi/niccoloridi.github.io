// Run from the repository root: node data/retro/test-juke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const localFile = url => path.join(root, decodeURIComponent(url.split('?')[0]));
const source = fs.readFileSync(path.join(__dirname, 'juke.js'), 'utf8');
const bytes = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
function player(fetcher) {
    const elements = new Map(), calls = [], timers = new Map(), warnings = [];
    let audio, count = 0;
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            value: id === 'jvol' ? '.5' : '', textContent: '', children: [], attrs: {}, listeners: {},
            append(option) { this.children.push(option); },
            setAttribute(key, value) { this.attrs[key] = value; },
            getAttribute(key) { return this.attrs[key]; },
            addEventListener(type, callback) { this.listeners[type] = callback; },
            classList: { toggle() {} },
        });
        return elements.get(id);
    }
    class Synth {
        constructor() {
            audio = this.ac = { currentTime: 0, state: 'running',
                async resume() { this.state = 'running'; }, async suspend() { this.state = 'suspended'; } };
            this.out = this.comp = { disconnect() {} }; this.lfo = { stop() {} };
        }
        getAudioContext() { return this.ac; }
        setAudioContext(ac) { this.ac = ac; calls.push(['graph']); }
        setMasterVol(v) { calls.push(['volume', v]); }
        reset() { calls.push(['reset']); }
        send(m, t) { calls.push(['midi', Array.from(m), t]); }
    }
    const context = vm.createContext({ console: { warn: (...args) => warnings.push(args) }, TextDecoder,
        document: { getElementById: element, createElement: () => ({}) },
        window: { AudioContext: function () {}, WebAudioTinySynth: Synth }, addEventListener() {},
        setInterval: fn => { timers.set(++count, fn); return count; }, clearInterval: id => timers.delete(id),
        fetch: fetcher || (async url => ({ ok: true, arrayBuffer: async () => bytes(fs.readFileSync(localFile(url))) })),
    });
    vm.runInContext(source, context);
    return { api: context.window.__juke, elements, calls, warnings, get audio() { return audio; },
        click: id => element(id).listeners.click(), pump: () => [...timers.values()].forEach(fn => fn()),
        select: n => { element('jtracks').value = String(n); element('jtracks').listeners.change(); } };
}
(async () => {
    const p = player(), parse = p.api.parseMidi;
    assert.equal(p.api.MIDI_FILES.length, 16);
    assert.equal(p.audio, undefined, 'No audio context or playback before Play');
    assert.equal(p.elements.get('jtracks').children.length, 16);
    p.click('jquick'); assert.equal(p.elements.get('jquick').attrs['aria-expanded'], 'true');
    p.click('jquick'); assert.equal(p.elements.get('jquick').attrs['aria-expanded'], 'false');
    let total = 0;
    for (const track of p.api.MIDI_FILES) {
        assert.match(track.url, /\?v=mi-gm-1$/, 'Deployed MIDI URLs bypass cached pre-deployment 404s');
        const file = fs.readFileSync(localFile(track.url));
        const song = parse(bytes(file));
        assert(song.noteCount > 100 && song.duration > 30 && song.duration < 300, track.name);
        assert(song.events.every((e, i, a) => Number.isFinite(e.time) && (!i || e.time >= a[i - 1].time)));
        assert(song.events.at(-1).time <= song.duration + 1e-8);
        total += song.noteCount;
        console.log(`OK ${track.name}: ${song.noteCount} notes, ${song.duration.toFixed(2)}s`);
    }
    // One channel, running status, a SysEx, and two tempos. Final note-off is at 1.5s.
    const events = [0,255,81,3,7,161,32, 0,240,3,126,127,247, 0,144,60,100,
        96,60,0, 0,255,81,3,15,66,64, 0,144,64,100, 96,128,64,0, 0,255,47,0];
    const fixture = Buffer.concat([Buffer.from('MThd'), Buffer.from([0,0,0,6,0,0,0,1,0,96]),
        Buffer.from('MTrk'), Buffer.from([0,0,0,events.length]), Buffer.from(events)]);
    const song = parse(bytes(fixture));
    assert.equal(song.noteCount, 2); assert.equal(song.duration, 1.5);
    assert.equal(song.events[0].message[0], 240);
    assert.equal(song.events.at(-1).time, 1.5);
    assert.throws(() => parse(bytes(Buffer.from('<html>missing</html>'))));
    assert.throws(() => parse(bytes(fixture.subarray(0, fixture.length - 1))));
    p.click('jplay'); await settle();
    assert(p.api.playing); assert.match(p.elements.get('jtime').textContent, /2:54$/);
    p.audio.currentTime = 12; p.pump(); assert(p.calls.some(c => c[0] === 'midi'));
    p.click('jplay'); assert(!p.api.playing); assert.equal(p.audio.state, 'suspended');
    const sent = p.calls.length; p.pump(); assert.equal(p.calls.length, sent, 'Pause schedules no new events');
    p.click('jplay'); await settle(); assert(p.api.playing);
    p.click('jfwd'); assert.match(p.elements.get('jtime').textContent, /^0:21/);
    p.click('jback'); assert.match(p.elements.get('jtime').textContent, /^0:11/);
    p.select(13); await settle(); assert.equal(p.elements.get('jname').textContent, 'The Carnival');
    p.click('jplay'); p.click('jnext'); await settle();
    assert.equal(p.api.at, 14); assert(!p.api.playing); assert.equal(p.audio.state, 'suspended');
    p.select(15); await settle(); p.click('jplay'); await settle();
    p.audio.currentTime += 125; p.pump(); await settle();
    assert.equal(p.api.at, 0, 'End of playlist wraps in order');
    p.click('jplay');
    // A slow previous request must not replace the song selected afterwards.
    const pending = new Map();
    const race = player(url => new Promise(resolve => pending.set(url, resolve)));
    race.select(1); race.select(2);
    const selectedFile = fs.readFileSync(localFile(race.api.MIDI_FILES[2].url));
    pending.get(race.api.MIDI_FILES[2].url)({ ok: true, arrayBuffer: async () => bytes(selectedFile) }); await settle();
    assert.match(race.elements.get('jtime').textContent, /1:22$/);
    pending.get(race.api.MIDI_FILES[1].url)({ ok: true, arrayBuffer: async () => bytes(fixture) }); await settle();
    assert.equal(race.api.at, 2); assert.equal(race.elements.get('jname').textContent, 'Scumm Bar');
    assert.match(race.elements.get('jtime').textContent, /1:22$/, 'Stale response cannot replace the selected audio');
    const bad = player(async () => ({ ok: false, status: 404 }));
    bad.click('jplay'); await settle(); assert(!bad.api.playing);
    assert.match(bad.elements.get('jstatus').textContent, /retry/);
    assert.equal(bad.warnings.length, 1);
    console.log(`PASS: all 16 actual files (${total} notes), tempo/running-status/SysEx, pause/resume, seek, selection, auto-next, stale requests and HTTP failure.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
