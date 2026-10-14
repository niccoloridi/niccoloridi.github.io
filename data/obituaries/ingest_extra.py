#!/usr/bin/env python3
"""Fetch the portraits found by hand/research (scratchpad result-*.json or a given file)
into portraits-extra/, apply optional crops, and record source and licence in
extra-portraits.json. Kept apart from people.json so enrich.py never touches them.

    python3 ingest_extra.py RESULTS.json [RESULTS2.json ...]   fetch new entries
    python3 ingest_extra.py --crops                             re-apply CROPS only
"""
import json, os, re, ssl, subprocess, sys, time, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'portraits-extra'); os.makedirs(DIR, exist_ok=True)
MAN = os.path.join(HERE, 'extra-portraits.json')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
# crops as fractions of the source image: id -> (left, top, width, height); applied to the raw download
CROPS = {
    'Vaughan Lowe': (0.22, 0.0, 0.26, 1.0),
    'Maurice Mendelson': (0.0, 0.0, 1.0, 0.66),
    'Guenter Heinz Treitel': (0.24, 0.31, 0.24, 0.165),
    'Peter North': (0.27, 0.10, 0.38, 0.25),
    'D. H. N. Johnson': (0.615, 0.29, 0.08, 0.14),
    'Pierre Klein': (0.64, 0.19, 0.14, 0.215),
    'John Hopkins': (0.27, 0.18, 0.24, 0.34),
    'Felice Morgenstern': (0.53, 0.15, 0.11, 0.22),
    'Francis Lorimer': (0.22, 0.10, 0.34, 0.27),
    'Dionisio Anzilotti': (0.545, 0.315, 0.07, 0.095),
    'C. A. Stavropoulos': (0.22, 0.12, 0.56, 0.56),
    'Sir Robert Yewdall Jennings': (0.0, 0.38, 0.25, 0.34),
    'Sir Cecil Hurst': (0.185, 0.37, 0.06, 0.09),
    'F. A. Mann': (0.74, 0.23, 0.16, 0.23),
    'Lord Wilberforce': (0.30, 0.205, 0.10, 0.15),
    'Ronald Roxburgh': (0.24, 0.04, 0.52, 0.38),
    'Sir George Sherston Baker': (0.20, 0.03, 0.60, 0.43),
    'Sir John Sparrow': (0.15, 0.15, 0.42, 0.37),
    'W. W. Buckland': (0.14, 0.08, 0.72, 0.58),
    'Gillian White': (0.10, 0.03, 0.80, 0.52),
    'Sir Derek Bowett': (0.15, 0.08, 0.70, 0.70),
    'Mr. Justice Mellor': (0.23, 0.22, 0.16, 0.24),
}
# ids whose research result is rejected after visual review
REJECT = {'Felice Morgenstern', 'W. R. Bisschop'}  # unidentified in a group photo; NPG file not fetchable

def slug(n): return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')

def fetch(url):
    if 'wikimedia.org' in url or 'wikipedia.org' in url:
        ua = 'ObituariesEssayBuild/1.1 (https://niccoloridi.com; site maintenance script) python-urllib'
    else:
        ua = UA
    req = urllib.request.Request(url, headers={'User-Agent': ua})
    for i in range(3):
        try:
            ctx = ssl._create_unverified_context() if any(h in url for h in ('legal.un.org', 'mpipriv.de')) else None  # incomplete certificate chains
            with urllib.request.urlopen(req, timeout=40, context=ctx) as r:
                return r.read(), r.headers.get('Content-Type', '')
        except Exception as e:
            if i == 2: raise
            time.sleep(4 * (i + 1) if '429' in str(e) else 1.5)

def to_jpeg(raw_path, out_path, crop=None):
    src = raw_path
    if crop:
        # sips cannot crop by fraction; read the size first, then crop in pixels with an offset
        info = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', raw_path], capture_output=True, text=True).stdout
        w = int(re.search(r'pixelWidth: (\d+)', info).group(1)); h = int(re.search(r'pixelHeight: (\d+)', info).group(1))
        l, t, cw, ch = crop
        tmp = out_path + '.crop.png'
        subprocess.run(['sips', '-s', 'format', 'png', raw_path, '--out', tmp], check=True, capture_output=True)
        subprocess.run(['sips', '-c', str(int(ch * h)), str(int(cw * w)), '--cropOffset', str(int(t * h)), str(int(l * w)), tmp, '--out', tmp], check=True, capture_output=True)
        src = tmp
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '480', src, '--out', out_path], check=True, capture_output=True)
    if crop: os.remove(src)

def main(argv):
    man = json.load(open(MAN)) if os.path.exists(MAN) else {}
    if argv and argv[0] == '--crops':
        for k, rec in man.items():
            raw = os.path.join(DIR, 'raw', rec['raw'])
            if os.path.exists(raw): to_jpeg(raw, os.path.join(HERE, rec['local']), CROPS.get(k))
        print('crops re-applied'); return
    os.makedirs(os.path.join(DIR, 'raw'), exist_ok=True)
    for f in argv:
        for r in json.load(open(f)):
            k = r.get('id'); url = r.get('image_url')
            if not k or not url or k in REJECT: continue
            if k in man and man[k].get('image_url') == url: continue
            try:
                data, ctype = fetch(url)
            except Exception as e:
                print('  ! fetch failed', k, str(e)[:80]); continue
            if len(data) < 2000 or not (ctype.startswith('image') or data[:4] in (b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'\x89PNG') or data[:3] == b'\xff\xd8\xff' or data[:4] == b'RIFF' or data[:4] in (b'II*\x00', b'MM\x00*')):
                print('  ! not an image', k, ctype, len(data)); continue
            ext = {'image/png': 'png', 'image/webp': 'webp', 'image/tiff': 'tif', 'image/gif': 'gif'}.get(ctype.split(';')[0], 'jpg')
            raw = slug(k) + '.' + ext
            open(os.path.join(DIR, 'raw', raw), 'wb').write(data)
            local = 'portraits-extra/' + slug(k) + '.jpg'
            try:
                to_jpeg(os.path.join(DIR, 'raw', raw), os.path.join(HERE, local), CROPS.get(k))
            except Exception as e:
                print('  ! convert failed', k, str(e)[:80]); continue
            man[k] = {'local': local, 'raw': raw, 'image_url': url, 'page': r.get('source_page'), 'source_type': r.get('source_type'),
                      'license': r.get('licence'), 'artist': r.get('credit'), 'identity_check': r.get('identity_check'),
                      'confidence': r.get('confidence'), 'crop_note': r.get('crop_note'), 'identified_as': r.get('identified_as')}
            print('  ok', k, '|', r.get('source_type'), '|', (r.get('licence') or '')[:30], '|', r.get('confidence'))
            time.sleep(0.5)
    json.dump(man, open(MAN, 'w'), indent=1, ensure_ascii=False)
    print('manifest:', len(man), 'portraits')

if __name__ == '__main__':
    main(sys.argv[1:])
