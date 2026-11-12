
import { link } from '../state.js?v=b1c575ee6d';

const MEMBERS = [
  ['adatci', 'Mineichirō Adatci', 'Japon', 'Japan'],
  ['altamira', 'Rafael Altamira', 'Espagne', 'Spain'],
  ['descamps', 'Baron Édouard Descamps', 'Belgique — Président', 'Belgium — President'],
  ['fernandes', 'Raul Fernandes', 'Brésil — à partir de la 9e séance', 'Brazil — from the 9th meeting'],
  ['hagerup', 'Francis Hagerup', 'Norvège', 'Norway'],
  ['lapradelle', 'Albert de Lapradelle', 'France', 'France'],
  ['loder', 'Bernard C. J. Loder', 'Pays-Bas — Vice-Président', 'Netherlands — Vice-President'],
  ['phillimore', 'Lord Phillimore', 'Grande-Bretagne', 'Great Britain'],
  ['ricci-busatti', 'Arturo Ricci-Busatti', 'Italie', 'Italy'],
  ['root', 'Elihu Root', 'États-Unis', 'United States'],
];

const T = {
  en: {
    kicker: 'About this edition',
    title: 'Procès-verbaux of the Proceedings of the Advisory Committee of Jurists',
    dates: 'The Hague, 16 June – 24 July 1920',
    editor: 'Digital edition by',
    advisoryH: 'Advisory',
    advisory: 'This edition is a work in progress. The French and English texts were transcribed from the printed volume of 1920 and are still being proofread: they may contain errors of transcription, layout or pairing. Please check the facsimile of the printed page before quoting.',
    volumeH: 'The volume',
    volume: [
      'In February 1920 the Council of the League of Nations, acting under Article 14 of the Covenant, appointed a committee of jurists to prepare plans for the establishment of a Permanent Court of International Justice. The Committee met at the Peace Palace in The Hague from 16 June to 24 July 1920, held thirty-five meetings, and adopted a draft-scheme with a report to the Council. Amended by the Council and the Assembly, it was approved by the Assembly as the Statute of the Court on 13 December 1920.',
      'The minutes were printed in French and English in parallel columns. As the preface explains, all members spoke French except Mr. Root: the French text is the original, and the English a translation, except for Mr. Root’s speeches and remarks. Annexes (draft plans, proposals, amendments, notes and speeches) follow the minutes of the meeting at which they were tabled.',
    ],
    membersH: 'The Committee',
    secretariat: 'Secretariat: Dionisio Anzilotti (Secretary-General) and Åke Hammarskjöld. James Brown Scott attended as legal adviser to Mr. Root. Clóvis Beviláqua (Brazil) was appointed but did not attend.',
    offersH: 'What the edition offers',
    offers: [
      ['Chronological', '/m/1', 'every meeting and annex, French and English side by side, with the facsimile of the printed page beside the text.'],
      ['Documents', '/docs', 'the annexes, speeches and interventions, by kind, author and meeting.'],
      ['Topics', '/topic', 'the analytical index: a bilingual thesaurus of the questions debated, with the passages where they arise; the index printed in 1920 is included as a separate layer.'],
      ['Search', '/search', 'the full text in both languages, with related passages.'],
      ['Provisions', '/prov', 'each article of the Statute traced back through the Committee’s drafts and the members’ proposals.'],
      ['Members', '/who', 'attendance and interventions of each member.'],
    ],
    convH: 'Reading conventions',
    conv: [
      'Page references are to the printed pagination of the 1920 volume (“p. 335”). The facsimile button shows the corresponding page of the scan.',
      'Each paragraph has a permanent address; the French and English versions of a paragraph share it.',
      'Footnotes are those of the printed volume. The language buttons in the header show French, English, or both.',
    ],
    citeH: 'How to cite',
    cite: 'Advisory Committee of Jurists, Procès-verbaux of the Proceedings of the Committee, June 16th–July 24th 1920, with Annexes (The Hague: Van Langenhuysen, 1920), p. 335; digital edition by Niccolò Ridi (2026),',
    citeNote: 'Cite the printed page; the link points to the paragraph in this edition.',
    copy: 'Copy',
    copied: 'Copied',
    dlH: 'Downloads',
    dl: [['pdf/proces-verbaux-1920.pdf', 'Procès-verbaux and annexes, 1920 (PDF, 52 MB)'],
      ['pdf/pcij-series-d-no-1.pdf', 'PCIJ, Series D, No. 1: Statute and Rules of Court (PDF)'],
      ['data/meetings.csv', 'Meetings (CSV)'], ['data/documents.csv', 'Annexes and speeches (CSV)'],
      ['data/thesaurus.json', 'Analytical index thesaurus (JSON)']],
    dlLocal: 'Downloads are available in the published edition.',
    docH: 'Source document',
    doc: 'The edition is based on the copy of the printed volume held by the Robarts Library, University of Toronto, digitised by the Internet Archive in 2007 (300 ppi; 800 page images). The scan is not in copyright and is freely available there.',
    docFacts: [['Title', 'Procès-verbaux of the Proceedings of the Committee, June 16th–July 24th, 1920, with Annexes'],
      ['Author', 'League of Nations. Advisory Committee of Jurists'], ['Published', 'The Hague: Van Langenhuysen, 1920'],
      ['Copy', 'Robarts Library, University of Toronto'], ['Internet Archive', 'procsverbauxof00leaguoft'],
      ['ARK', 'ark:/13960/t20c4wm3x']],
    docLink: 'View the scan on the Internet Archive',
    srcH: 'Sources',
    src: [
      'Advisory Committee of Jurists, Procès-verbaux of the Proceedings of the Committee, June 16th–July 24th 1920, with Annexes (The Hague: Van Langenhuysen Brothers, 1920).',
      'Permanent Court of International Justice, Series D, No. 1: Statute and Rules of Court (Leyden: Sijthoff, 1926) — for the text of the Statute as adopted on 13 December 1920.',
    ],
    licH: 'Licence',
    lic: 'The edition and all its data — the transcribed French and English texts, the analytical index, the metadata and the downloads — are published under the Creative Commons Attribution 4.0 International licence (CC BY 4.0). The printed volume of 1920 is out of copyright.',
    version: 'Version 0.1 · 11 November 2026',
  },
  fr: {
    kicker: 'À propos de l’édition',
    title: 'Procès-verbaux des séances du Comité consultatif de juristes',
    dates: 'La Haye, 16 juin – 24 juillet 1920',
    editor: 'Édition numérique par',
    advisoryH: 'Avertissement',
    advisory: 'Cette édition est en cours. Les textes français et anglais ont été transcrits à partir du volume imprimé de 1920 et sont en cours de relecture : ils peuvent contenir des erreurs de transcription, de mise en page ou d’alignement. Veuillez vérifier le fac-similé de la page imprimée avant toute citation.',
    volumeH: 'Le volume',
    volume: [
      'En février 1920, le Conseil de la Société des Nations, en application de l’article 14 du Pacte, constitua un comité de juristes chargé de préparer un projet de Cour permanente de justice internationale. Le Comité siégea au Palais de la Paix, à La Haye, du 16 juin au 24 juillet 1920, tint trente-cinq séances et adopta un avant-projet accompagné d’un rapport au Conseil. Amendé par le Conseil et l’Assemblée, il fut approuvé par l’Assemblée comme Statut de la Cour le 13 décembre 1920.',
      'Les procès-verbaux furent imprimés en français et en anglais, sur deux colonnes. Comme l’indique la préface, tous les membres s’exprimaient en français, à l’exception de Mr. Root : le texte français fait foi, l’anglais étant une traduction, sauf pour les discours et remarques de Mr. Root. Les annexes (projets, propositions, amendements, notes et discours) suivent le procès-verbal de la séance où elles ont été présentées.',
    ],
    membersH: 'Le Comité',
    secretariat: 'Secrétariat : Dionisio Anzilotti (Secrétaire général) et Åke Hammarskjöld. James Brown Scott assistait aux séances en qualité de conseiller juridique de Mr. Root. Clóvis Beviláqua (Brésil), désigné, ne prit pas part aux travaux.',
    offersH: 'Ce que propose l’édition',
    offers: [
      ['Chronologie', '/m/1', 'chaque séance et chaque annexe, en français et en anglais côte à côte, avec le fac-similé de la page imprimée à côté du texte.'],
      ['Documents', '/docs', 'les annexes, discours et interventions, par nature, auteur et séance.'],
      ['Rubriques', '/topic', 'l’index analytique : un thésaurus bilingue des questions débattues, avec les passages où elles apparaissent ; l’index imprimé en 1920 figure comme couche distincte.'],
      ['Recherche', '/search', 'le texte intégral dans les deux langues, avec des passages apparentés.'],
      ['Dispositions', '/prov', 'chaque article du Statut, remonté à travers les projets du Comité et les propositions des membres.'],
      ['Membres', '/who', 'présence et interventions de chaque membre.'],
    ],
    convH: 'Conventions de lecture',
    conv: [
      'Les références de page renvoient à la pagination imprimée du volume de 1920 (« p. 335 »). Le bouton fac-similé affiche la page correspondante.',
      'Chaque paragraphe possède une adresse permanente, commune à ses versions française et anglaise.',
      'Les notes sont celles du volume imprimé. Les boutons de langue de l’en-tête affichent le français, l’anglais ou les deux.',
    ],
    citeH: 'Comment citer',
    cite: 'Comité consultatif de juristes, Procès-verbaux des séances du Comité, 16 juin – 24 juillet 1920, avec annexes (La Haye : Van Langenhuysen, 1920), p. 335 ; édition numérique par Niccolò Ridi (2026),',
    citeNote: 'Citez la page imprimée ; le lien renvoie au paragraphe dans cette édition.',
    copy: 'Copier',
    copied: 'Copié',
    dlH: 'Téléchargements',
    dl: [['pdf/proces-verbaux-1920.pdf', 'Procès-verbaux et annexes, 1920 (PDF, 52 Mo)'],
      ['pdf/pcij-series-d-no-1.pdf', 'CPJI, Série D, n° 1 : Statut et Règlement de la Cour (PDF)'],
      ['data/meetings.csv', 'Séances (CSV)'], ['data/documents.csv', 'Annexes et discours (CSV)'],
      ['data/thesaurus.json', 'Thésaurus de l’index analytique (JSON)']],
    dlLocal: 'Les téléchargements sont disponibles dans l’édition publiée.',
    docH: 'Document source',
    doc: 'L’édition repose sur l’exemplaire du volume imprimé conservé à la Robarts Library de l’Université de Toronto, numérisé par l’Internet Archive en 2007 (300 ppp ; 800 images). La numérisation, libre de droits, y est accessible gratuitement.',
    docFacts: [['Titre', 'Procès-verbaux of the Proceedings of the Committee, June 16th–July 24th, 1920, with Annexes'],
      ['Auteur', 'Société des Nations. Comité consultatif de juristes'], ['Publication', 'La Haye : Van Langenhuysen, 1920'],
      ['Exemplaire', 'Robarts Library, Université de Toronto'], ['Internet Archive', 'procsverbauxof00leaguoft'],
      ['ARK', 'ark:/13960/t20c4wm3x']],
    docLink: 'Consulter la numérisation sur l’Internet Archive',
    srcH: 'Sources',
    src: [
      'Comité consultatif de juristes, Procès-verbaux des séances du Comité, 16 juin – 24 juillet 1920, avec annexes (La Haye : Van Langenhuysen Frères, 1920).',
      'Cour permanente de justice internationale, Série D, n° 1 : Statut et Règlement de la Cour (Leyde : Sijthoff, 1926) — pour le texte du Statut adopté le 13 décembre 1920.',
    ],
    licH: 'Licence',
    lic: 'L’édition et l’ensemble de ses données — textes français et anglais transcrits, index analytique, métadonnées et téléchargements — sont publiés sous licence Creative Commons Attribution 4.0 International (CC BY 4.0). Le volume imprimé de 1920 n’est plus protégé par le droit d’auteur.',
    version: 'Version 0.1 · 11 novembre 2026',
  },
};

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const route = (label, path) => { const a = el('a', label); a.href = link(path); a.dataset.route = path; return a; };

export async function render(root, state) {
  const t = T[state.dl === 'fr' ? 'fr' : 'en'];
  const page = el('article', undefined, 'about');
  page.lang = state.dl === 'fr' ? 'fr' : 'en';

  const head = el('header', undefined, 'about-head');
  head.append(el('p', t.kicker, 'about-kicker'), el('h2', t.title), el('p', t.dates, 'about-dates'));
  const ed = el('p', undefined, 'about-editor');
  const me = el('a', 'Niccolò Ridi'); me.href = 'https://niccoloridi.com/';
  const strong = el('strong'); strong.append(me);
  ed.append(`${t.editor} `, strong);
  head.append(ed);
  page.append(head);

  const adv = el('section', undefined, 'about-advisory');
  adv.append(el('h3', t.advisoryH), el('p', t.advisory));
  page.append(adv);

  const sec = (h, ...nodes) => { const s = el('section'); s.append(el('h3', h), ...nodes); page.append(s); return s; };

  sec(t.volumeH, ...t.volume.map(p => el('p', p)));

  const list = el('ul', undefined, 'about-members');
  for (const [id, name, fr, en] of MEMBERS) {
    const li = el('li');
    li.append(route(name, `/who/${id}`), el('span', state.dl === 'fr' ? fr : en));
    list.append(li);
  }
  sec(t.membersH, list, el('p', t.secretariat, 'about-note'));

  const offers = el('dl', undefined, 'about-offers');
  for (const [label, path, text] of t.offers) {
    const dt = el('dt'); dt.append(route(label, path));
    offers.append(dt, el('dd', text));
  }
  sec(t.offersH, offers);

  const conv = el('ul');
  for (const c of t.conv) conv.append(el('li', c));
  sec(t.convH, conv);

  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  const permalink = `${base}#/m/15/s0345.04`;
  const citation = `${t.cite} ${permalink}`;
  const box = el('div', undefined, 'about-cite');
  const q = el('p', citation);
  const btn = el('button', t.copy);
  btn.type = 'button';
  btn.onclick = async () => {
    try { await navigator.clipboard.writeText(citation); btn.textContent = t.copied; setTimeout(() => { btn.textContent = t.copy; }, 1500); }
    catch { const r = document.createRange(); r.selectNodeContents(q); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  };
  box.append(q, btn);
  sec(t.citeH, box, el('p', t.citeNote, 'about-note'));

  const IA = 'https://archive.org/details/procsverbauxof00leaguoft';
  const table = el('dl', undefined, 'about-doc');
  for (const [k, v] of t.docFacts) {
    const dd = el('dd');
    if (k === 'Internet Archive') { const a = el('a', v); a.href = IA; a.target = '_blank'; a.rel = 'noopener'; dd.append(a); }
    else if (k === 'ARK') { const a = el('a', v); a.href = `https://n2t.net/${v}`; a.target = '_blank'; a.rel = 'noopener'; dd.append(a); }
    else dd.textContent = v;
    table.append(el('dt', k), dd);
  }
  const go = el('a', `${t.docLink} ↗`, 'about-ia');
  go.href = IA; go.target = '_blank'; go.rel = 'noopener';
  sec(t.docH, el('p', t.doc), table, go);

  const cfg = window.PV_STATIC;
  if (cfg) {
    const ul = el('ul', undefined, 'about-downloads');
    const root_ = (cfg.data || '').replace(/\/data$/, '');
    for (const [path, label] of t.dl) {
      const li = el('li');
      const a = el('a', label);
      a.href = `${root_}/${path}`;
      li.append(a);
      ul.append(li);
    }
    sec(t.dlH, ul);
  } else sec(t.dlH, el('p', t.dlLocal, 'about-note'));

  sec(t.srcH, ...t.src.map(p => el('p', p)));
  sec(t.licH, el('p', t.lic));
  page.append(el('p', t.version, 'about-version'));
  root.replaceChildren(page);
  window.scrollTo(0, 0);
}
