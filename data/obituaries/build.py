#!/usr/bin/env python3
"""Assemble the obituaries data essay.

    python3 data/obituaries/build.py preview   -> data/obituaries/preview.html (plaintext, local)
    python3 data/obituaries/build.py gated PW  -> obituaries.html (AES-GCM payload, password PW)
    python3 data/obituaries/build.py public    -> obituaries.html (plaintext) + images/obituaries/

source.html holds the whole page. Two markers are replaced:
    <!--DATA-->  the datasets (network, people, world map) as inline JSON
    <!--GATE-->  nothing in the preview; the password gate in the gated build
In the gated build the essay markup between <!--ESSAY--> and <!--/ESSAY--> and the
datasets are encrypted together, and portraits are inlined as data URIs so the page
carries everything it needs.
"""
import base64, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

def load():
    net = json.load(open(os.path.join(ROOT, 'data', 'obituaries-network.json')))
    people = json.load(open(os.path.join(HERE, 'people.json')))
    world = json.load(open(os.path.join(HERE, 'vendor', 'countries-110m.json')))
    uk = json.load(open(os.path.join(HERE, 'vendor', 'countries-50m.json')))
    # keep only the British Isles and nearby coast from the 50m file, for the inset
    keep = {'826', '372', '250', '056', '528', '208', '578'}
    uk['objects']['countries']['geometries'] = [g for g in uk['objects']['countries']['geometries'] if g.get('id') in keep]
    # drop the arcs no kept geometry uses, and renumber the rest (topojson arcs are shared by index)
    used = set()
    def walk(a):
        for x in a:
            if isinstance(x, list): walk(x)
            else: used.add(x if x >= 0 else ~x)
    for g in uk['objects']['countries']['geometries']: walk(g['arcs'])
    order = sorted(used); remap = {old: i for i, old in enumerate(order)}
    def renum(a):
        return [renum(x) if isinstance(x, list) else (remap[x] if x >= 0 else ~remap[~x]) for x in a]
    for g in uk['objects']['countries']['geometries']: g['arcs'] = renum(g['arcs'])
    uk['arcs'] = [uk['arcs'][i] for i in order]
    slim = {}
    extra_path = os.path.join(HERE, 'extra-portraits.json')
    extra = json.load(open(extra_path)) if os.path.exists(extra_path) else {}
    for name, r in people.items():
        if not r.get('found'):
            if name in extra:
                e = extra[name]
                slim[name] = {'portrait': {'local': e['local'], 'page': e.get('page'), 'artist': e.get('artist'), 'license': e.get('license'), 'file': None, 'source': e.get('source_type')}}
            continue
        slim[name] = {k: r.get(k) for k in ('page', 'url', 'desc', 'born', 'died', 'gender', 'citizenship', 'verified', 'qid')}
        if r.get('birthplace'):
            slim[name]['birthplace'] = r['birthplace']
        if r.get('portrait', {}).get('local'):
            slim[name]['portrait'] = {k: r['portrait'].get(k) for k in ('local', 'page', 'artist', 'license', 'file')}
            slim[name]['portrait']['source'] = 'commons'
        elif name in extra:
            e = extra[name]
            slim[name]['portrait'] = {'local': e['local'], 'page': e.get('page'), 'artist': e.get('artist'), 'license': e.get('license'), 'file': None, 'source': e.get('source_type')}
    # names absent from people.json entirely
    for name, e in extra.items():
        if name not in slim:
            slim[name] = {'portrait': {'local': e['local'], 'page': e.get('page'), 'artist': e.get('artist'), 'license': e.get('license'), 'file': None, 'source': e.get('source_type')}}
    return net, slim, world, uk

def inline_portraits(people):
    """Inline portraits as data URIs, downscaled to 180px (medallions are at most 58 CSS px)."""
    import subprocess
    small = os.path.join(HERE, 'portraits-small'); os.makedirs(small, exist_ok=True)
    for r in people.values():
        p = r.get('portrait')
        if p and p.get('local'):
            src = os.path.join(HERE, p['local'])
            if not os.path.exists(src): continue
            dst = os.path.join(small, os.path.basename(src))
            if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '-Z', '180', src, '--out', dst], check=True, capture_output=True)
            p['local'] = 'data:image/jpeg;base64,' + base64.b64encode(open(dst, 'rb').read()).decode()

def data_script(net, people, world, uk):
    j = lambda o: json.dumps(o, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    return ('<script>window.OBT_DATA=' + j({'net': net, 'people': people, 'world': world, 'uk': uk}) + ';</script>')

def vendor():
    js = open(os.path.join(HERE, 'vendor', 'topojson-client.min.js'), encoding='utf-8').read()
    return '<script>' + js.replace('</', '<\\/') + '</script>'

def build_preview():
    net, people, world, uk = load()
    src = open(os.path.join(HERE, 'source.html'), encoding='utf-8').read().replace('<!--VENDOR-->', vendor())
    src = src.replace('<!--DATA-->', data_script(net, people, world, uk)).replace('<!--GATE-->', '')
    src = src.replace('<!--ESSAY-->', '').replace('<!--/ESSAY-->', '')
    out = os.path.join(HERE, 'preview.html')
    open(out, 'w', encoding='utf-8').write(src)
    print('wrote', out, len(src) // 1024, 'KB')

def build_gated(password):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import hashlib
    net, people, world, uk = load()
    inline_portraits(people)
    src = open(os.path.join(HERE, 'source.html'), encoding='utf-8').read().replace('<!--VENDOR-->', vendor()).replace('href="../../', 'href="')
    m = re.search(r'<!--ESSAY-->(.*?)<!--/ESSAY-->', src, re.S)
    essay = m.group(1)
    payload = json.dumps({'html': essay, 'data': {'net': net, 'people': people, 'world': world, 'uk': uk}}, ensure_ascii=False).encode()
    salt, iv = os.urandom(16), os.urandom(12)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 200000, 32)
    ct = AESGCM(key).encrypt(iv, payload, None)
    locked = {'v': 2, 'iter': 200000, 'salt': base64.b64encode(salt).decode(), 'iv': base64.b64encode(iv).decode(), 'ct': base64.b64encode(ct).decode()}
    gate = open(os.path.join(HERE, 'gate.html'), encoding='utf-8').read().replace('/*LOCKED*/', 'const LOCKED=' + json.dumps(locked) + ';')
    src = src.replace(m.group(0), '<div id="obt-content"></div>')
    src = src.replace('<!--DATA-->', '').replace('<!--GATE-->', gate)
    out = os.path.join(ROOT, 'obituaries.html')
    open(out, 'w', encoding='utf-8').write(src)
    print('wrote', out, len(src) // 1024, 'KB; plaintext not present:', 'Whewell' not in src)

def build_public():
    """Ungated page at the repository root: plaintext essay, datasets inline, portraits as
    downscaled files under images/obituaries/."""
    import shutil, subprocess
    net, people, world, uk = load()
    small = os.path.join(HERE, 'portraits-small'); os.makedirs(small, exist_ok=True)
    pub = os.path.join(ROOT, 'images', 'obituaries'); os.makedirs(pub, exist_ok=True)
    for r in people.values():
        p = r.get('portrait')
        if not (p and p.get('local')): continue
        src = os.path.join(HERE, p['local'])
        if not os.path.exists(src): r.pop('portrait'); continue
        name = ('x-' if '/portraits-extra/' in src else '') + os.path.basename(src); dst = os.path.join(small, name)
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '-Z', '180', src, '--out', dst], check=True, capture_output=True)
        shutil.copyfile(dst, os.path.join(pub, name))
        import hashlib
        p['local'] = 'images/obituaries/' + name + '?v=' + hashlib.md5(open(dst, 'rb').read()).hexdigest()[:8]  # bust stale CDN entries when a file changes
    src = open(os.path.join(HERE, 'source.html'), encoding='utf-8').read().replace('<!--VENDOR-->', vendor()).replace('href="../../', 'href="')
    src = src.replace('    <meta name="robots" content="noindex, nofollow">\n', '')
    src = src.replace('<!--DATA-->', data_script(net, people, world, uk)).replace('<!--GATE-->', '')
    src = src.replace('<!--ESSAY-->', '').replace('<!--/ESSAY-->', '')
    out = os.path.join(ROOT, 'obituaries.html')
    open(out, 'w', encoding='utf-8').write(src)
    print('wrote', out, len(src) // 1024, 'KB; portraits in images/obituaries:', len(os.listdir(pub)))

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    if mode == 'preview':
        build_preview()
    elif mode == 'gated':
        build_gated(sys.argv[2])
    elif mode == 'public':
        build_public()
    else:
        sys.exit(__doc__)
