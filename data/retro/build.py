"""Builds retro/index.html, the Niccolo Ridi at Dusk edition of the homepage (niccoloridi.com/retro), from index.html.
The content is lifted from index.html, so run this and commit after homepage changes. Pictures in retro/ are made once
and not rebuilt here. It is reached by long-pressing the theme button (retro-door.js) and asks not to be indexed.
Run: python3 data/retro/build.py"""
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()


def grab(pattern):
    m = re.search(pattern, src, re.S)
    if not m:
        raise SystemExit(f'not found: {pattern[:60]}')
    return m.group(1)


def view_body(key):
    block = grab(r"\n\s+" + key + r": \{[^\n]*?body:(.*?)' \},")
    return ''.join(re.findall(r"'((?:[^'\\]|\\.)*)'", block + "'")).replace("\\'", "'")


data = view_body('data').replace('<span class="pub-note">Alpha preview</span>', '<span class="uc">under construction</span>')
research = grab(r'<div id="research-src" hidden>(.*?)\n    </div>')
changes = re.findall(r'<li class="changelog-item">(.*?)</li>', src, re.S)
news = ''
for c in changes:
    d = re.search(r'<time[^>]*>(.*?)</time>', c).group(1)
    a = re.search(r'<a href="[^"]+">.*?</a>', c).group(0)
    n = re.search(r'changelog-note">(.*?)</span>', c)
    news += f'<li><span class="nd">{d}</span> {a}' + (f' <span class="nn">{n.group(1)}</span>' if n else '') + '</li>'
ring = [(('/' + h), re.split(r' — |: ', re.sub('<[^>]+>', '', t))[0].strip())
        for h, t in re.findall(r'<li><a href="([^"]+)">(.*?)</a></li>', data)]
foot = grab(r'<footer>(.*?)</footer>')
links = ''.join(f'<li><a href="{h}">{t.strip()}</a></li>' for h, t in re.findall(r'<a href="(http[^"]+)"[^>]*>([^<]+)</a>', foot)
                if 'llms' not in h)
FILTER = ('<form class="filt" onsubmit="return false"><label>show <select id="ftype"><option value="all">everything</option>'
          '<option value="book">books</option><option value="article">articles</option><option value="working">working papers</option>'
          '<option value="dataset">datasets</option><option value="code">code</option><option value="other">other</option></select></label> '
          '<label>from <select id="fyear"><option value="all">all years</option></select></label> <span id="fcount"></span></form>')
SCRIPT = open(os.path.join(HERE, 'shared.js'), encoding='utf-8').read()
parts = {
    'WELCOME': grab(r'(<p class="welcome-copy">.*?</p>)'), 'GUEST': grab(r'(<p class="guestbook-invite">.*?</p>)'),
    'PROFILE': view_body('profile'), 'PRACTICE': view_body('practice'), 'DATA': data,
    'RINTRO': re.search(r'<p>.*?</p>', research, re.S).group(0), 'FILTER': FILTER,
    'PUBS': '<ul class="pub-list">' + re.search(r'<ul class="pub-list">(.*?)</ul>', research, re.S).group(1) + '</ul>',
    'TALKS': '<ul class="talk-list">' + re.search(r'<ul class="talk-list">(.*?)</ul>', research, re.S).group(1) + '</ul>',
    'NEWS': f'<ul class="news">{news}</ul>', 'UPDATED': re.search(r'<time[^>]*>(.*?)</time>', changes[0]).group(1),
    'MAIL': grab(r'<a href="mailto:([^"]+)"'), 'LINKS': f'<ul class="links">{links}</ul>', 'ALT': grab(r'<img src="images/niccolo-portrait.jpg" alt="([^"]+)"'),
    'SCRIPT': SCRIPT.replace('%%RING%%', json.dumps(ring, ensure_ascii=False)),
    'HEAD': '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">',
}

def about(path):
    """the first sentence of a page's own meta description"""
    s = open(os.path.join(ROOT, path), encoding='utf-8', errors='ignore').read()
    d = html.unescape(re.search(r'<meta name="description"\s+content="(.*?)"', s, re.S).group(1)).strip()
    return re.split(r'(?<=[a-z0-9)])\. ', d)[0].rstrip('.').replace('ILC Atlas: an', 'An') + '.'


def row(icon, title, desc, href, ext=False):
    return (f'<a class="row" href="{href}"' + (' target="_blank" rel="noopener"' if ext else '') + f'><img src="/retro-lab/i2-{icon}.png" alt=""><b>{title}</b><span>{desc}</span></a>')


fl = {t.strip(): h for h, t in re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', foot)}
ESSAYS = [('The Invisible College, Mapped', 'obituaries.html'), ('The Law of Citations', 'unsc-citations.html'), ('GenAI as an International Lawyer', 'jessup-ai.html'), ('Custom in the Making', 'cil-formation.html')]
TOOLS = [('echr-py', 'echr-py.html', 'echr-py.html'), ('cjeu-py', 'cjeu-py.html', 'cjeu-py.html'), ('ILC Atlas', 'ilc-atlas/', 'ilc-atlas/index.html'), ('Agentic Law Journal', 'agentic-law-journal/', 'agentic-law-journal/index.html'), ('The Treaty', 'treaties/', 'treaties/index.html')]
ELSE = [('Google Scholar', 'scholar', 'Citations and papers.'), ('SSRN', 'ssrn', 'Working papers.'), ('ORCID', 'orcid', 'The researcher record.'), ('King\'s Pure', 'pure', 'The research portal at King\'s.'), ('King\'s College London', 'kcl', 'Staff page.'), ('GitHub', 'github', 'Code.'), ('LinkedIn', 'linkedin', 'Professional profile.')]
parts['DATAINTRO'] = re.search(r'<p>.*?</p>', data, re.S).group(0)
parts['ESSAYROWS'] = ''.join(row('pen', t, about(h), h) for t, h in ESSAYS)
parts['ELSEROWS'] = ''.join(row('globe', t, d, fl[k], True) for t, k, d in ELSE)
ICONS = [('profile', 'person', 'Profile'), ('practice', 'court', 'Practice'), ('research', 'book', 'Research'), ('talks', 'mic', 'Talks'), ('data', 'chart', 'Data'),
         ('essays', 'pen', 'Essays'), ('tools', 'wrench', 'Tools'), ('news', 'news', 'What\'s new'), ('elsewhere', 'globe', 'Elsewhere'), ('guest', 'letter', 'Guestbook')]
parts['ICONS'] = ''.join(f'<a href="#{k}" data-card="{k}"><img src="/retro-lab/i2-{i}.png" alt="">{t}</a>' for k, i, t in ICONS)
l = lambda h, t, x=False: f'<li><a href="{h}"' + (' target="_blank" rel="noopener"' if x else '') + f'>{t}</a></li>'
TOOLS = [('echr-py', 'echr-py.html', 'echr-py.html'), ('cjeu-py', 'cjeu-py.html', 'cjeu-py.html'), ('ILC Atlas', 'ilc-atlas/', 'ilc-atlas/index.html')]
parts['TOOLROWS'] = ''.join(row('wrench', t, about(p_), h) for t, h, p_ in TOOLS) + row('wrench', 'ICJeocities', 'A citation-analytics platform for international courts and tribunals. Private beta, by invitation.', 'https://icjeocities.org', True)
parts['AGENTROWS'] = (row('news', 'llms.txt', 'Start here: the site, described for language models.', 'llms.txt') + row('court', 'The Treaty', about('treaties/index.html'), 'treaties/')
                      + row('book', 'Agentic Law Journal', about('agentic-law-journal/index.html'), 'agentic-law-journal/') + row('letter', 'The guestbook', about('guestbook/index.html'), 'guestbook/'))
parts['SITEROWS'] = (row('letter', 'Sign the guestbook', 'For humans with endless patience, too.', 'guestbook/') + row('news', 'Feed', 'What\'s new, by RSS.', 'feed.xml')
                     + row('letter', 'Write to me', parts['MAIL'], 'mailto:' + parts['MAIL']) + row('person', 'The other website', 'The full homepage.', '/'))
newsrows, tick = '', []
for ch in changes:
    d = re.search(r'<time[^>]*>(.*?)</time>', ch).group(1); tg = re.search(r'changelog-tag">(.*?)<', ch).group(1)
    a_ = re.search(r'<a href="([^"]+)">(.*?)</a>', ch); n = re.search(r'changelog-note">(.*?)</span>', ch)
    newsrows += f'<div class="nrow"><time>{d}</time><span class="tag">{tg}</span><div><a href="{a_.group(1)}">{a_.group(2)}</a>' + (f'<span class="nn">{n.group(1)}</span>' if n else '') + '</div></div>'
    tick.append(f'<a href="{a_.group(1)}">★ {d}: {a_.group(2)}</a>')
parts['NEWSROWS'] = newsrows
MQ = '<div class="mq"><div class="mq-t"><span>' + ''.join(tick) + '</span><span aria-hidden="true">' + ''.join(tick).replace('<a ', '<a tabindex="-1" ') + '</span></div></div>'
parts['RING2'] = json.dumps([(t, '/' + h, about(h)) for t, h in ESSAYS], ensure_ascii=False)
parts['JUKE'] = ''  # the player waits for its music: juke.js is kept here, ready to be included again
c2 = lambda k, t, ex='': f'<li><a href="#{k}" data-card="{k}"{ex}>{t}</a></li>'
SEP = '<li class="sep" role="separator"></li>'
MIX = [('Profile', c2('profile', 'About') + c2('profile', 'Positions and affiliations', ' data-at="positions"') + c2('profile', 'Education', ' data-at="education"')),
       ('Practice', c2('practice', 'Overview') + c2('practice', 'Recent matters', ' data-at="recent"') + SEP + l('mailto:' + parts['MAIL'], 'Get in touch')),
       ('Research', c2('research', 'All publications', ' data-filter="all"') + c2('research', 'Books', ' data-filter="book"') + c2('research', 'Articles', ' data-filter="article"') + c2('research', 'Working papers', ' data-filter="working"')
        + c2('research', 'Datasets', ' data-filter="dataset"') + c2('research', 'Code', ' data-filter="code"') + SEP + c2('talks', 'Talks')),
       ('Data', c2('data', 'Overview') + SEP + ''.join(l(h, t) for t, h in ESSAYS) + SEP + c2('tools', 'Tools')),
       ('Elsewhere', ''.join(l(fl[k], t, True) for t, k, _ in ELSE) + SEP + c2('elsewhere', 'All on one card')),
       ('Agents', l('llms.txt', 'llms.txt: start here') + l('treaties/', 'The Treaty') + l('agentic-law-journal/', 'Agentic Law Journal') + l('guestbook/', 'The guestbook') + SEP + c2('agents', 'For agents'))]
MB = ('<nav class="mbar" aria-label="Menu"><a class="mlink mhome" href="#home" data-card="home">Niccol&ograve; Ridi</a>' + ''.join(f'<div><button type="button" aria-expanded="false">{n}</button><ul hidden>{m}</ul></div>' for n, m in MIX)
      + '<a class="mlink" href="#news" data-card="news">What\'s new</a><span class="clock"></span></nav>')
JB = ('<section class="mini" id="juke"><h2><span class="ml">Jukebox</span></h2><div class="in"><p class="jname">Music to come</p><div class="jrow" aria-hidden="true">'
      + ''.join(f'<button type="button" disabled tabindex="-1">{g}</button>' for g in ('|◄', '◄◄', '▶', '►►', '►|')) + '</div></div></section>')
PL = ('<aside class="pile"><section class="mini"><h2><a href="#news" data-card="news">What\'s new</a></h2>' + MQ + '<p class="mqmore"><a href="#news" data-card="news">read it all</a></p></section>' + JB
      + '<section class="mini"><h2><a href="#essays" data-card="essays">Essay ring</a></h2><div class="in"><p class="rname" id="rn"></p><p class="rdesc" id="rd"></p><div class="rbtns"><button type="button" data-r="-1" aria-label="Previous essay">◄</button><button type="button" data-r="0">random</button><button type="button" data-r="1" aria-label="Next essay">►</button><a id="rg" href="#">visit</a></div></div></section></aside>')
tmpl = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
page = tmpl.replace('%%VARIANT%%', 'v-mix').replace('%%NAVTOP%%', MB).replace('%%NAVSIDE%%', PL).replace('%%STRIP%%', f'<div class="strip" aria-label="What\'s new">{MQ}</div>')
for k, v in parts.items():
    page = page.replace(f'%%{k}%%', v)
page = re.sub(r'((?:href|src)=")(?!https?:|mailto:|#|/|data:)', r'\1/', page)
page = page.replace('&mdash;', '&ndash;').replace('—', '–')
page = page.replace('/retro-lab/', '/retro/')
open(os.path.join(ROOT, 'retro', 'index.html'), 'w', encoding='utf-8').write(page)
print(f'retro/index.html {len(page.encode()) / 1024:.0f} KB, em dashes left: {page.count(chr(8212))}')