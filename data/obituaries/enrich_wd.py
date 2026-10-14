#!/usr/bin/env python3
"""Second pass: people with no usable Wikipedia article are looked up on Wikidata
directly (wbsearchentities), accepted when the item's description reads like a
lawyer's, and given dates, birthplace, gender and an image from the item."""
import json, os, re, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'people.json')
PORT = os.path.join(HERE, 'portraits')
UA = 'ObituariesEssayBuild/1.1 (https://niccoloridi.com; site maintenance script) python-urllib'
KEYWORDS = re.compile(r'lawyer|jurist|judge|\blaw\b|legal|diplomat|politician|professor|academic|barrister|arbitrat|statesman|scholar|solicitor|civil servant|official', re.I)
SKIP = {'Francis Lorimer', 'Hugh Bellot', 'Georg Schwarzenberger', 'Gillian White', 'Iain Scobbie', 'Christina Lyon', 'Peter Carter', 'Francis Lorimer', 'Max Huber', 'Unknown', 'J. A. S.', 'Harding', 'Griswold', 'Dr Kruger', 'Maitre Senart', 'George Gray', 'Henry Barnes', 'T. Barkley', 'Richard Cohen', 'G. Conradi'}
HINTS = {'Rivier': 'Alphonse Rivier', 'Maitre Clunet': 'Édouard Clunet', 'Mendelssohn-Bartholdy': 'Albrecht Mendelssohn Bartholdy', 'Professor Frowein': 'Jochen Frowein',
         'G. I. A. D. Draper': 'Gerald Draper', 'H. C. Gutteridge': 'Harold Cooke Gutteridge', 'Ben Atkinson Wortley': 'Ben Wortley', 'Cyrill M. Picciotto': 'Cyril Picciotto',
         'Mr. Justice Bray': 'Reginald More Bray', 'N. V. Moerawieff': 'Nikolai Muravyov', 'Sir Geoffrey Butler': 'Geoffrey Gilbert Butler', 'Charles Cheney Hyde': 'Charles Cheney Hyde',
         'Sir John Fischer-Williams': 'John Fischer Williams', 'W. R. Bisschop': 'Willem Roosegaarde Bisschop', 'Edward Arthur Whittuck': 'Edward Arthur Whittuck',
         'Francis Lorimer': 'James Lorimer', 'Lord Justice Bray': 'Reginald More Bray', 'Pierre Klein': 'Pierre Klein', 'Iain Scobbie': 'Iain Scobbie'}

def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = r.read(); return d if binary else json.loads(d.decode())
        except Exception as e:
            if i == 3: print('  ! failed', url[:100], e, file=sys.stderr); return None
            time.sleep(6 * (i + 1) if '429' in str(e) else 2)
def wd(params):
    base = {'format': 'json'}; base.update(params)
    return get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(base))
def clean(n): return re.sub(r'^(Sir|Lord|Dame|Dr|Professor|Mr\. Justice|Maitre|Jonkheer)\s+', '', n).strip()
def slug(n): return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
def year(c):
    try: t = c[0]['mainsnak']['datavalue']['value']['time']; return int(t[1:5])
    except Exception: return None

people = json.load(open(OUT))
net = json.load(open(os.path.join(HERE, '..', 'obituaries-network.json')))
for bad in ['Georg Schwarzenberger', 'Gillian White', 'Iain Scobbie', 'Christina Lyon', 'Peter Carter', 'Francis Lorimer']:
    if people.get(bad, {}).get('how') == 'wikidata': people[bad] = {'found': False, 'how': 'rejected'}
# Max Huber, the PCIJ judge, has no usable article under that title and the search hits the wrong man; set him by hand
people['Max Huber'] = {'found': True, 'how': 'manual', 'title': 'Max Huber', 'page': 'Max Huber (jurist)', 'qid': 'Q123181', 'desc': 'Swiss jurist and diplomat; President of the Permanent Court of International Justice',
    'url': 'https://en.wikipedia.org/wiki/Max_Huber', 'born': 1874, 'died': 1960, 'gender': 'male', 'verified': True, 'citizenship': ['Switzerland'],
    'birthplace': {'name': 'Zürich', 'coords': [47.374, 8.541], 'country': 'Switzerland'}, 'image_file': 'Max Huber (1874-196) in 1940.jpg'}
# identities corrected by hand after checking the dataset's ties
people['Francis Lorimer'] = {'found': True, 'how': 'manual', 'title': 'James Lorimer (jurist)', 'page': 'James Lorimer', 'qid': 'Q1680493',
    'desc': 'Scottish jurist; Regius Professor of Public Law at Edinburgh (named "Francis" in the dataset)', 'url': 'https://en.wikipedia.org/wiki/James_Lorimer_(jurist)',
    'born': 1818, 'died': 1890, 'gender': 'male', 'verified': True, 'citizenship': ['United Kingdom'],
    'birthplace': {'name': 'Aberdalgie', 'coords': [56.367, -3.483], 'country': 'United Kingdom'}, 'birthplace_fixed': True}
people['Hugh Bellot'] = {'found': True, 'how': 'manual', 'title': 'Hugh Hale Leigh Bellot', 'page': 'Hugh Hale Leigh Bellot', 'qid': None,
    'desc': 'English barrister and international lawyer; secretary of the Grotius Society', 'url': None,
    'born': 1860, 'died': 1928, 'gender': 'male', 'verified': True, 'citizenship': ['United Kingdom']}
todo = [n['id'] for n in net['nodes'] if not people.get(n['id'], {}).get('found') and n['id'] not in SKIP]
print(len(todo), 'names to try on Wikidata')
for name in todo:
    q = HINTS.get(name, clean(name))
    res = wd({'action': 'wbsearchentities', 'search': q, 'language': 'en', 'limit': 5, 'type': 'item'})
    time.sleep(0.8)
    hits = [h for h in (res or {}).get('search', []) if KEYWORDS.search(h.get('description') or '')]
    if not hits:
        print('  no match', name, '(', q, ')'); continue
    h = hits[0]
    ent = (wd({'action': 'wbgetentities', 'ids': h['id'], 'props': 'claims|labels|sitelinks', 'languages': 'en'}) or {}).get('entities', {}).get(h['id'])
    time.sleep(0.8)
    if not ent: continue
    c = ent.get('claims', {})
    if 'P31' in c and 'Q5' not in json.dumps(c['P31']):
        print('  not a human', name, h['label']); continue
    rec = people.setdefault(name, {})
    rec.update({'found': True, 'how': 'wikidata', 'title': h['label'], 'page': h['label'], 'qid': h['id'], 'desc': h.get('description'), 'verified': True,
                'url': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(ent['sitelinks']['enwiki']['title'].replace(' ', '_')) if 'enwiki' in ent.get('sitelinks', {}) else 'https://www.wikidata.org/wiki/' + h['id'],
                'born': year(c['P569']) if 'P569' in c else None, 'died': year(c['P570']) if 'P570' in c else None})
    try: rec['gender'] = {'Q6581097': 'male', 'Q6581072': 'female'}.get(c['P21'][0]['mainsnak']['datavalue']['value']['id'])
    except Exception: rec['gender'] = None
    try: rec['birthplace_q'] = c['P19'][0]['mainsnak']['datavalue']['value']['id']
    except Exception: rec['birthplace_q'] = None
    try: rec['image_file'] = c['P18'][0]['mainsnak']['datavalue']['value']
    except Exception: rec['image_file'] = None
    rec['citizenship'] = []
    print('  matched', name, '->', h['label'], '|', h.get('description'), rec['born'], rec['died'], 'img' if rec['image_file'] else '')
# birthplaces for new records
pq = sorted({r['birthplace_q'] for r in people.values() if r.get('how') == 'wikidata' and r.get('birthplace_q')})
if pq:
    ents = (wd({'action': 'wbgetentities', 'ids': '|'.join(pq), 'props': 'claims|labels', 'languages': 'en'}) or {}).get('entities', {})
    cq = set()
    for e in ents.values():
        try: cq.add(e['claims']['P17'][0]['mainsnak']['datavalue']['value']['id'])
        except Exception: pass
    cents = (wd({'action': 'wbgetentities', 'ids': '|'.join(sorted(cq)), 'props': 'labels', 'languages': 'en'}) or {}).get('entities', {}) if cq else {}
    for r in people.values():
        if r.get('how') != 'wikidata' or not r.get('birthplace_q'): continue
        e = ents.get(r['birthplace_q'])
        if not e: continue
        try: v = e['claims']['P625'][0]['mainsnak']['datavalue']['value']; coords = [round(v['latitude'], 3), round(v['longitude'], 3)]
        except Exception: coords = None
        try: country = cents[e['claims']['P17'][0]['mainsnak']['datavalue']['value']['id']]['labels']['en']['value']
        except Exception: country = None
        r['birthplace'] = {'name': e.get('labels', {}).get('en', {}).get('value'), 'coords': coords, 'country': country}
# portraits for new records
files = {n: r['image_file'] for n, r in people.items() if r.get('how') in ('wikidata', 'manual') and r.get('image_file')}
if files:
    res = get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'format': 'json', 'formatversion': 2, 'action': 'query', 'titles': '|'.join('File:' + f for f in set(files.values())), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 360, 'iiextmetadatafilter': 'Artist|LicenseShortName'}))
    meta = {p['title'].replace('File:', ''): (p.get('imageinfo') or [None])[0] for p in (res or {}).get('query', {}).get('pages', [])}
    strip = lambda s: re.sub(r'<[^>]+>', '', s or '').strip()
    for n, f in files.items():
        ii = meta.get(f) or meta.get(f.replace('_', ' '))
        if not ii: continue
        em = ii.get('extmetadata', {})
        people[n]['portrait'] = {'file': f, 'page': ii.get('descriptionurl'), 'thumb_url': ii.get('thumburl'), 'artist': strip((em.get('Artist') or {}).get('value')), 'license': strip((em.get('LicenseShortName') or {}).get('value'))}
        local = os.path.join(PORT, slug(n) + '.jpg')
        if not os.path.exists(local) and ii.get('thumburl'):
            d = get(ii['thumburl'], binary=True)
            if d: open(local, 'wb').write(d); time.sleep(0.6)
        if os.path.exists(local): people[n]['portrait']['local'] = 'portraits/' + slug(n) + '.jpg'
json.dump(people, open(OUT, 'w'), indent=1, ensure_ascii=False)
print('done; found total', sum(1 for r in people.values() if r.get('found')), 'portraits', sum(1 for r in people.values() if r.get('portrait', {}).get('local')))

# Wikidata lists historical countries first (London: Roman Empire); correct them
import subprocess as _sp
_sp.run([sys.executable, '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_countries.py')], check=False)
