(function (host) {
  'use strict';
  const encode = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const key = params => Object.keys(params).sort().map(k => `${encode(k)}=${encode(params[k])}`).join('&');
  const apiURL = input => new URL(typeof input === 'string' ? input : input.url || String(input),
    host.location ? host.location.href : 'http://localhost/proces-verbaux/');
  function mapApi(input, cfg) {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input), 'http://localhost/');
    const path = url.pathname, q = url.searchParams;
    const page = path.match(/^\/api\/pages\/(?:(d01)\/)?(\d+)\.jpg$/);
    if (page) return `${cfg.pages}/${page[1] || q.get('doc') === 'd01' ? 'd01/' : ''}p${page[2].padStart(4, '0')}.webp`;
    if (path.startsWith('/api/search/similar/')) return `${cfg.data}/similar/${path.split('/').pop()}.json`;
    if (path === '/api/search' || path === '/api/thesaurus/search') return null;
    if (!/^\/api\/(meetings(?:\/[^/]+)?|segments\/[^/]+|topics\/(?:tree|[^/]+)|speakers\/(?:persons(?:\/[^/]+)?|meetings\/\d+\/turns)|provisions\/(?:texts(?:\/[^/]+)?|versions\/[^/]+|cues|statute|lineages(?:\/[^/]+)?)|documents(?:\/[^/]+)?|thesaurus\/(?:tree|concepts\/[^/]+)|positions\/(?:meetings\/\d+\/debate|propositions\/[^/]+|persons\/[^/]+\/positions|compare|coalitions))$/.test(path)) return null;
    let suffix = '';
    if (path.startsWith('/api/positions/')) {
      const requested = q.get('layer') || 'primary';
      const params = {layer: ({recorded: 'primary', uncertain: '+disputed', vote: 'votes-only'})[requested] || requested};
      if (path.endsWith('/compare')) { params.a = q.get('a') || ''; params.b = q.get('b') || ''; }
      if (path.endsWith('/coalitions')) params.scope = q.get('scope') || 'all';
      suffix = '/_q/' + encode(key(params));
    }
    return `${cfg.data}/${path.slice(5)}${suffix}.json`;
  }
  function inMeeting(row, value) {
    if (!value) return true;
    const match = /^(\d+)(?:-(\d+))?$/.exec(value);
    return !!match && row.meeting != null && row.meeting >= Number(match[1]) && row.meeting <= Number(match[2] || match[1]);
  }
  function filterRows(data, params) {
    if (!Array.isArray(data)) return data;
    return data.filter(row => [...params].every(([name, value]) => {
      if (!value || ['q', 'mode', 'lang', 'k', 'layer', 'scope', 'a', 'b'].includes(name)) return true;
      if (name === 'm') return inMeeting(row, value);
      if (name === 'author') return (row.authors || []).includes(value);
      if (['kind', 'phase', 'stage', 'status', 'doc', 'seg_id', 'issue'].includes(name)) return String(row[name === 'issue' ? 'issue_id' : name]) === value;
      return true;
    }));
  }
  const fold = term => String(term).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escapeHTML = text => String(text || '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function highlight(text, query) {
    const words = fold(query).match(/[\p{L}\p{N}]+/gu) || [];
    const needle = fold(text), spans = [];
    for (const word of words) {
      let at = 0;
      while (word && (at = needle.indexOf(word, at)) !== -1) { spans.push([at, at + word.length]); at += word.length; }
    }
    spans.sort((a, b) => a[0] - b[0]);
    let out = '', cursor = 0;
    for (const [start, end] of spans) {
      if (start < cursor) continue;
      out += escapeHTML(text.slice(cursor, start)) + '<mark>' + escapeHTML(text.slice(start, end)) + '</mark>';
      cursor = end;
    }
    return out + escapeHTML(text.slice(cursor));
  }
  function install(cfg) {
    const original = host.fetch.bind(host), cache = new Map(), corpora = new Map();
    const response = (value, status = 200) => new Response(JSON.stringify(value), {
      status, headers: {'Content-Type': 'application/json; charset=utf-8'}
    });
    async function load(url) {
      if (!cache.has(url)) cache.set(url, original(url).then(r => {
        if (!r.ok) throw Object.assign(new Error('Not available in this edition'), {status: 404});
        return r.json();
      }).catch(error => { cache.delete(url); throw error; }));
      return cache.get(url);
    }
    let library;
    async function miniSearch() {
      if (host.MiniSearch) return host.MiniSearch;
      if (!library) library = new Promise((resolve, reject) => {
        const script = host.document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/minisearch@7.1.0/dist/umd/index.min.js';
        script.onload = () => resolve(host.MiniSearch);
        script.onerror = () => { library = null; reject(new Error('Search could not be loaded. Please try again.')); };
        host.document.head.append(script);
      });
      return library;
    }
    async function corpus(lang) {
      if (!corpora.has(lang)) corpora.set(lang, (async () => {
        const payload = await load(`${cfg.data}/search/${lang}.json`);
        const docs = payload.docs.map(row => ({...row, text: row[`text_${lang}`], snippet: row[`text_${lang}`].slice(0, 240)}));
        return {docs, lookup: new Map(docs.map(row => [row.id, row]))};
      })());
      return corpora.get(lang);
    }
    const indexes = new Map();
    async function index(lang) {
      if (!indexes.has(lang)) indexes.set(lang, (async () => {
        const [MiniSearch, data] = await Promise.all([miniSearch(), corpus(lang)]);
        const result = new MiniSearch({fields: ['text'], storeFields: ['id', 'meeting', 'snippet'], processTerm: fold});
        result.addAll(data.docs);
        return result;
      })());
      return indexes.get(lang);
    }
    async function hydrate(sid, match, query = '') {
      const [fr, en] = await Promise.all([corpus('fr'), corpus('en')]);
      const row = fr.lookup.get(sid) || en.lookup.get(sid);
      if (!row) return null;
      function snippet(data) {
        const text = data.lookup.get(sid)?.text || '', terms = fold(query).match(/[\p{L}\p{N}]+/gu) || [];
        const positions = terms.map(t => fold(text).indexOf(t)).filter(n => n >= 0);
        const at = positions.length ? Math.max(0, Math.min(...positions) - 70) : 0;
        return highlight(text.slice(at, at + 240), query);
      }
      return {seg_id: sid, meeting: row.meeting, doc: row.doc, pdf_from: row.pdf_from, pdf_to: row.pdf_to,
        page_markers: row.page_markers, match, snippet_fr: snippet(fr), snippet_en: snippet(en)};
    }
    async function related(sid, params) {
      const bundle = await load(`${cfg.data}/similar/${encode(sid)}.json`);
      const hits = await Promise.all((bundle[params.get('lang') || 'both'] || []).map(row => hydrate(row.seg_id, 'related')));
      return filterRows(hits.filter(Boolean), params).slice(0, Math.min(Number(params.get('k')) || 10, 10));
    }
    async function search(params) {
      const query = (params.get('q') || '').trim();
      if (!query) return [];
      if (query.length > 2000) throw Object.assign(new Error('Query is too long'), {status: 422});
      const language = params.get('lang') || 'both', mode = params.get('mode') || 'hybrid';
      if (!['both', 'fr', 'en'].includes(language) || !['exact', 'hybrid', 'semantic'].includes(mode)) throw Object.assign(new Error('Invalid search options'), {status: 422});
      const langs = language === 'both' ? ['fr', 'en'] : [language], found = new Map();
      for (const lang of langs) {
        const engine = await index(lang);
        for (const hit of engine.search(query, {prefix: true, fuzzy: 0.2})) {
          const old = found.get(hit.id);
          found.set(hit.id, {weight: Math.max(old?.weight || 0, hit.score), match: 'lexical'});
        }
      }
      if (mode !== 'exact') {
        const seeds = [...found].sort((a, b) => b[1].weight - a[1].weight).slice(0, 10);
        for (const [sid, seed] of seeds) {
          const bundle = await load(`${cfg.data}/similar/${encode(sid)}.json`);
          for (const [i, row] of (bundle[language] || []).entries()) {
            const old = found.get(row.seg_id), bonus = seed.weight * 0.2 / (i + 1);
            found.set(row.seg_id, {weight: (old?.weight || 0) + bonus,
              match: old && old.match !== 'related' ? 'both' : 'related'});
          }
        }
      }
      const ordered = [...found].sort((a, b) => b[1].weight - a[1].weight);
      const hits = await Promise.all(ordered.map(([sid, value]) => hydrate(sid, value.match, query)));
      return filterRows(hits.filter(Boolean), params).slice(0, Math.max(1, Math.min(Number(params.get('k')) || 50, 200)));
    }
    function countSelection(params) {
      return params.get('source') === 'printed' ? 'printed' : params.get('include_printed') === 'true' ? 'all' : 'edition';
    }
    function marked(text, evidence, lang) {
      const spans = evidence.filter(e => e.lang === lang && Number.isInteger(e.start) && Number.isInteger(e.end))
        .map(e => [e.start, e.end]).filter(([a, b]) => a >= 0 && a < b && b <= Array.from(text).length)
        .sort((a, b) => a[0] - b[0]);
      const merged = [], chars = Array.from(text);
      for (const span of spans) {
        const last = merged[merged.length - 1];
        if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]); else merged.push([...span]);
      }
      let out = '', at = 0;
      for (const [a, b] of merged) { out += escapeHTML(chars.slice(at, a).join('')) + '<mark>' + escapeHTML(chars.slice(a, b).join('')) + '</mark>'; at = b; }
      return out + escapeHTML(chars.slice(at).join(''));
    }
    function selectedEvidence(passage, params) {
      const printedOnly = params.get('source') === 'printed', printed = params.get('include_printed') === 'true';
      const evidence = (passage.evidence || []).filter(e => printedOnly ? e.printed === 'Index 1920' : printed || e.printed !== 'Index 1920');
      if (!evidence.length) return null;
      const highlighted = Object.fromEntries(Object.entries(passage.texts || {}).map(([lang, text]) => [lang, marked(text, evidence, lang === 'full_text' ? 'full' : lang)]));
      return {...passage, evidence, highlighted, sources: [...new Set(evidence.map(e => e.printed === 'Index 1920' ? 'Index 1920' : 'Edition'))]};
    }
    async function concept(path, params) {
      const base = await load(`${cfg.data}/${path.slice(5)}/all.json`), all = [base];
      if (params.get('descendants') === 'true') {
        const labels = await load(`${cfg.data}/thesaurus/labels.json`), ids = new Set([base.id]);
        let changed = true;
        while (changed) { changed = false; for (const row of labels) if (!ids.has(row.id) && (row.broader || []).some(p => ids.has(p))) { ids.add(row.id); changed = true; } }
        all.push(...await Promise.all([...ids].filter(id => id !== base.id).map(id => load(`${cfg.data}/thesaurus/concepts/${encode(id)}/all.json`))));
      }
      const passages = new Map(), histogram = new Map(), members = new Map();
      for (const item of all) for (const group of item.groups || []) for (const p of group.passages) {
        const selected = selectedEvidence(p, params);
        if (!selected) continue;
        if (passages.has(p.seg_id)) {
          const old = passages.get(p.seg_id);
          old.evidence.push(...selected.evidence);
          old.sources = [...new Set([...old.sources, ...selected.sources])];
        } else passages.set(p.seg_id, {...selected, section: group.section});
      }
      const groups = new Map();
      for (const p of passages.values()) {
        const id = p.section;
        if (!groups.has(id)) groups.set(id, {section: id, meeting: p.meeting, passages: []});
        groups.get(id).passages.push(p);
        histogram.set(p.meeting, (histogram.get(p.meeting) || 0) + 1);
        const speaker = p.speaker;
        if (speaker?.speaker_id && (!speaker.role || speaker.role === 'member')) {
          const old = members.get(speaker.speaker_id) || {id: speaker.speaker_id, name: speaker.name, count: 0};
          old.count++; members.set(old.id, old);
        }
      }
      const counts = await load(`${cfg.data}/thesaurus/counts.json`);
      const totals = counts[countSelection(params)]?.[base.id] || {};
      return {...base, ...totals, groups: [...groups.values()].sort((a, b) => (a.meeting ?? 999) - (b.meeting ?? 999)),
        passage_count: passages.size, includes_descendants: params.get('descendants') === 'true',
        histogram: Array.from({length: 35}, (_, i) => ({meeting: i + 1, count: histogram.get(i + 1) || 0})),
        members: [...members.values()].sort((a, b) => b.count - a.count)};
    }
    async function thesaurusTree(params) {
      const tree = await load(`${cfg.data}/thesaurus/tree.json`);
      if (!params.has('include_printed') && !params.has('source')) return tree;
      const counts = await load(`${cfg.data}/thesaurus/counts.json`), totals = counts[countSelection(params)] || {};
      function branch(node) { return {...node, ...totals[node.id], children: (node.children || []).map(branch)}; }
      return {...tree, facets: tree.facets.map(branch), nodes: tree.nodes.map(row => ({...row, ...totals[row.id]}))};
    }

    host.fetch = async function (input, options) {
      const url = apiURL(input);
      if (host.location && url.origin !== host.location.origin || !url.pathname.startsWith('/api/')) return original(input, options);
      if ((options?.method || input?.method || 'GET').toUpperCase() !== 'GET') return response({detail: 'Not available in this edition'}, 404);
      const path = url.pathname, params = url.searchParams;
      if ((options?.signal || input?.signal)?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        if (path === '/api/search') return response(await search(params));
        if (path.startsWith('/api/search/similar/')) return response(await related(decodeURIComponent(path.split('/').pop()), params));
        if (path === '/api/thesaurus/search') {
          const query = (params.get('q') || '').trim(), needle = fold(query);
          if (!query) return response({concepts: [], passages: [], warning: null});
          const labels = await load(`${cfg.data}/thesaurus/labels.json`);
          const concepts = labels.filter(row => [row.pref_fr, row.pref_en, ...(row.label_alt_fr || []), ...(row.label_alt_en || [])].some(label => fold(label || '').includes(needle))).slice(0, 50);
          const passageParams = new URLSearchParams({q: query, k: '5', mode: 'exact'});
          return response({concepts, passages: params.get('passages') === 'false' ? [] : await search(passageParams), warning: null});
        }
        if (path.startsWith('/api/thesaurus/concepts/')) return response(await concept(path, params));
        if (path === '/api/thesaurus/tree') return response(await thesaurusTree(params));
        const mapped = mapApi(input, cfg);
        if (!mapped) return response({detail: 'Not available in this edition'}, 404);
        if (/\.webp$/.test(mapped)) return original(mapped, options);
        let data = filterRows(await load(mapped), params);
        if (path.endsWith('/debate') && params.get('issue')) data = {...data, issues: data.issues.filter(group => group.issue.id === params.get('issue'))};
        return response(data);
      } catch (error) { return response({detail: error.message || 'Not available in this edition'}, error.status || 503); }
    };
    return {search, related, concept};
  }
  const exported = {mapApi, filterRows, fold, highlight, install};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  host.PVStatic = exported;
  if (host.PV_STATIC && host.fetch) install(host.PV_STATIC);
})(typeof window !== 'undefined' ? window : globalThis);
