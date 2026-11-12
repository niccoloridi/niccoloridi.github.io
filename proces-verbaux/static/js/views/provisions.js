import { element } from './chrono.js?v=b1c575ee6d';
import { contextLink } from '../context.js?v=b1c575ee6d';
import { link } from '../state.js?v=b1c575ee6d';


async function get(api, method, id) {
  if (api.provisions?.[method]) return api.provisions[method](id);
  const endpoint = { texts: 'texts', text: `texts/${encodeURIComponent(id)}`,
    version: `versions/${encodeURIComponent(id)}`, cues: 'cues', statute: 'statute',
    lineages: 'lineages', lineage: `lineages/${encodeURIComponent(id)}` }[method];
  const response = await fetch(`/api/provisions/${endpoint}`);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail || message; } catch {  }
    throw new Error(message);
  }
  return response.json();
}

function languages(state) {
  return ['fr', 'en'].includes(state.dl) ? [state.dl] : ['fr', 'en'];
}

function segmentLink(id, meeting, state) {
  if (!id || !meeting || id.startsWith('d01.')) return element('span', id || '');
  return contextLink(id, { meeting, segs: [id] });  // opens the meeting context beside the view
}
function versionLabel(v) {
  return v.flags?.includes('unnumbered') ? (v.heading_en || 'Unnumbered text') : `Art. ${v.num}`;
}

async function sourceMeeting(api, segId) {
  if (api.segment) return (await api.segment(segId)).meeting;
  const page = Number(segId.match(/^s(\d+)\./)?.[1]);
  return page ? fetch(`/api/segments/${encodeURIComponent(segId)}`).then(async response => {
    if (!response.ok) throw new Error(`Source unavailable (${response.status})`);
    return (await response.json()).meeting;
  }) : Promise.resolve(null);
}

export async function render(root, state, api) {
  const host = element('section', undefined, 'provisions-view');
  root.replaceChildren(host);
  host.append(element('h2', 'Statute and provision lineages'));
  const tabs = element('nav', undefined, 'provision-tabs');
  tabs.setAttribute('aria-label', 'Provision views');
  const statuteButton = element('button', 'Statute');
  const stageButton = element('button', 'Stages');
  const cueButton = element('button', 'Cues');
  statuteButton.type = stageButton.type = cueButton.type = 'button';
  tabs.append(statuteButton, stageButton, cueButton);
  const content = element('div');
  host.append(tabs, content);
  let revision = 0;
  const active = token => root.contains(host) && token === revision;

  function select(button) {
    for (const item of [statuteButton, stageButton, cueButton]) item.setAttribute('aria-pressed', String(item === button));
    content.replaceChildren(element('p', 'Loading…', 'status'));
  }

  async function stages() {
    const token = ++revision;
    select(stageButton);
    try {
      const texts = await get(api, 'texts');
      if (!active(token)) return;
      const columns = element('div', undefined, 'provision-stages');
      const detail = element('section', undefined, 'provision-detail');
      detail.setAttribute('aria-live', 'polite');
      detail.append(element('p', 'Choose an article to read its text.'));
      content.replaceChildren(columns, detail);
      let selection = 0;
      async function show(versionId) {
        const selected = ++selection;
        detail.replaceChildren(element('p', 'Loading article…', 'status'));
        try {
          const version = await get(api, 'version', versionId);
          if (!active(token) || selected !== selection) return;
          const head = element('h3');
          if (version.meeting && version.seg_ids?.length) {
            head.append(contextLink(version.text_id, { meeting: version.meeting, segs: version.seg_ids,
              title: `${version.text_id} · ${version.heading_fr}` }), ` · ${version.heading_fr}`);
          } else head.append(`${version.text_id} · ${version.heading_fr}`);
          detail.replaceChildren(head);
          if (version.flags.includes('en_missing')) detail.append(element('p', 'English unavailable in this source.'));
          if (version.flags.includes('unnumbered')) detail.append(element('p', 'Unnumbered proposal in the source.'));
          const body = element('div', undefined, 'provision-paragraphs');
          for (const para of version.paras) {
            const row = element('article', undefined, 'provision-paragraph');
            row.id = para.id;
            for (const lang of languages(state)) {
              const column = element('div', undefined, `provision-language ${lang}`);
              column.lang = lang;
              column.append(element('p', para[lang] || (lang === 'en' ? 'English unavailable.' : '')));
              const sid = lang === 'en' ? para.seg_id_en || para.seg_id : para.seg_id;
              column.append(segmentLink(sid, version.meeting, state));
              row.append(column);
            }
            body.append(row);
          }
          detail.append(body);
          detail.scrollIntoView({ block: 'nearest' });
        } catch (error) {
          if (active(token) && selected === selection) detail.replaceChildren(element('p', error.message, 'status'));
        }
      }
      for (const stage of ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']) {
        const column = element('section', undefined, 'provision-stage');
        column.append(element('h3', stage));
        const groups = new Map();
        for (const text of texts.filter(t => t.stage === stage)) {
          const author = stage === 'S0' ? text.authors.join(' · ') || 'Author unconfirmed' : stage;
          if (!groups.has(author)) {
            const group = element('div');
            if (stage === 'S0') group.append(element('h4', author));
            groups.set(author, group);
            column.append(group);
          }
          const disclosure = element('details');
          disclosure.append(element('summary', `${text.id} · ${text.title} (${text.n_versions})`));
          const list = element('div', undefined, 'provision-articles');
          disclosure.append(list);
          let loaded = false;
          disclosure.addEventListener('toggle', async () => {
            if (!disclosure.open || loaded) return;
            loaded = true;
            list.replaceChildren(element('p', 'Loading…'));
            try {
              const item = await get(api, 'text', text.id);
              if (!active(token)) return;
              list.replaceChildren();
              let chapter = null;
              for (const version of item.versions) {
                if (version.chapter !== chapter && version.chapter !== '0') {
                  const lang = state.dl === 'en' ? 'en' : 'fr';
                  list.append(element('h5', `${version.chapter} · ${version[`chapter_title_${lang}`]}`));
                }
                chapter = version.chapter;
                const button = element('button', (state.dl === 'en' ? version.heading_en : version.heading_fr)
                  || version.heading_fr);
                button.type = 'button';
                button.onclick = () => show(version.id);
                list.append(button);
              }
            } catch (error) {
              loaded = false;
              if (active(token)) list.replaceChildren(element('p', error.message, 'status'));
            }
          });
          groups.get(author).append(disclosure);
        }
        columns.append(column);
      }
    } catch (error) {
      if (active(token)) content.replaceChildren(element('p', error.message, 'status'));
    }
  }

  async function cues() {
    const token = ++revision;
    select(cueButton);
    try {
      const records = await get(api, 'cues');
      if (!active(token)) return;
      const list = element('ol', undefined, 'provision-cues');
      for (const cue of records) {
        const item = element('li');
        item.append(element('p', `${cue.kind} · ${cue.from.num || '?'} → ${cue.to.num || '?'}`));
        const quote = element('blockquote', cue.evidence.quote);
        quote.lang = cue.evidence.lang === 'full' ? 'fr' : cue.evidence.lang;
        item.append(quote);
        if (cue.context) item.append(element('p', cue.context.quote));
        if (cue.meeting) {
          item.append(segmentLink(cue.evidence.seg_id, cue.meeting, state));
          list.append(item);
          continue;
        }
        const source = element('button', `Read source · ${cue.evidence.seg_id}`);
        source.type = 'button';
        source.onclick = async () => {
          source.disabled = true;
          try {
            const meeting = await sourceMeeting(api, cue.evidence.seg_id);
            if (meeting && active(token)) source.replaceWith(segmentLink(cue.evidence.seg_id, meeting, state));
          } catch (error) {
            if (active(token)) item.append(element('p', error.message, 'status'));
          } finally { source.disabled = false; }
        };
        item.append(source);
        list.append(item);
      }
      content.replaceChildren(element('p', `${records.length} explicit source cues`), list);
    } catch (error) {
      if (active(token)) content.replaceChildren(element('p', error.message, 'status'));
    }
  }
  async function statuteView(selected = null) {
    const token = ++revision;
    select(statuteButton);
    try {
      if (selected) {
        const record = await get(api, 'lineage', selected);
        if (active(token)) ladderView(content, record, state);
      } else {
        const articles = await get(api, 'statute');
        const dropped = await get(api, 'lineages');
        if (active(token)) statuteViewRows(content, articles, dropped, state);
      }
    } catch (error) {
      if (active(token)) content.replaceChildren(element('p', error.message, 'status'));
    }
  }
  statuteButton.onclick = () => statuteView();
  stageButton.onclick = stages;
  cueButton.onclick = cues;
  const path = (location.hash || '').slice(1).split('?')[0];
  const selected = path.startsWith('/prov/') ? decodeURIComponent(path.slice(6)) : null;

  if (api.provisions?.texts && !api.provisions.statute && !selected) await stages();
  else await statuteView(selected);
}


function routeAnchor(path, text) {
  const anchor = element('a', text);
  anchor.dataset.route = path;
  anchor.href = link(path);
  return anchor;
}

function miniLadder(versions) {
  const host = element('span', undefined, 'provision-mini-ladder');
  for (const stage of ['S5', 'S4', 'S3', 'S2', 'S1', 'S0']) {
    const group = versions.filter(v => v.stage === stage);
    if (!group.length) continue;
    if (host.children.length) host.append(element('span', ' ← ', 'ladder-arrow'));
    let dot;
    const first = group[0];
    if (stage === 'S0' && first.meeting && first.seg_ids?.length) {
      dot = contextLink([...new Set(group.map(v => v.text_id))].join('/'), { meeting: first.meeting,
        segs: first.seg_ids, title: first.text_id }, `ladder-dot ${stage.toLowerCase()}`);
    } else {
      dot = element('span', [...new Set(group.map(v => stage === 'S0' ? v.text_id : v.num))].join('/'),
        `ladder-dot ${stage.toLowerCase()}`);
    }
    dot.title = `${stage}: ${group.map(v => `${v.text_id} Art. ${v.num}`).join('; ')}`;
    dot.setAttribute('aria-label', dot.title);
    host.append(dot);
  }
  return host;
}

function statuteViewRows(content, articles, lineages, state) {
  const lang = state.dl === 'en' ? 'en' : 'fr';
  const controls = element('div', undefined, 'provision-filters');
  const list = element('div', undefined, 'provision-statute');
  const toggles = {};
  for (const [key, label] of [['dropped_in_committee', 'Dropped in Committee'],
    ['dropped_by_assembly', 'Dropped by Assembly'], ['added_after_committee', 'Added after Committee']]) {
    const wrapper = element('label');
    const input = element('input');
    input.type = 'checkbox';
    input.checked = false;
    toggles[key] = input;
    input.addEventListener('change', refresh);
    wrapper.append(input, element('span', label));
    controls.append(wrapper);
  }
  content.replaceChildren(element('p', `${articles.length} Statute articles · choose an article to trace its wording.`),
    controls, list);
  function row(item, dropped = false) {
    const wrapper = element('article', undefined, 'provision-statute-row');
    const id = item.lineage_id || item.id;
    wrapper.append(routeAnchor(`/prov/${id}`, dropped ? id : `Art. ${item.num}`));
    const label = element('div', undefined, 'provision-row-label');
    for (const language of languages(state)) {
      const text = element('p', item[`label_${language}`] || item[`label_${lang}`] || '');
      text.lang = language;
      label.append(text);
    }
    wrapper.append(label, miniLadder(item.ladder));
    const status = [item.status !== 'survived' ? (item.status || '').replaceAll('_', ' ') : '',
      ...(item.flags || []).filter(f => f === 'review')].filter(Boolean).join(' · ');
    if (status) wrapper.append(element('small', status, 'provision-flag'));
    return wrapper;
  }
  function refresh() {
    list.replaceChildren();
    let chapter = null;
    for (const article of articles) {
      if (toggles.added_after_committee.checked && article.status !== 'added_after_committee') continue;
      if (article.chapter !== chapter) {
        list.append(element('h3', `${article.chapter} · ${article[`chapter_title_${lang}`] || ''}`));
        chapter = article.chapter;
      }
      list.append(row(article));
    }
    for (const status of ['dropped_in_committee', 'dropped_by_assembly']) {
      if (!toggles[status].checked) continue;
      const records = lineages.filter(l => l.status === status);
      list.append(element('h3', `${status.replaceAll('_', ' ')} (${records.length})`));
      for (const record of records) list.append(row(record, true));
    }
  }
  refresh();
}

function ladderView(content, record, state) {
  const layout = element('div', undefined, 'provision-lineage-layout');
  const main = element('div', undefined, 'provision-ladder');
  const rail = element('aside', undefined, 'provision-evidence');
  rail.append(element('h3', 'Possible references'),
    element('p', 'Article references in the proceedings.'));
  const seen = new Set();
  content.replaceChildren(routeAnchor('/prov', '← Statute'),
    element('h3', `${record.id} · ${(record.status || '').replaceAll('_', ' ')}`), layout);
  layout.append(main, rail);
  for (const step of record.ladder) {
    const disclosure = element('details', undefined, 'provision-ladder-step');
    disclosure.open = step.stage === 'S5';
    const summary = element('summary');
    summary.append(`${step.stage} · `);
    if (step.meeting && step.seg_ids?.length) {
      summary.append(contextLink(step.text_id, { meeting: step.meeting, segs: step.seg_ids,
        title: `${step.text_id} · ${versionLabel(step)}` }));
    } else summary.append(step.text_id);
    summary.append(` · ${versionLabel(step)}`);
    disclosure.append(summary);
    for (const lang of languages(state)) {
      const column = element('section', undefined, `provision-language ${lang}`);
      column.lang = lang;
      column.append(element('h4', lang.toUpperCase()), element('p', step[lang] || 'Translation unavailable.'));
      for (const change of step.diffs) {
        const delta = element('div', undefined, 'provision-diff');
        const edge = change.edge;
        delta.append(element('h5', `Changes to ${change.to_ver} · ${edge.relation} · ` +
          `${edge.cue_id ? 'explicit reference' : 'related wording'}`));
        const text = element('p');
        for (const op of change.ops[lang]) {
          text.append(element(op.op === 'insert' ? 'ins' : op.op === 'delete' ? 'del' : 'span', op.full_text));
        }
        delta.append(text);
        if (change.cue) delta.append(element('blockquote', change.cue.evidence.quote));
        column.append(delta);
      }
      disclosure.append(column);
    }
    for (const paragraph of step.paras || []) {
      if (paragraph.seg_id && !seen.has(paragraph.seg_id)) {
        disclosure.append(segmentLink(paragraph.seg_id, step.meeting, state));
        seen.add(paragraph.seg_id);
      }
    }
    main.append(disclosure);
    for (const debate of step.debates) {
      const key = `${debate.seg_id}:${step.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const reference = element('details');
      reference.append(element('summary', `${step.stage} Art. ${step.num} · meeting ${debate.meeting}`),
        segmentLink(debate.seg_id, debate.meeting, state));
      for (const match of debate.matches.filter(m => languages(state).includes(m.lang))) {
        reference.append(element('blockquote', match.quote));
      }
      rail.append(reference);
    }
  }
  rail.append(element('h3', 'Meeting 31 ledger'));
  if (!record.ledger.length) rail.append(element('p', 'No ledger line linked.'));
  for (const line of record.ledger) {
    const item = element('article');
    item.append(element('p', `Article ${line.article} · ${line.outcome || 'recorded'}`),
      element('blockquote', line.quote), segmentLink(line.evidence?.seg_id, 31, state));
    rail.append(item);
  }
  const pending = record.edges.filter(e => e.status === 'review' || e.status === 'rejected');
  if (pending.length) {
    rail.append(element('h3', 'Review and decisions'));
    for (const edge of pending) rail.append(element('p',
      `${edge.from_ver} → ${edge.to_ver}: ${edge.status} `));
  }
}
