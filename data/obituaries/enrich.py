#!/usr/bin/env python3
"""Look up each person in the obituaries network on Wikipedia and Wikidata, and
fetch a portrait thumbnail from Wikimedia Commons where one exists.

Writes data/obituaries/people.json (one record per node id) and portraits/*.jpg.
Run from the repository root. Re-running only re-fetches missing items unless
--refresh is given. Hand corrections go in ALIASES below.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
NET = os.path.join(HERE, '..', 'obituaries-network.json')
OUT = os.path.join(HERE, 'people.json')
PORT = os.path.join(HERE, 'portraits')
UA = 'ObituariesEssayBuild/1.1 (https://niccoloridi.com; site maintenance script) python-urllib'
REFRESH = '--refresh' in sys.argv

# node id -> Wikipedia title (None = known to have no usable article)
ALIASES = {
 'Lord Arnold McNair': 'Arnold McNair, 1st Baron McNair',
 'Sir Robert Yewdall Jennings': 'Robert Jennings (judge)',
 'Sir Derek Bowett': 'Derek Bowett', 'Sir Ian Brownlie': 'Ian Brownlie',
 'Sir Hersch Lauterpacht': 'Hersch Lauterpacht', 'Sir Elihu Lauterpacht': 'Elihu Lauterpacht',
 'Sir Humphrey Waldock': 'Humphrey Waldock', 'Sir Gerald Fitzmaurice': 'Gerald Fitzmaurice',
 'Sir Cecil Hurst': 'Cecil Hurst', 'Sir John Fischer-Williams': 'John Fischer Williams',
 'Sir Eric Beckett': 'Eric Beckett', 'Sir Francis Vallat': 'Francis Vallat',
 'Sir Ian Sinclair': 'Ian Sinclair (lawyer)', 'Sir John Freeland': 'John Freeland',
 'Sir Vincent Evans': 'Vincent Evans (diplomat)', 'Sir Arthur Watts': 'Arthur Watts (lawyer)',
 'Sir James Fawcett': 'James Fawcett (lawyer)', 'James Brierly': 'James Leslie Brierly',
 'F. A. Mann': 'Frederick Alexander Mann', 'A. Pearce Higgins': 'Alexander Pearce Higgins',
 'John Westlake': 'John Westlake (legal scholar)', 'T. J. Lawrence': None,
 'Hugh Bellot': None,  # the international lawyer (1860-1928), not the historian; set in enrich_wd.py 'Edouard Rolin Jaequemyns': 'Édouard Rolin-Jaequemyns',
 'Gustave Rolin Jaequemyns': 'Gustave Rolin-Jaequemyns', 'Sir George Sherston Baker': 'George Sherston Baker',
 'Sir Erle Richards': 'Henry Erle Richards', 'Sir John MacDonnell': 'John Macdonell (jurist)',
 'John McDonnell': 'John Macdonell (jurist)', 'Sir Geoffrey Butler': 'Geoffrey Butler (politician)',
 'W. W. Buckland': 'William Warwick Buckland', 'H. C. Gutteridge': None,
 'Sir C. Wilfred Jenks': 'C. Wilfred Jenks', 'Sir Clarence Wilfred Jenks': 'C. Wilfred Jenks',
 'G. I. A. D. Draper': None, 'Gerald Draper': None,
 'J. H. C. Morris': 'John Humphrey Carlile Morris', 'Guenter Heinz Treitel': 'Guenter Treitel',
 'Peter North': 'Peter North (legal scholar)', 'Lord Justice Scrutton': 'Thomas Edward Scrutton',
 'G. C. Cheshire': 'Geoffrey Cheshire', 'Arthur Cohen': 'Arthur Cohen (politician)',
 'Ben Wortley': None, 'Ronald Roxburgh': 'Ronald Roxburgh',
 'Cyrill M. Picciotto': None, 'Sir David Hughes-Morgan': None,
 'Sir John Sparrow': 'John Sparrow (academic)', 'C. A. Stavropoulos': 'Constantin Stavropoulos',
 'Sakuye Takahashi': 'Takahashi Sakue', 'Inazo Nitobe': 'Nitobe Inazō',
 'Mielville W. Fuller': 'Melville Fuller', 'Maitre Clunet': None,
 'Van Eysinga': 'Willem van Eysinga', 'Professor Frowein': None, 'Pitt Corbett': 'Pitt Cobbett',
 'Johann Kaspar Bluntshchili': 'Johann Caspar Bluntschli', 'Rudolph Von Jhering': 'Rudolf von Jhering',
 'Friederich von Martens': 'Friedrich Martens', 'Ake Hammerskjold': 'Åke Hammarskjöld',
 'Mendelssohn-Bartholdy': None, 'Walther Schucking': 'Walther Schücking',
 'T. M. C. Asser': 'Tobias Asser', 'A. Beernaert': 'Auguste Beernaert',
 'Jonkheer A. F. de Savornin Lohman': 'Alexander de Savornin Lohman', 'Gonzalo de Quezada': 'Gonzalo de Quesada y Aróstegui',
 'Louis M. Drago': 'Luis María Drago', 'Erskine Holland': 'Thomas Erskine Holland',
 'Lord Finlay of Nairn': 'Robert Finlay, 1st Viscount Finlay', 'Lord Phillimore': 'Walter Phillimore, 1st Baron Phillimore',
 'Sir Augustus Phillimore': 'Augustus Phillimore', 'Lord Davies': 'David Davies, 1st Baron Davies',
 'Lord Bryce': 'James Bryce, 1st Viscount Bryce', 'Lord Wilberforce': 'Richard Wilberforce, Baron Wilberforce',
 'Lord Denning': 'Tom Denning, Baron Denning', 'Sir Samuel Evans': 'Samuel Evans (British politician)',
 'Sir John Paget Mellor': 'Sir John Mellor, 1st Baronet', 'J. W. Mellor': 'John William Mellor',
 'Mr. Justice Bray': None, 'D. P. OConnell': 'Daniel Patrick O\'Connell',
 'Andres Aguillar': 'Andrés Aguilar Mawdsley', 'Julio Sanguinetti': 'Julio María Sanguinetti',
 'Sir Henry Maine': 'Henry James Sumner Maine', 'J. B. Scott': 'James Brown Scott',
 'Sir John Salmond': 'John Salmond (judge)', 'Sir William Harrison Moore': 'William Harrison Moore',
 'Sir Kenneth Bailey': 'Kenneth Bailey (lawyer)', 'Lawrence Collins': 'Lawrence Collins, Baron Collins of Mapesbury',
 'Sir Christopher Greenwood': 'Christopher Greenwood', 'James Crawford': 'James Crawford (jurist)',
 'Sir Michael Wood': 'Michael Wood (lawyer)', 'Sir Frank Berman': 'Frank Berman',
 'Dame Rosalyn Higgins': 'Rosalyn Higgins', 'Dame Hazel Fox': 'Hazel Fox',
 'Gillian White': None, 'Sir Charles Fitzpatrick': 'Charles Fitzpatrick',
 'Edward Jenks': 'Edward Jenks', 'Rivier': None, 'Lord Justice Bray': 'Reginald Bray (judge)',
 'Michael Akehurst': None, 'Clive Parry': None, 'Cecil Fifoot': None,
 'Norman S. Marsh': None, 'Kenneth Simmonds': None,
 'Mr. Justice Mellor': None, 'Dr Kruger': None, 'Harding': None, 'Griswold': None, 'J. A. S.': None,
 'Unknown': None, 'Maitre Senart': None, 'W. A. Steiner': None, 'S. Maccoby': None, 'George Gray': None,
 'Henry Barnes': None, 'T. Barkley': None, 'Margaret Blazier': None, 'John McMahon': None,
 'Richard Cohen': None, 'G. Conradi': None, 'John Pawley Bate': None, 'Francis Lorimer': None,
 'W. R. Bisschop': None, 'Edward Arthur Whittuck': None, 'George Grenville Phillimore': None,
 'N. V. Moerawieff': None, 'Christina Lyon': None, 'Chris Beeby': 'Chris Beeby',
 'John Collier': None, 'John Hopkins': None, 'Cherry Hopkins': None, 'C. Hopkins': None,
 'Geoffrey Marston': None, 'Peter Carter': None, 'R. H. Graveson': None, 'Don Greig': None,
 'D. H. N. Johnson': None, 'J. G. Merrills': None, 'Ben Atkinson Wortley': None,
 'Catherine Redgwell': 'Catherine Redgwell', 'Pierre Klein': None, 'Jean d\'Aspremont': 'Jean d\'Aspremont',
 'Iain Scobbie': None, 'Yenkong Ngangjoh Hodu': None, 'Malgosia Fitzmaurice': 'Malgosia Fitzmaurice',
 'Eileen Denza': None, 'Felice Morgenstern': None, 'Joyce Gutteridge': None,
 'Maurice Mendelson': None, 'Philip Allott': None, 'Vaughan Lowe': 'Vaughan Lowe',
 'Philippe Sands': 'Philippe Sands', 'Hilary Charlesworth': 'Hilary Charlesworth',
 'Christine Chinkin': 'Christine Chinkin', 'J. Mervyn Jones': None,
}
# hand-picked Commons files where the automatic choice was a group photograph or nothing
OVERRIDES = {'Max Huber': 'Max Huber (1874-196) in 1940.jpg', 'Roberto Ago': 'Saragat Ago 1965 cropped.png', 'Jules Basdevant': 'Jules Basdevant.JPG',
             'John Westlake': 'John Westlake by Marianne Stokes.jpg', 'Erskine Holland': 'Thomas Erskine Holland.jpg', 'Sir Henry Maine': 'Maine by Dickinson.jpg',
             'Elihu Root': 'Elihu Root, bw photo portrait, 1902 (cropped).jpg', 'Manley O. Hudson': 'Manley O. Hudson LCCN2014717317 (cropped).jpg',
             'Lord Finlay of Nairn': '1stViscountFinlay.jpg', 'Charles de Visscher': 'Charles de Visscher (1884-1973).jpg'}
# automatic picks that are group scenes or the wrong person
DROP_PORTRAIT = {'Sir Cecil Hurst', 'Sir Ian Brownlie', 'Dionisio Anzilotti', 'Peter Carter', 'Francis Lorimer'}
KEYWORDS = re.compile(r'lawyer|jurist|judge|\blaw\b|legal|diplomat|politician|professor|academic|barrister|'
                      r'arbitrat|statesman|philosopher|historian|scholar|psycholog|president|minister|'
                      r'scientist|economist|educator|civil servant|solicitor|official|agricultur|author', re.I)

def get(url, binary=False, tries=5):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
                return data if binary else json.loads(data.decode('utf-8'))
        except Exception as e:  # noqa
            if i == tries - 1:
                print('  ! failed', url[:120], e, file=sys.stderr); return None
            wait = 8 * (i + 1) if '429' in str(e) else 2 * (i + 1)
            print('  retry in', wait, 's:', str(e)[:60], file=sys.stderr); time.sleep(wait)

def wp(params):
    base = {'format': 'json', 'formatversion': 2}
    base.update(params)
    return get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(base))

def wd(params):
    base = {'format': 'json'}
    base.update(params)
    return get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(base))

def commons(params):
    base = {'format': 'json', 'formatversion': 2}
    base.update(params)
    return get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(base))

def clean(name):
    n = re.sub(r'^(Sir|Lord|Dame|Dr|Professor|Mr\. Justice|Maitre|Jonkheer)\s+', '', name)
    return n.strip()

def slug(name):
    s = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return s

def chunks(xs, n=45):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]

def year(claim):
    try:
        t = claim[0]['mainsnak']['datavalue']['value']['time']
        return int(t[1:5]) * (-1 if t[0] == '-' else 1)
    except Exception:
        return None

def main():
    net = json.load(open(NET))
    people = json.load(open(OUT)) if (os.path.exists(OUT) and not REFRESH) else {}
    names = [n['id'] for n in net['nodes']]

    # 1 + 2. One REST summary call per name (redirects followed): title, description,
    #        extract, thumbnail, Wikidata id. Aliases first, then the cleaned name, then
    #        a title search as a last resort.
    def summary(title):
        url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ', '_'), safe='')
        return get(url, tries=4)
    for name in names:
        rec = people.setdefault(name, {})
        if rec.get('found') is not None and not REFRESH:
            continue
        if name in ALIASES and ALIASES[name] is None:
            rec.update({'title': None, 'how': 'none', 'found': False}); continue
        cands = [ALIASES[name]] if name in ALIASES else [clean(name)]
        got = None
        for t in cands:
            got = summary(t); time.sleep(0.6)
            if got and got.get('type') in ('standard',): break
            got = None
        if not got:
            sr = get('https://en.wikipedia.org/w/rest.php/v1/search/title?' + urllib.parse.urlencode({'q': clean(name), 'limit': 1}))
            time.sleep(0.6)
            pages = (sr or {}).get('pages', [])
            if pages:
                got = summary(pages[0]['title']); time.sleep(0.6)
                if got and got.get('type') != 'standard': got = None
                rec['how'] = 'search'
            else:
                rec['how'] = 'none'
        else:
            rec['how'] = 'alias' if name in ALIASES else 'direct'
        if not got:
            rec.update({'title': cands[0], 'found': False}); print('missing', name); continue
        rec['title'] = cands[0]; rec['found'] = True
        rec['page'] = got.get('title')
        rec['url'] = (got.get('content_urls') or {}).get('desktop', {}).get('page') or 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(got['title'].replace(' ', '_'))
        rec['desc'] = got.get('description')
        rec['extract'] = (got.get('extract') or '')[:400]
        rec['qid'] = got.get('wikibase_item')
        orig = (got.get('originalimage') or {}).get('source')
        rec['image_file'] = re.sub(r'^\d+px-', '', urllib.parse.unquote(orig.rsplit('/', 1)[-1].split('?')[0])) if orig else None
        rec['thumb'] = (got.get('thumbnail') or {}).get('source')
        rec['verified'] = bool(KEYWORDS.search((rec.get('desc') or '') + ' ' + rec['extract']))
        if rec['how'] == 'search' and not rec['verified']:
            rec['found'] = False; rec['qid'] = None; rec['image_file'] = None; print('rejected search hit', name, '->', rec['page']); continue
        print('resolved', name, '->', rec['page'], '|', rec['desc'])
    json.dump(people, open(OUT, 'w'), indent=1, ensure_ascii=False)

    # 3. Wikidata: dates, gender, citizenship, birthplace, image
    qids = sorted({r['qid'] for r in people.values() if r.get('qid')})
    ents = {}
    for batch in chunks(qids):
        res = wd({'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'claims|labels', 'languages': 'en'})
        if res: ents.update(res.get('entities', {}))
        time.sleep(1.0)
    place_ids, country_ids = set(), set()
    for name, rec in people.items():
        e = ents.get(rec.get('qid'))
        if not e: continue
        c = e.get('claims', {})
        rec['born'] = year(c['P569']) if 'P569' in c else None
        rec['died'] = year(c['P570']) if 'P570' in c else None
        try: rec['gender_q'] = c['P21'][0]['mainsnak']['datavalue']['value']['id']
        except Exception: rec['gender_q'] = None
        try: rec['birthplace_q'] = c['P19'][0]['mainsnak']['datavalue']['value']['id']; place_ids.add(rec['birthplace_q'])
        except Exception: rec['birthplace_q'] = None
        rec['citizen_q'] = []
        for cl in c.get('P27', []):
            try: rec['citizen_q'].append(cl['mainsnak']['datavalue']['value']['id']); country_ids.add(rec['citizen_q'][-1])
            except Exception: pass
        if not rec.get('image_file') and 'P18' in c:
            try: rec['image_file'] = c['P18'][0]['mainsnak']['datavalue']['value']
            except Exception: pass
    aux = {}
    for batch in chunks(sorted(place_ids | country_ids)):
        res = wd({'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'claims|labels', 'languages': 'en'})
        if res: aux.update(res.get('entities', {}))
        time.sleep(1.0)
    def label(q):
        return ((aux.get(q) or {}).get('labels', {}).get('en') or {}).get('value')
    def coords(q):
        try:
            v = aux[q]['claims']['P625'][0]['mainsnak']['datavalue']['value']; return [round(v['latitude'], 3), round(v['longitude'], 3)]
        except Exception: return None
    def country_of(q):
        try: return label(aux[q]['claims']['P17'][0]['mainsnak']['datavalue']['value']['id']) or aux[q]['claims']['P17'][0]['mainsnak']['datavalue']['value']['id']
        except Exception: return None
    # countries of birthplaces need their own labels
    extra = set()
    for q in place_ids:
        try: extra.add(aux[q]['claims']['P17'][0]['mainsnak']['datavalue']['value']['id'])
        except Exception: pass
    for batch in chunks(sorted(extra - set(aux))):
        res = wd({'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'labels', 'languages': 'en'})
        if res: aux.update(res.get('entities', {}))
    for name, rec in people.items():
        if rec.get('birthplace_q'):
            rec['birthplace'] = {'name': label(rec['birthplace_q']), 'coords': coords(rec['birthplace_q']), 'country': country_of(rec['birthplace_q'])}
        rec['citizenship'] = [label(q) for q in rec.get('citizen_q', []) if label(q)]
        rec['gender'] = {'Q6581097': 'male', 'Q6581072': 'female'}.get(rec.get('gender_q'), None)

    # 4. Commons metadata + download thumbnails
    for name, rec in people.items():
        if name in OVERRIDES and rec.get('image_file') != OVERRIDES[name]:
            rec['image_file'] = OVERRIDES[name]; rec.pop('portrait', None)
            stale = os.path.join(PORT, slug(name) + '.jpg')
            if os.path.exists(stale): os.remove(stale)
        if name in DROP_PORTRAIT:
            rec['image_file'] = None
        if not rec.get('image_file'):
            rec.pop('portrait', None)
            stale = os.path.join(PORT, slug(name) + '.jpg')
            if os.path.exists(stale): os.remove(stale)
    files = sorted({r['image_file'] for r in people.values() if r.get('image_file')})
    meta = {}
    for batch in chunks(files):
        res = commons({'action': 'query', 'titles': '|'.join('File:' + f for f in batch), 'prop': 'imageinfo',
                       'iiprop': 'url|extmetadata', 'iiurlwidth': 360, 'iiextmetadatafilter': 'Artist|LicenseShortName|Credit|ImageDescription'})
        if not res: continue
        for p in res['query']['pages']:
            ii = (p.get('imageinfo') or [None])[0]
            if ii: meta[p['title'].replace('File:', '')] = ii
        time.sleep(1.0)
    # files that live on English Wikipedia rather than Commons (often non-free: those are skipped)
    local_only = [f for f in files if not (meta.get(f) or meta.get(f.replace('_', ' ')))]
    for batch in chunks(local_only):
        res = wp({'action': 'query', 'titles': '|'.join('File:' + f for f in batch), 'prop': 'imageinfo',
                  'iiprop': 'url|extmetadata', 'iiurlwidth': 360, 'iiextmetadatafilter': 'Artist|LicenseShortName|Credit'})
        if not res: continue
        for p in res['query']['pages']:
            ii = (p.get('imageinfo') or [None])[0]
            if not ii: continue
            lic = re.sub(r'<[^>]+>', '', ((ii.get('extmetadata') or {}).get('LicenseShortName') or {}).get('value') or '')
            if re.search(r'non-free|fair', lic, re.I): print('  skipping non-free', p['title']); continue
            meta[p['title'].replace('File:', '')] = ii
        time.sleep(1.0)
    for name, rec in people.items():
        f = rec.get('image_file')
        if not f: continue
        ii = meta.get(f) or meta.get(f.replace('_', ' '))
        if not ii: continue
        em = ii.get('extmetadata', {})
        strip = lambda s: re.sub(r'<[^>]+>', '', s or '').strip()
        rec['portrait'] = {'file': f, 'page': ii.get('descriptionurl'), 'thumb_url': ii.get('thumburl'),
                           'artist': strip((em.get('Artist') or {}).get('value')), 'license': strip((em.get('LicenseShortName') or {}).get('value'))}
        local = os.path.join(PORT, slug(name) + '.jpg')
        if (not os.path.exists(local) or REFRESH) and ii.get('thumburl'):
            data = get(ii['thumburl'], binary=True)
            if data:
                open(local, 'wb').write(data); print('portrait', name, len(data))
                time.sleep(0.6)
        if os.path.exists(local):
            rec['portrait']['local'] = 'portraits/' + slug(name) + '.jpg'

    json.dump(people, open(OUT, 'w'), indent=1, ensure_ascii=False)
    n_found = sum(1 for r in people.values() if r.get('found'))
    n_port = sum(1 for r in people.values() if r.get('portrait', {}).get('local'))
    n_dates = sum(1 for r in people.values() if r.get('born'))
    n_place = sum(1 for r in people.values() if r.get('birthplace', {}).get('coords'))
    print(f'done: {len(people)} names, {n_found} articles, {n_port} portraits, {n_dates} with dates, {n_place} with birthplaces')

if __name__ == '__main__':
    main()

# Wikidata lists historical countries first (London: Roman Empire); correct them
import subprocess as _sp
_sp.run([sys.executable, '-I', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fix_countries.py')], check=False)
