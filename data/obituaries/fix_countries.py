#!/usr/bin/env python3
"""Re-derive the country of each birthplace from Wikidata P17, choosing the
preferred-rank statement, else a normal-rank one with no end date (P582), so that
London is in the United Kingdom and not the Roman Empire."""
import json, os, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'people.json')
UA = 'ObituariesEssayBuild/1.1 (https://niccoloridi.com; site maintenance script) python-urllib'
def wd(ids, props):
    url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(ids), 'props': props, 'languages': 'en', 'format': 'json'})
    for i in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40)).get('entities', {})
        except Exception: time.sleep(5 * (i + 1))
    return {}
def current(claims):
    ok = [c for c in claims if c.get('rank') != 'deprecated' and c['mainsnak'].get('datavalue')]
    pref = [c for c in ok if c.get('rank') == 'preferred']
    if pref: return pref[0]['mainsnak']['datavalue']['value']['id']
    open_ = [c for c in ok if 'P582' not in c.get('qualifiers', {})]
    return (open_ or ok or [None])[0]['mainsnak']['datavalue']['value']['id'] if (open_ or ok) else None
people = json.load(open(OUT))
# hand corrections where Wikidata's birthplace item is a building, a metro area or unlabelled
PLACE_FIX = {
    'John Westlake': {'name': 'Lostwithiel', 'coords': [50.407, -4.668], 'country': 'United Kingdom'},
    'Woodrow Wilson': {'name': 'Staunton', 'coords': [38.15, -79.072], 'country': 'United States'},
    "Jean d'Aspremont": {'name': 'Brussels', 'coords': [50.847, 4.357], 'country': 'Belgium'},
}
places = sorted({r['birthplace_q'] for r in people.values() if r.get('birthplace_q')})
pl = {}
for i in range(0, len(places), 45):
    pl.update(wd(places[i:i + 45], 'claims')); time.sleep(1)
cq = {q: current(e.get('claims', {}).get('P17', [])) for q, e in pl.items()}
names = {}
ids = sorted({c for c in cq.values() if c})
for i in range(0, len(ids), 45):
    for q, e in wd(ids[i:i + 45], 'labels').items(): names[q] = e.get('labels', {}).get('en', {}).get('value')
    time.sleep(1)
changed = []
for n, r in people.items():
    q = r.get('birthplace_q')
    if not q or not r.get('birthplace') or r.get('birthplace_fixed'): continue
    new = names.get(cq.get(q))
    if new and new != r['birthplace'].get('country'):
        changed.append((n, r['birthplace'].get('name'), r['birthplace'].get('country'), new)); r['birthplace']['country'] = new
for n, fix in PLACE_FIX.items():
    if n in people:
        people[n]['birthplace'] = dict(fix); people[n]['birthplace_fixed'] = True
json.dump(people, open(OUT, 'w'), indent=1, ensure_ascii=False)
for c in changed: print(f'  {c[0]}: {c[1]}  {c[2]} -> {c[3]}')
print(len(changed), 'countries corrected')
