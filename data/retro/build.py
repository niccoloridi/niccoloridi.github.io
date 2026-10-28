"""Builds retro/index.html, the Neocities edition of the homepage (niccoloridi.com/retro), from index.html.

The content (welcome, sections, publications, talks, what's new, links) is lifted from
index.html, so the two stay in step; the page itself is one self-contained file with
inline CSS and JS, no canvases and no frameworks. It is linked from nowhere and asks not to be
indexed. Links are made root-absolute so they work from /retro. The dithered pictures in retro/
were made once with Pillow and are not rebuilt here. Run: python3 data/retro/build.py
"""
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()


def grab(pattern, flags=re.S):
    m = re.search(pattern, src, flags)
    if not m:
        raise SystemExit(f'not found in index.html: {pattern[:60]}')
    return m.group(1)


def view_body(key):
    """the concatenated JS string literals of VIEW.<key>.body"""
    block = grab(r"\n\s+" + key + r": \{[^\n]*?body:(.*?)' \},")
    parts = re.findall(r"'((?:[^'\\]|\\.)*)'", block + "'")
    return ''.join(parts).replace("\\'", "'")


welcome = grab(r'(<p class="welcome-copy">.*?</p>)')
guestbook = grab(r'(<p class="guestbook-invite">.*?</p>)')
changes = re.findall(r'<li class="changelog-item">(.*?)</li>', src, re.S)
research_src = grab(r'<div id="research-src" hidden>(.*?)\n    </div>')
research_intro = re.search(r'<p>.*?</p>', research_src, re.S).group(0)
pubs = re.search(r'<ul class="pub-list">(.*?)</ul>', research_src, re.S).group(1)
talks = re.search(r'<ul class="talk-list">(.*?)</ul>', research_src, re.S).group(1)
profile, practice, data = view_body('profile'), view_body('practice'), view_body('data')
data = data.replace('<span class="pub-note">Alpha preview</span>', '<span class="uc">under construction</span>')
foot = grab(r'<footer>(.*?)</footer>')
links = dict((t.strip(), h) for h, t in re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', foot))

# what's new: the list, the ticker and the last-updated date
news_items, ticker = [], []
for c in changes:
    date = re.search(r'<time[^>]*>(.*?)</time>', c).group(1)
    tag = re.search(r'changelog-tag">(.*?)<', c).group(1)
    a = re.search(r'<a href="([^"]+)">(.*?)</a>', c)
    note = re.search(r'changelog-note">(.*?)</span>', c)
    news_items.append(f'<li><span class="nd">{date} · {tag}</span><a href="{a.group(1)}">{a.group(2)}</a>'
                      + (f'<span class="nn">{note.group(1)}</span>' if note else '') + '</li>')
    ticker.append(f'<a href="{a.group(1)}">★ {date}: new {tag.lower()}, {a.group(2)}</a>')
last_updated = re.search(r'<time[^>]*>(.*?)</time>', changes[0]).group(1)

# the essay ring: every data essay linked from the Data section
ring = [(h, re.split(r' — |: ', re.sub('<[^>]+>', '', t))[0].strip())
        for h, t in re.findall(r'<li><a href="([^"]+)">(.*?)</a></li>', data)]
ring_js = json.dumps([('/' + h, t) for h, t in ring], ensure_ascii=False)

BADGES = [  # 88×31 buttons: label, small print, link key, colours
    ('ORCID', 'iD', 'orcid', '#a6ce39', '#2b3a0a'), ('Scholar', 'google', 'scholar', '#4285f4', '#fff'),
    ('SSRN', 'papers', 'ssrn', '#ffd400', '#1a1a1a'), ('KCL', 'king\'s', 'kcl', '#e2231a', '#fff'),
    ('PURE', 'kcl', 'pure', '#7b2cff', '#fff'), ('GitHub', 'code', 'github', '#24292f', '#fff'),
    ('LinkedIn', 'in', 'linkedin', '#0a66c2', '#fff'), ('RSS', 'feed', 'feed', '#ff8a00', '#fff'),
    ('llms', '.txt', 'LLMs, start here: llms.txt', '#00b3a1', '#002b27'), ('guest', 'book', 'guestbook', '#ff4fb0', '#fff'),
]
badges = ''.join(
    f'<a class="b88" href="{links[k]}"{" target=_blank rel=noopener" if links[k].startswith("http") else ""} '
    f'style="--a:{bg};--b:{fg}" title="{html.escape(k)}"><b>{t}</b><small>{s}</small></a>'
    for t, s, k, bg, fg in BADGES if k in links)

WINDOWS = [('welcome', 'welcome.txt - Notepad'), ('profile', 'profile.doc - WordPad'), ('practice', 'practice.doc - WordPad'),
           ('research', 'research.mdb'), ('data', 'data.xls'), ('news', 'whats_new.log')]


def win(key, title, body, status=None, extra=''):
    sb = f'<div class="sb">{status}</div>' if status else ''
    return (f'<section class="win" id="{key}" data-title="{html.escape(title)}" aria-labelledby="t-{key}"{extra}>'
            f'<div class="tb"><span class="ico" aria-hidden="true"></span><h2 id="t-{key}">{html.escape(title)}</h2>'
            f'<button type="button" data-act="min" aria-label="Minimise {html.escape(title)}">_</button>'
            f'<button type="button" data-act="max" aria-label="Maximise {html.escape(title)}">□</button>'
            f'<button type="button" data-act="close" aria-label="Close {html.escape(title)}">×</button></div>'
            f'<div class="bd">{body}</div>{sb}</section>')


def photo(small, big, alt, cls=''):
    return (f'<figure class="pic {cls}"><img src="{small}" data-colour="{big}" alt="{alt}" width="240" height="160">'
            f'<figcaption><button type="button" class="btn sm" data-colour-toggle aria-pressed="false">view in colour</button></figcaption></figure>')


portrait_alt = grab(r'<img src="images/niccolo-portrait.jpg" alt="([^"]+)"')
main = ''.join([
    win('welcome', 'welcome.txt - Notepad',
        '<div class="doc">' + photo('/retro/portrait.png', 'images/niccolo-portrait.jpg', portrait_alt, 'right')
        + welcome + guestbook + '</div>'),
    win('profile', 'profile.doc - WordPad', '<div class="doc">' + profile + '</div>'),
    win('practice', 'practice.doc - WordPad', '<div class="doc">'
        + photo('/retro/icj.png', 'images/N_Ridi_ICJ.jpeg', 'Niccolò Ridi at the International Court of Justice', 'right')
        + practice + '</div>'),
    win('research', 'research.mdb',
        '<div class="doc intro">' + research_intro + '</div>'
        + '<div class="tabs" role="tablist" aria-label="Show">'
        + '<button type="button" role="tab" aria-selected="true" aria-controls="pane-pubs" id="tab-pubs">Publications</button>'
        + '<button type="button" role="tab" aria-selected="false" aria-controls="pane-talks" id="tab-talks">Talks (selection)</button></div>'
        + '<div class="tabpane"><div id="pane-pubs" role="tabpanel" aria-labelledby="tab-pubs">'
        + '<div class="tools" role="group" aria-label="Filter publications">'
        + ''.join(f'<button type="button" class="btn sm" data-f="{f}" aria-pressed="{str(f == "all").lower()}">{l}</button>'
                  for f, l in [('all', 'All'), ('book', 'Books'), ('article', 'Articles'), ('working', 'Working papers'),
                               ('dataset', 'Datasets'), ('code', 'Code'), ('other', 'Other')])
        + '<label class="yr">Year <select id="yr"><option value="all">all</option></select></label></div>'
        + f'<ul class="list pubs">{pubs}</ul></div>'
        + f'<div id="pane-talks" role="tabpanel" aria-labelledby="tab-talks" hidden><ul class="list talks">{talks}</ul></div></div>',
        status='<span id="rcount">&nbsp;</span><span>sorted by year</span>'),
    win('data', 'data.xls', '<div class="doc">' + data + '</div>'),
])

nav = ''.join(f'<li><a href="#{k}" data-open="{k}"><span class="fi" aria-hidden="true"></span>{t.split(" - ")[0]}</a></li>'
              for k, t in WINDOWS)

start_items = (''.join(f'<li><a href="#{k}" data-open="{k}" role="menuitem">{t.split(" - ")[0]}</a></li>' for k, t in WINDOWS)
               + '<li class="sep" role="separator"></li>'
               + ''.join(f'<li><a href="{h}" role="menuitem">{t}</a></li>' for h, t in ring)
               + '<li class="sep" role="separator"></li>'
               + '<li><button type="button" data-open="dos" role="menuitem">MS-DOS Prompt</button></li>'
               + '<li><a href="guestbook/" role="menuitem">Guestbook</a></li>'
               + '<li class="sep" role="separator"></li>'
               + '<li><a href="index.html" role="menuitem">Shut Down… <small>(back to the full site)</small></a></li>')
tasks = ''.join(f'<button type="button" class="task" data-task="{k}">{t.split(" - ")[0]}</button>' for k, t in WINDOWS[:5])

TILE = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E"
        "%3Crect width='72' height='72' fill='%231b0f3a'/%3E"
        "%3Cpath d='M14 9h2v6h-2zM12 11h6v2h-6z' fill='%23ff4fb0'/%3E"
        "%3Cpath d='M51 44h2v6h-2zM49 46h6v2h-6z' fill='%233ee8ff'/%3E"
        "%3Cpath d='M36 22h1v1h-1zM62 14h1v1h-1zM6 52h1v1h-1zM28 62h1v1h-1zM66 60h1v1h-1z' fill='%23fff4d6'/%3E"
        "%3Cpath d='M40 58h1v1h-1zM22 36h1v1h-1z' fill='%23ff8ac8'/%3E%3C/svg%3E")

page = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
for k, v in {'TILE': TILE, 'TICKER': '<span>' + ''.join(ticker) + '</span><span aria-hidden="true">' + ''.join(ticker).replace('<a ', '<a tabindex="-1" ') + '</span>', 'NAV': nav, 'BADGES': badges, 'MAIN': main,
             'NEWS': win('news', 'whats_new.log', '<ul class="news">' + ''.join(news_items) + '</ul>'
                         + f'<p class="feed"><a class="btn sm" href="{links.get("feed", "feed.xml")}">subscribe (RSS)</a></p>'),
             'UPDATED': last_updated, 'RING': ring_js, 'START': start_items, 'TASKS': tasks,
             'MAIL': grab(r'<a href="mailto:([^"]+)"')}.items():
    page = page.replace('%%' + k + '%%', v)
# from /retro, every site-relative link has to start at the root
page = re.sub(r'((?:href|src|data-colour)=")(?!https?:|mailto:|#|/|data:)', r'\1/', page)
size = len(page.encode('utf-8'))
page = page.replace('%%SIZE%%', f'{round(size / 1024)} KB')
open(os.path.join(ROOT, 'retro', 'index.html'), 'w', encoding='utf-8').write(page)
print(f'retro/index.html: {size / 1024:.1f} KB, {len(re.findall("<li data-type", pubs))} publications, '
      f'{len(re.findall("<li", talks))} talks, {len(ring)} ring stops')
