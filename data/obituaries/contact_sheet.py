#!/usr/bin/env python3
"""Write data/obituaries/contact-extra.html: every researched portrait, labelled with
name, confidence and source, shown as square crops (as on the page) and uncropped."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
man = json.load(open(os.path.join(HERE, 'extra-portraits.json')))
only = set(sys.argv[1:])
cells = []
for k, e in man.items():
    if only and k not in only: continue
    cells.append(f'''<div class="c"><img class="sq" src="{e['local']}"><img class="full" src="{e['local']}"><b>{k}</b><i>{e.get('confidence')} · {e.get('source_type')}</i></div>''')
html = '''<html><head><style>body{background:#16140f;color:#ece8df;font:11px -apple-system,sans-serif;margin:0;padding:12px}
.g{display:flex;flex-wrap:wrap;gap:12px}.c{width:150px;text-align:center}.sq{width:96px;height:96px;object-fit:cover;object-position:50% 18%;border-radius:50%;display:block;margin:0 auto 4px}
.full{max-width:150px;max-height:120px;display:block;margin:0 auto 4px;outline:1px solid #444}b{display:block}i{color:#999}</style></head><body><div class="g">''' + ''.join(cells) + '</div></body></html>'
open(os.path.join(HERE, 'contact-extra.html'), 'w').write(html); print(len(cells), 'cells')
