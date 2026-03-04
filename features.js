/* ============================================================
   features.js — Fonctionnalités avancées WorldBuilder
   Dépend de app.js, scenes.js
   ============================================================ */
'use strict';

// ============================================================
// CITATIONS & PHRASES CLÉS
// ============================================================
function getCitations() {
  return JSON.parse(localStorage.getItem(`projet_${state.currentProjectId}_citations`) || '[]');
}
function saveCitations(list) {
  localStorage.setItem(`projet_${state.currentProjectId}_citations`, JSON.stringify(list));
}

let _editingCitationId = null;

function renderCitations() {
  const citations = getCitations();
  const chars     = getProjectData(state.currentProjectId, 'personnages');
  const chapters  = getProjectData(state.currentProjectId, 'chapitres');

  // Filters
  const filterPerso = document.getElementById('cit-filter-perso')?.value || '';
  const filterTheme = document.getElementById('cit-filter-theme')?.value || '';
  const searchQ     = document.getElementById('cit-search')?.value?.toLowerCase() || '';

  let list = citations;
  if (filterPerso) list = list.filter(c => c.personnageId === filterPerso);
  if (filterTheme) list = list.filter(c => (c.themes || []).includes(filterTheme));
  if (searchQ)     list = list.filter(c => c.texte?.toLowerCase().includes(searchQ));

  // Sort by importance desc
  list = [...list].sort((a, b) => (b.importance || 0) - (a.importance || 0));

  const THEMES = ['Amour','Peur','Colère','Espoir','Tristesse','Humour','Courage','Trahison','Redemption','Autre'];

  // Populate filters
  const persoSel = document.getElementById('cit-filter-perso');
  if (persoSel && persoSel.children.length <= 1) {
    chars.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = [c.prenom, c.nom].filter(Boolean).join(' ');
      persoSel.appendChild(opt);
    });
  }

  const el = document.getElementById('citations-list');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div class="no-items"><div class="no-icon">💬</div><p>Aucune citation pour l\'instant.</p></div>';
    return;
  }

  el.innerHTML = list.map(c => {
    const perso   = chars.find(p => p.id === c.personnageId);
    const chap    = chapters.find(ch => ch.id === c.chapitreId);
    const stars   = '★'.repeat(c.importance || 0) + '☆'.repeat(5 - (c.importance || 0));
    const themes  = (c.themes || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('');
    return `
      <div class="citation-card">
        <div class="citation-text">❝ ${esc(c.texte)} ❞</div>
        <div class="citation-meta">
          ${perso ? `<span>👤 ${esc([perso.prenom, perso.nom].filter(Boolean).join(' '))}</span>` : ''}
          ${chap  ? `<span>📖 ${esc(chap.titre)}</span>` : ''}
          <span class="citation-stars">${stars}</span>
        </div>
        ${themes ? `<div class="citation-themes">${themes}</div>` : ''}
        ${c.contexte ? `<div class="citation-contexte">${esc(c.contexte)}</div>` : ''}
        <div class="citation-actions">
          <button class="btn btn-ghost btn-sm" onclick="openCitationModal('${c.id}')">✏️ Modifier</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteCitationConfirm('${c.id}')">🗑️ Supprimer</button>
        </div>
      </div>`;
  }).join('');
}

function openCitationModal(id = null) {
  _editingCitationId = id;
  const citations = getCitations();
  const c = id ? citations.find(x => x.id === id) : null;
  const chars    = getProjectData(state.currentProjectId, 'personnages');
  const chapters = getProjectData(state.currentProjectId, 'chapitres');

  document.getElementById('cit-texte').value    = c?.texte    || '';
  document.getElementById('cit-contexte').value = c?.contexte || '';
  document.getElementById('cit-importance').value = c?.importance || 3;
  document.getElementById('cit-notes').value    = c?.notes    || '';

  // Characters
  const persoSel = document.getElementById('cit-personnage');
  persoSel.innerHTML = '<option value="">— Aucun —</option>' +
    chars.map(ch => `<option value="${ch.id}" ${c?.personnageId === ch.id ? 'selected' : ''}>${esc([ch.prenom,ch.nom].filter(Boolean).join(' '))}</option>`).join('');

  // Chapters
  const chapSel = document.getElementById('cit-chapitre');
  chapSel.innerHTML = '<option value="">— Aucun —</option>' +
    chapters.map(ch => `<option value="${ch.id}" ${c?.chapitreId === ch.id ? 'selected' : ''}>Ch.${ch.numero} ${esc(ch.titre)}</option>`).join('');

  // Themes checkboxes
  const THEMES = ['Amour','Peur','Colère','Espoir','Tristesse','Humour','Courage','Trahison','Redemption','Autre'];
  document.getElementById('cit-themes').innerHTML = THEMES.map(t => `
    <label class="theme-check">
      <input type="checkbox" value="${t}" ${(c?.themes||[]).includes(t) ? 'checked' : ''}> ${t}
    </label>`).join('');

  document.getElementById('modal-citation-title').textContent = id ? 'Modifier la citation' : 'Nouvelle citation';
  openModal('modal-citation');
}

function saveCitation() {
  const texte = document.getElementById('cit-texte').value.trim();
  if (!texte) { showToast('La citation ne peut pas être vide', 'error'); return; }

  const themes = [...document.querySelectorAll('#cit-themes input:checked')].map(el => el.value);
  const citations = getCitations();

  const entry = {
    id:          _editingCitationId || uid(),
    texte,
    personnageId: document.getElementById('cit-personnage').value || null,
    chapitreId:   document.getElementById('cit-chapitre').value   || null,
    contexte:    document.getElementById('cit-contexte').value.trim(),
    themes,
    importance:  parseInt(document.getElementById('cit-importance').value, 10) || 3,
    notes:       document.getElementById('cit-notes').value.trim(),
    createdAt:   _editingCitationId ? (citations.find(c => c.id === _editingCitationId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };

  if (_editingCitationId) {
    const idx = citations.findIndex(c => c.id === _editingCitationId);
    if (idx !== -1) citations[idx] = entry; else citations.push(entry);
  } else {
    citations.push(entry);
  }
  saveCitations(citations);
  closeModal('modal-citation');
  showToast('Citation sauvegardée', 'success');
  renderCitations();
}

function deleteCitationConfirm(id) {
  showConfirm('Supprimer cette citation ?', '', () => {
    saveCitations(getCitations().filter(c => c.id !== id));
    renderCitations();
    showToast('Citation supprimée');
  });
}

// ============================================================
// JOURNAL ÉCRITURE
// ============================================================
function getJournalEntries() {
  return JSON.parse(localStorage.getItem(`projet_${state.currentProjectId}_journal`) || '[]');
}
function saveJournalEntries(list) {
  localStorage.setItem(`projet_${state.currentProjectId}_journal`, JSON.stringify(list));
}

let _editingJournalId = null;
const JOURNAL_CATEGORIES = [
  { value: 'idee',     label: '💡 Idée',              color: '#F59E0B' },
  { value: 'session',  label: '✍️ Session écriture', color: '#10B981' },
  { value: 'objectif', label: '🎯 Objectif',           color: '#6366F1' },
  { value: 'blocage',  label: '🔴 Blocage',            color: '#EF4444' },
  { value: 'resolution',label:'✅ Résolution',         color: '#059669' },
  { value: 'bilan',    label: '📊 Bilan',              color: '#8B5CF6' },
];

function renderJournal() {
  const entries  = getJournalEntries();
  const searchQ  = document.getElementById('journal-search')?.value?.toLowerCase() || '';
  const filterCat = document.getElementById('journal-filter-cat')?.value || '';

  let list = entries;
  if (searchQ)   list = list.filter(e => e.titre?.toLowerCase().includes(searchQ) || e.contenu?.toLowerCase().includes(searchQ));
  if (filterCat) list = list.filter(e => e.categorie === filterCat);
  list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  const el = document.getElementById('journal-list');
  if (!el) return;

  // Stats
  const totalMots   = entries.reduce((acc, e) => acc + (e.motsEcrits || 0), 0);
  const totalSessions = entries.filter(e => e.categorie === 'session').length;
  const statsEl = document.getElementById('journal-stats');
  if (statsEl) statsEl.innerHTML = `
    <span>📊 ${entries.length} entrées</span>
    <span>✍️ ${totalSessions} sessions</span>
    <span>📝 ${totalMots.toLocaleString('fr')} mots écrits</span>
  `;

  if (!list.length) {
    el.innerHTML = '<div class="no-items"><div class="no-icon">📔</div><p>Aucune entrée pour l\'instant.</p></div>';
    return;
  }

  el.innerHTML = list.map(e => {
    const cat   = JOURNAL_CATEGORIES.find(c => c.value === e.categorie) || JOURNAL_CATEGORIES[0];
    const dStr  = new Date(e.date).toLocaleDateString('fr', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `
      <div class="journal-entry" style="border-left-color:${cat.color}">
        <div class="journal-entry-header">
          <span class="journal-cat" style="background:${cat.color}20;color:${cat.color}">${cat.label}</span>
          <span class="journal-date">${dStr}</span>
          ${e.mood ? `<span class="journal-mood">${e.mood}</span>` : ''}
        </div>
        <div class="journal-title">${esc(e.titre)}</div>
        ${e.contenu ? `<div class="journal-body">${esc(e.contenu.substring(0, 200))}${e.contenu.length > 200 ? '…' : ''}</div>` : ''}
        <div class="journal-footer">
          ${e.motsEcrits ? `<span>📝 +${e.motsEcrits} mots</span>` : ''}
          ${e.progression != null ? `<div class="journal-progress-bar"><div style="width:${e.progression}%"></div><span>${e.progression}%</span></div>` : ''}
          <div class="journal-actions">
            <button class="btn btn-ghost btn-sm" onclick="openJournalModal('${e.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteJournalEntry('${e.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function openJournalModal(id = null) {
  _editingJournalId = id;
  const entries = getJournalEntries();
  const e = id ? entries.find(x => x.id === id) : null;
  const now = new Date().toISOString().slice(0, 16);

  document.getElementById('jou-titre').value       = e?.titre       || '';
  document.getElementById('jou-contenu').value     = e?.contenu     || '';
  document.getElementById('jou-categorie').value   = e?.categorie   || 'session';
  document.getElementById('jou-date').value        = e?.date?.slice(0, 16) || now;
  document.getElementById('jou-mots').value        = e?.motsEcrits  || '';
  document.getElementById('jou-progression').value = e?.progression ?? '';
  document.getElementById('jou-mood').value        = e?.mood        || '';
  document.getElementById('modal-journal-title').textContent = id ? 'Modifier l\'entrée' : 'Nouvelle entrée';
  openModal('modal-journal');
}

function saveJournalEntry() {
  const titre = document.getElementById('jou-titre').value.trim();
  if (!titre) { showToast('Titre requis', 'error'); return; }

  const entries = getJournalEntries();
  const entry = {
    id:          _editingJournalId || uid(),
    titre,
    contenu:     document.getElementById('jou-contenu').value.trim(),
    categorie:   document.getElementById('jou-categorie').value,
    date:        document.getElementById('jou-date').value || new Date().toISOString(),
    motsEcrits:  parseInt(document.getElementById('jou-mots').value, 10) || 0,
    progression: parseInt(document.getElementById('jou-progression').value, 10) || null,
    mood:        document.getElementById('jou-mood').value,
    createdAt:   _editingJournalId ? (entries.find(e => e.id === _editingJournalId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };

  if (_editingJournalId) {
    const idx = entries.findIndex(e => e.id === _editingJournalId);
    if (idx !== -1) entries[idx] = entry; else entries.push(entry);
  } else {
    entries.push(entry);
  }
  saveJournalEntries(entries);
  closeModal('modal-journal');
  showToast('Entrée sauvegardée', 'success');
  renderJournal();
}

function deleteJournalEntry(id) {
  showConfirm('Supprimer cette entrée ?', '', () => {
    saveJournalEntries(getJournalEntries().filter(e => e.id !== id));
    renderJournal();
    showToast('Entrée supprimée');
  });
}

// ============================================================
// CHRONOMÈTRE SCÈNES (durée in-story)
// ============================================================
function calculateInStoryDuration(heureDebut, heureFin) {
  if (!heureDebut || !heureFin) return null;
  const [h1, m1] = heureDebut.split(':').map(Number);
  const [h2, m2] = heureFin.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // overnight
  const hours = Math.floor(mins / 60);
  const rem   = mins % 60;
  return hours > 0 ? `${hours}h${rem.toString().padStart(2,'0')}` : `${rem}min`;
}

function updateChapterDuration() {
  const debut = document.getElementById('chap-heure-debut')?.value;
  const fin   = document.getElementById('chap-heure-fin')?.value;
  const duree = calculateInStoryDuration(debut, fin);
  const el    = document.getElementById('chap-duree-display');
  if (el) el.textContent = duree ? `Durée : ${duree}` : '';
}

function renderChapterTimeline() {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);
  const el       = document.getElementById('chapter-timeline-view');
  if (!el) return;

  const withTime = chapters.filter(c => c.heureDebut);
  if (!withTime.length) {
    el.innerHTML = '<p style="color:var(--gray-400);font-size:13px">Ajoutez des heures in-story aux chapitres pour voir la timeline.</p>';
    return;
  }

  let totalMins = 0;
  el.innerHTML = withTime.map(c => {
    const dur = calculateInStoryDuration(c.heureDebut, c.heureFin);
    if (c.heureDebut && c.heureFin) {
      const [h1,m1] = c.heureDebut.split(':').map(Number);
      const [h2,m2] = c.heureFin.split(':').map(Number);
      let mins = (h2*60+m2)-(h1*60+m1);
      if (mins < 0) mins += 1440;
      totalMins += mins;
    }
    return `
      <div class="timeline-item-row">
        <span class="timeline-chap-num">Ch. ${c.numero}</span>
        <span class="timeline-chap-title">${esc(c.titre)}</span>
        <span class="timeline-time">${c.heureDebut || '?'} → ${c.heureFin || '?'}</span>
        <span class="timeline-dur">${dur || '—'}</span>
      </div>`;
  }).join('') + `
    <div class="timeline-total">
      Total : ${Math.floor(totalMins/60)}h${(totalMins%60).toString().padStart(2,'0')}
    </div>`;
}

// ============================================================
// COMPARATEUR VERSIONS
// ============================================================
function getVersionHistory(type, itemId) {
  return JSON.parse(localStorage.getItem(`versions_${state.currentProjectId}_${type}_${itemId}`) || '[]');
}
function saveVersionHistory(type, itemId, list) {
  localStorage.setItem(`versions_${state.currentProjectId}_${type}_${itemId}`, JSON.stringify(list));
}

function snapshotVersion(type, itemId, data, label = '') {
  const history = getVersionHistory(type, itemId);
  history.unshift({
    id:        uid(),
    timestamp: Date.now(),
    label:     label || `Version ${new Date().toLocaleString('fr')}`,
    data:      JSON.parse(JSON.stringify(data)),
  });
  // Keep max 30
  if (history.length > 30) history.splice(30);
  saveVersionHistory(type, itemId, history);
}

function openVersionHistory(type, itemId, currentData) {
  const history = getVersionHistory(type, itemId);
  const el      = document.getElementById('version-history-list');
  if (!el) return;

  if (!history.length) {
    el.innerHTML = '<p style="color:var(--gray-400)">Aucun historique disponible.<br>Les versions sont créées automatiquement à chaque sauvegarde.</p>';
  } else {
    el.innerHTML = history.map((v, i) => `
      <div class="version-item">
        <div class="version-meta">
          <strong>${esc(v.label)}</strong>
          <span>${new Date(v.timestamp).toLocaleString('fr')}</span>
        </div>
        <div class="version-actions">
          <button class="btn btn-secondary btn-sm" onclick="compareVersions('${type}','${itemId}',${i})">👁 Comparer</button>
          <button class="btn btn-secondary btn-sm" onclick="restoreVersion('${type}','${itemId}',${i})">↩️ Restaurer</button>
        </div>
      </div>`).join('');
  }

  document.getElementById('vh-type').value  = type;
  document.getElementById('vh-item-id').value = itemId;
  openModal('modal-version-history');
}

function compareVersions(type, itemId, vIdx) {
  const history = getVersionHistory(type, itemId);
  const v = history[vIdx];
  if (!v) return;

  // Get current
  let currentData;
  if (type === 'chapitre') {
    currentData = getProjectData(state.currentProjectId, 'chapitres').find(c => c.id === itemId);
  } else if (type === 'scene') {
    currentData = getProjectData(state.currentProjectId, 'scenes').find(s => s.id === itemId);
  } else if (type === 'personnage') {
    currentData = getProjectData(state.currentProjectId, 'personnages').find(p => p.id === itemId);
  }

  const diffHtml = _computeDiff(
    JSON.stringify(currentData, null, 2),
    JSON.stringify(v.data, null, 2)
  );

  document.getElementById('version-compare-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h4 style="margin:0 0 8px">Version actuelle</h4>
        <pre style="font-size:11px;overflow:auto;max-height:300px;background:var(--gray-50);padding:8px;border-radius:4px">${esc(JSON.stringify(currentData, null, 2))}</pre>
      </div>
      <div>
        <h4 style="margin:0 0 8px">${esc(v.label)}</h4>
        <pre style="font-size:11px;overflow:auto;max-height:300px;background:var(--gray-50);padding:8px;border-radius:4px">${esc(JSON.stringify(v.data, null, 2))}</pre>
      </div>
    </div>
    <div style="margin-top:16px">
      <h4>Différences</h4>
      <div class="diff-view">${diffHtml}</div>
    </div>`;
}

function _computeDiff(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const result = [];
  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const la = linesA[i] ?? '';
    const lb = linesB[i] ?? '';
    if (la === lb) {
      result.push(`<div class="diff-same">${esc(la)}</div>`);
    } else {
      if (la) result.push(`<div class="diff-removed">- ${esc(la)}</div>`);
      if (lb) result.push(`<div class="diff-added">+ ${esc(lb)}</div>`);
    }
  }
  return result.join('');
}

function restoreVersion(type, itemId, vIdx) {
  const history = getVersionHistory(type, itemId);
  const v = history[vIdx];
  if (!v) return;
  showConfirm(`Restaurer "${v.label}" ?`, 'La version actuelle sera écrasée.', () => {
    if (type === 'chapitre') {
      const items = getProjectData(state.currentProjectId, 'chapitres');
      const idx   = items.findIndex(c => c.id === itemId);
      if (idx !== -1) { items[idx] = { ...v.data, id: itemId }; saveProjectData(state.currentProjectId, 'chapitres', items); }
    } else if (type === 'scene') {
      const items = getProjectData(state.currentProjectId, 'scenes');
      const idx   = items.findIndex(s => s.id === itemId);
      if (idx !== -1) { items[idx] = { ...v.data, id: itemId }; saveProjectData(state.currentProjectId, 'scenes', items); }
    } else if (type === 'personnage') {
      const items = getProjectData(state.currentProjectId, 'personnages');
      const idx   = items.findIndex(p => p.id === itemId);
      if (idx !== -1) { items[idx] = { ...v.data, id: itemId }; saveProjectData(state.currentProjectId, 'personnages', items); }
    }
    touchProject(state.currentProjectId);
    closeModal('modal-version-history');
    showToast('Version restaurée', 'success');
    navigateTo(state.currentSection);
  });
}


// ============================================================
// DÉTECTEUR D'INCOHÉRENCES
// ============================================================
function analyserCoherence() {
  const id         = state.currentProjectId;
  const personnages = getProjectData(id, 'personnages');
  const chapitres  = getProjectData(id, 'chapitres');
  const events     = getProjectData(id, 'events');
  const relations  = getProjectData(id, 'relations');
  const issues     = [];

  // 1. Noms variants (prénom avec/sans accent)
  const prenoms = personnages.map(p => p.prenom?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  personnages.forEach((p, i) => {
    const norm = p.prenom?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    personnages.forEach((q, j) => {
      if (i >= j) return;
      const normQ = q.prenom?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (norm && normQ && norm === normQ && p.prenom !== q.prenom) {
        issues.push({ type: 'nom', severity: 'warning', desc: `Noms similaires : "${p.prenom}" et "${q.prenom}" — variante orthographique ?` });
      }
    });
  });

  // 2. Relations contradictoires (A ami B, B ennemi A)
  relations.forEach((r1, i) => {
    relations.forEach((r2, j) => {
      if (i >= j) return;
      const same = (r1.personA === r2.personA && r1.personB === r2.personB) ||
                   (r1.personA === r2.personB && r1.personB === r2.personA);
      if (same) {
        const conflict = (r1.type === 'Amitié' && r2.type === 'Conflit/Ennemis') ||
                         (r1.type === 'Conflit/Ennemis' && r2.type === 'Amitié') ||
                         (r1.type === 'Amour/Romance' && r2.type === 'Conflit/Ennemis');
        if (conflict) {
          const nameA = personnages.find(p => p.id === r1.personA)?.prenom || '?';
          const nameB = personnages.find(p => p.id === r1.personB)?.prenom || '?';
          issues.push({ type: 'relation', severity: 'error', desc: `Relations contradictoires : ${nameA} et ${nameB} ont "${r1.type}" ET "${r2.type}"` });
        }
      }
    });
  });

  // 3. Timeline : dates de naissance après événements qui les mentionnent
  const naissances = events.filter(e => e.type === 'Naissance');
  naissances.forEach(nEvent => {
    if (!nEvent.date) return;
    const nDate = new Date(nEvent.date);
    events.forEach(other => {
      if (other.id === nEvent.id || !other.date) return;
      const oDate = new Date(other.date);
      // If naissance is after another event mentioning same person
      const samePerso = (nEvent.associated || []).some(a => (other.associated || []).includes(a));
      if (samePerso && nDate > oDate && other.type !== 'Naissance') {
        issues.push({ type: 'timeline', severity: 'error', desc: `Timeline : "${nEvent.titre}" (naissance) après "${other.titre}" qui mentionne le même personnage.` });
      }
    });
  });

  // 4. Chapitres sans contenu et sans scènes
  chapitres.forEach(c => {
    if (!c.contenu && (!c.scenesIds || c.scenesIds.length === 0)) {
      issues.push({ type: 'chapitre', severity: 'info', desc: `Ch. ${c.numero} "${c.titre}" n'a ni contenu ni scènes assignées.` });
    }
  });

  // 5. Personnages sans aucune apparition
  personnages.forEach(p => {
    const name = [p.prenom, p.nom].filter(Boolean).join(' ');
    const inRelations = relations.some(r => r.personA === p.id || r.personB === p.id);
    const inEvents    = events.some(e => (e.associated || []).includes(p.id));
    if (!inRelations && !inEvents) {
      issues.push({ type: 'personnage', severity: 'info', desc: `"${name}" n'apparaît dans aucune relation ni événement.` });
    }
  });

  const el = document.getElementById('coherence-results');
  if (!el) return;

  if (!issues.length) {
    el.innerHTML = '<div style="color:#10B981;font-size:14px;padding:16px">✅ Aucune incohérence détectée !</div>';
  } else {
    const icons = { error: '🔴', warning: '⚠️', info: 'ℹ️' };
    el.innerHTML = `
      <div style="margin-bottom:12px;font-size:13px;color:var(--gray-600)">${issues.length} incohérence${issues.length > 1 ? 's' : ''} détectée${issues.length > 1 ? 's' : ''}</div>
      ${issues.map(iss => `
        <div class="coherence-issue coherence-${iss.severity}">
          <span>${icons[iss.severity]}</span>
          <div>
            <span class="coherence-type">${iss.type}</span>
            <div>${esc(iss.desc)}</div>
          </div>
        </div>`).join('')}`;
  }
  openModal('modal-coherence');
}

// ============================================================
// STATISTIQUES PROSE
// ============================================================
function analyserProse() {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres');
  const persos   = getProjectData(id, 'personnages');

  const withContent = chapters.filter(c => c.contenu && c.contenu.trim());
  if (!withContent.length) {
    showToast('Aucun chapitre avec contenu à analyser', 'error');
    return;
  }

  const allText = withContent.map(c => c.contenu).join('\n');

  // Word frequency (excluding stop words)
  const STOP = new Set(['le','la','les','de','du','des','et','en','un','une','il','elle','ils','elles','je','tu','nous','vous','que','qui','ce','se','sa','son','ses','au','aux','par','sur','dans','avec','mais','ou','donc','or','ni','car','est','était','sera','sont','être','avoir','a','à','y','ne','pas','plus','si','même','tout','bien','comme','après','avant','encore','déjà','très','aussi','alors','puis','toujours','jamais','souvent']);
  const words = allText.toLowerCase().match(/\b[a-zàâäéèêëîïôùûüÿç]+\b/g) || [];
  const freq  = {};
  words.forEach(w => { if (!STOP.has(w) && w.length > 3) freq[w] = (freq[w] || 0) + 1; });
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);

  // Sentences
  const sentences = allText.split(/[.!?…]+/).filter(s => s.trim().length > 5);
  const avgSentLen = sentences.length ? Math.round(words.length / sentences.length) : 0;

  // Dialogue ratio
  const dialogueWords = (allText.match(/[«»""].*?[«»""]/g) || []).join(' ').split(/\s+/).length;
  const dialogueRatio = words.length ? Math.round((dialogueWords / words.length) * 100) : 0;

  // Unique words
  const uniqueWords   = Object.keys(freq).length;
  const diversite     = words.length ? Math.round((uniqueWords / words.length) * 100 * 10) / 10 : 0;

  // Presence per chapter
  const presence = persos.slice(0, 5).map(p => {
    const name = [p.prenom, p.nom].filter(Boolean).join(' ');
    const count = withContent.filter(c => c.contenu?.toLowerCase().includes(p.prenom?.toLowerCase() || '')).length;
    return { name, count, pct: Math.round((count / withContent.length) * 100) };
  }).filter(p => p.count > 0);

  // Chapter lengths for chart data
  const chapLengths = withContent.map(c => ({
    label: `Ch.${c.numero}`,
    mots:  c.contenu.trim().split(/\s+/).length,
  }));

  const el = document.getElementById('prose-stats-content');
  if (!el) return;

  el.innerHTML = `
    <div class="prose-grid">
      <div class="prose-stat-card">
        <div class="prose-stat-val">${words.length.toLocaleString('fr')}</div>
        <div class="prose-stat-label">Mots total</div>
      </div>
      <div class="prose-stat-card">
        <div class="prose-stat-val">${uniqueWords.toLocaleString('fr')}</div>
        <div class="prose-stat-label">Mots uniques</div>
      </div>
      <div class="prose-stat-card">
        <div class="prose-stat-val">${diversite}%</div>
        <div class="prose-stat-label">Diversité lexicale</div>
      </div>
      <div class="prose-stat-card">
        <div class="prose-stat-val">${avgSentLen}</div>
        <div class="prose-stat-label">Mots/phrase moy.</div>
      </div>
      <div class="prose-stat-card">
        <div class="prose-stat-val">${dialogueRatio}%</div>
        <div class="prose-stat-label">Dialogue</div>
      </div>
      <div class="prose-stat-card">
        <div class="prose-stat-val">${100 - dialogueRatio}%</div>
        <div class="prose-stat-label">Narration</div>
      </div>
    </div>

    <h4 style="margin:16px 0 8px">Mots-clés fréquents</h4>
    <div class="word-cloud">
      ${topWords.map(([w, n]) => `<span class="word-cloud-item" style="font-size:${Math.min(22, 11 + n/2)}px">${esc(w)} <sup>${n}</sup></span>`).join('')}
    </div>

    <h4 style="margin:16px 0 8px">Présence personnages</h4>
    ${presence.map(p => `
      <div class="presence-row">
        <span class="presence-name">${esc(p.name)}</span>
        <div class="presence-bar-wrap">
          <div class="presence-bar" style="width:${p.pct}%"></div>
        </div>
        <span class="presence-pct">${p.count}/${withContent.length} chap. (${p.pct}%)</span>
      </div>`).join('') || '<p style="color:var(--gray-400)">Ajoutez des personnages pour voir leur présence.</p>'}

    <h4 style="margin:16px 0 8px">Longueur des chapitres</h4>
    <div class="chap-bars">
      ${chapLengths.map(c => `
        <div class="chap-bar-item" title="${c.mots} mots">
          <div class="chap-bar" style="height:${Math.min(80, Math.round(c.mots / 50))}px"></div>
          <div class="chap-bar-label">${c.label}</div>
        </div>`).join('')}
    </div>`;

  openModal('modal-prose-stats');
}

// ============================================================
// MODE PRÉSENTATION
// ============================================================
let _presentSlides = [];
let _presentIndex  = 0;

function openPresentationMode() {
  const id       = state.currentProjectId;
  const project  = getProjects().find(p => p.id === id);
  const persos   = getProjectData(id, 'personnages');
  const lieux    = getProjectData(id, 'lieux');
  const chapters = getProjectData(id, 'chapitres');
  const relations= getProjectData(id, 'relations');

  _presentSlides = [];

  // Slide 1 : Titre
  _presentSlides.push({
    type: 'title',
    html: `<div class="slide-title">
      <h1>${esc(project?.name || 'Mon Projet')}</h1>
      <p>${esc(project?.description || '')}</p>
    </div>`
  });

  // Slide 2 : Stats
  _presentSlides.push({
    type: 'stats',
    html: `<div class="slide-stats">
      <h2>Vue d'ensemble</h2>
      <div class="slide-stats-grid">
        <div><span>${persos.length}</span> Personnages</div>
        <div><span>${lieux.length}</span> Lieux</div>
        <div><span>${chapters.length}</span> Chapitres</div>
        <div><span>${relations.length}</span> Relations</div>
      </div>
    </div>`
  });

  // Slides personnages
  if (persos.length > 0) {
    _presentSlides.push({
      type: 'section',
      html: `<div class="slide-section-title"><h2>👤 Personnages</h2></div>`
    });
    persos.slice(0, 6).forEach(p => {
      _presentSlides.push({
        type: 'personnage',
        html: `<div class="slide-card">
          ${p.photo ? `<img src="${p.photo}" class="slide-photo" alt="">` : `<div class="slide-avatar">${(p.prenom||'?')[0]}</div>`}
          <h3>${esc([p.prenom, p.nom].filter(Boolean).join(' '))}</h3>
          <div class="slide-badge">${esc(p.role||'')}</div>
          ${p.age ? `<p>${p.age} ans</p>` : ''}
          ${(p.traits||[]).length ? `<div class="slide-traits">${p.traits.map(t=>`<span>${esc(t)}</span>`).join('')}</div>` : ''}
        </div>`
      });
    });
  }

  // Slides lieux
  if (lieux.length > 0) {
    _presentSlides.push({
      type: 'section',
      html: `<div class="slide-section-title"><h2>📍 Lieux</h2></div>`
    });
    lieux.slice(0, 4).forEach(l => {
      _presentSlides.push({
        type: 'lieu',
        html: `<div class="slide-card">
          ${l.photo ? `<img src="${l.photo}" class="slide-photo" alt="">` : `<div class="slide-avatar">📍</div>`}
          <h3>${esc(l.nom)}</h3>
          <div class="slide-badge">${esc(l.type||'')} ${l.ville ? `· ${esc(l.ville)}` : ''}</div>
          ${l.description ? `<p>${esc(l.description.substring(0,120))}…</p>` : ''}
        </div>`
      });
    });
  }

  _presentIndex = 0;
  _renderPresentSlide();
  document.getElementById('presentation-overlay').classList.remove('hidden');
  document.getElementById('presentation-overlay').focus();
}

function _renderPresentSlide() {
  const slide = _presentSlides[_presentIndex];
  if (!slide) return;
  document.getElementById('slide-content').innerHTML = slide.html;
  document.getElementById('slide-counter').textContent =
    `${_presentIndex + 1} / ${_presentSlides.length}`;
  document.getElementById('present-btn-prev').disabled = _presentIndex <= 0;
  document.getElementById('present-btn-next').disabled = _presentIndex >= _presentSlides.length - 1;
}

function presentNext() {
  if (_presentIndex < _presentSlides.length - 1) { _presentIndex++; _renderPresentSlide(); }
}
function presentPrev() {
  if (_presentIndex > 0) { _presentIndex--; _renderPresentSlide(); }
}
function closePresentationMode() {
  document.getElementById('presentation-overlay').classList.add('hidden');
}

// Keyboard for presentation
document.addEventListener('keydown', e => {
  const overlay = document.getElementById('presentation-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); presentNext(); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); presentPrev(); }
  if (e.key === 'Escape') closePresentationMode();
});

// ============================================================
// EXPORT EPUB (JSZip)
// ============================================================
async function generateEPUB(metadata, chaptersData) {
  // Dynamically load JSZip if not present
  if (typeof JSZip === 'undefined') {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const zip = new JSZip();

  // Mimetype (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // Styles
  const css = `
body { font-family: Georgia, 'Times New Roman', serif; margin: 2em; line-height: 1.6; text-align: justify; }
h1 { text-align: center; page-break-before: always; margin: 2em 0 1em; font-size: 1.4em; }
h1.book-title { font-size: 2em; page-break-before: auto; }
p { text-indent: 1.5em; margin: 0; }
p:first-of-type { text-indent: 0; }
.scene-break { text-align: center; margin: 1.5em 0; }
.copyright { font-size: 0.85em; color: #555; }`;
  zip.file('OEBPS/styles.css', css);

  const chapItems = chaptersData.map((c, i) => ({
    id: `chap${i + 1}`,
    file: `chapter${i + 1}.xhtml`,
    title: c.titre || `Chapitre ${c.numero}`,
    numero: c.numero,
  }));

  // Build chapter XHTMLs
  chaptersData.forEach((chap, i) => {
    const content = chap.contenuHtml || `<p>${esc(chap.contenu || '')}</p>`;
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${esc(chap.titre || `Chapitre ${chap.numero}`)}</title>
  <link rel="stylesheet" href="styles.css" type="text/css"/>
</head>
<body>
  <h1>${esc(chap.titre || `Chapitre ${chap.numero}`)}</h1>
  ${content}
</body>
</html>`;
    zip.file(`OEBPS/chapter${i + 1}.xhtml`, xhtml);
  });

  // Title page
  zip.file('OEBPS/title.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${esc(metadata.title)}</title><link rel="stylesheet" href="styles.css"/></head>
<body style="text-align:center;padding-top:30%">
  <h1 class="book-title">${esc(metadata.title)}</h1>
  <p>par ${esc(metadata.author)}</p>
</body>
</html>`);

  // Copyright
  zip.file('OEBPS/copyright.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Copyright</title><link rel="stylesheet" href="styles.css"/></head>
<body>
  <p class="copyright">Copyright &#169; ${new Date().getFullYear()} ${esc(metadata.author)}<br/>Tous droits réservés.</p>
  ${metadata.isbn ? `<p class="copyright">ISBN : ${esc(metadata.isbn)}</p>` : ''}
</body>
</html>`);

  // TOC (NCX)
  const tocItems = chapItems.map((c, i) => `
    <navPoint id="navPoint-${i+2}" playOrder="${i+2}">
      <navLabel><text>${esc(c.title)}</text></navLabel>
      <content src="${c.file}"/>
    </navPoint>`).join('');

  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${metadata.isbn || 'unknown'}"/>
  </head>
  <docTitle><text>${esc(metadata.title)}</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>Titre</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    ${tocItems}
  </navMap>
</ncx>`);

  // TOC XHTML (EPUB3)
  zip.file('OEBPS/toc.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Table des matières</title><link rel="stylesheet" href="styles.css"/></head>
<body>
  <h1>Table des matières</h1>
  <ol>${chapItems.map(c => `<li><a href="${c.file}">${esc(c.title)}</a></li>`).join('')}</ol>
</body>
</html>`);

  // Content OPF
  const manifest = [
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="toc-xhtml" href="toc.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="styles.css" media-type="text/css"/>',
    ...chapItems.map(c => `<item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`),
  ].join('\n    ');

  const spine = chapItems.map(c => `<itemref idref="${c.id}"/>`).join('\n    ');

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${esc(metadata.title)}</dc:title>
    <dc:creator>${esc(metadata.author)}</dc:creator>
    <dc:language>${metadata.language || 'fr'}</dc:language>
    <dc:identifier id="uid">${metadata.isbn || uid()}</dc:identifier>
    ${metadata.description ? `<dc:description>${esc(metadata.description)}</dc:description>` : ''}
  </metadata>
  <manifest>
    ${manifest}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title"/>
    <itemref idref="toc-xhtml"/>
    ${spine}
    <itemref idref="copyright"/>
  </spine>
</package>`);

  // Cover image if provided
  if (metadata.coverImage) {
    const b64 = metadata.coverImage.split(',')[1];
    if (b64) {
      zip.file('OEBPS/cover.jpg', b64, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = (metadata.title || 'livre').replace(/[^a-zA-Z0-9]/g, '_') + '.epub';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('EPUB généré avec succès !', 'success');
}

function exportEPUB() {
  const id = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres').sort((a,b) => a.numero - b.numero);
  const withContent = chapters.filter(c => c.contenu || c.contenuHtml);

  if (!withContent.length) {
    showToast('Aucun chapitre avec contenu à exporter', 'error');
    return;
  }

  const metadata = {
    title:       document.getElementById('epub-title')?.value  || getProjects().find(p => p.id === id)?.name || 'Livre',
    author:      document.getElementById('epub-author')?.value || 'Auteur',
    language:    document.getElementById('epub-language')?.value || 'fr',
    isbn:        document.getElementById('epub-isbn')?.value || '',
    description: document.getElementById('epub-description')?.value || '',
    coverImage:  document.getElementById('epub-cover-preview')?.src || null,
  };

  generateEPUB(metadata, withContent).catch(err => showToast('Erreur EPUB : ' + err.message, 'error'));
}

// ============================================================
// EXPORT PDF (Print CSS)
// ============================================================
function exportPDF() {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);
  const project  = getProjects().find(p => p.id === id);
  const metadata = {
    title:  document.getElementById('epub-title')?.value  || project?.name  || 'Livre',
    author: document.getElementById('epub-author')?.value || 'Auteur',
  };

  const chapContent = chapters.filter(c => c.contenu || c.contenuHtml).map(c => `
    <div class="pdf-chapter" style="page-break-before:always">
      <h1>${esc(c.titre || `Chapitre ${c.numero}`)}</h1>
      ${c.contenuHtml || c.contenu.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('')}
    </div>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${esc(metadata.title)}</title>
  <style>
    @page { margin: 2.5cm; size: A5; }
    body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.7; text-align: justify; color: #000; }
    h1 { text-align: center; font-size: 14pt; margin: 1em 0 2em; }
    .pdf-title-page { text-align: center; padding-top: 40%; page-break-after: always; }
    .pdf-title-page h1 { font-size: 22pt; }
    p { text-indent: 1.5em; margin: 0; }
    p:first-of-type { text-indent: 0; }
    .pdf-chapter { page-break-before: always; }
  </style>
</head>
<body>
  <div class="pdf-title-page">
    <h1>${esc(metadata.title)}</h1>
    <p>par ${esc(metadata.author)}</p>
  </div>
  ${chapContent}
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ============================================================
// PREVIEW EBOOK
// ============================================================
let _previewPages = [];
let _previewPage  = 0;

function openEbookPreview() {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);
  const project  = getProjects().find(p => p.id === id);

  _previewPages = [];

  // Title page
  _previewPages.push(`<div class="ereader-title-page">
    <h1>${esc(project?.name || 'Livre')}</h1>
    <p>par ${esc(project?.description || '')}</p>
  </div>`);

  // TOC
  const toc = chapters.filter(c => c.contenu || c.contenuHtml)
    .map(c => `<div class="ereader-toc-item">Chapitre ${c.numero} — ${esc(c.titre)}</div>`).join('');
  _previewPages.push(`<div class="ereader-toc"><h2>Table des matières</h2>${toc}</div>`);

  // Chapters (split into pages of ~400 words)
  chapters.filter(c => c.contenu || c.contenuHtml).forEach(chap => {
    const words  = (chap.contenu || '').split(/\s+/);
    const chunk  = 400;
    for (let i = 0; i < Math.max(1, Math.ceil(words.length / chunk)); i++) {
      const pageText = words.slice(i * chunk, (i + 1) * chunk).join(' ');
      _previewPages.push(`
        <div class="ereader-chapter">
          ${i === 0 ? `<h2>${esc(chap.titre || `Chapitre ${chap.numero}`)}</h2>` : ''}
          <p>${esc(pageText)}</p>
        </div>`);
    }
  });

  _previewPage = 0;
  _renderPreviewPage();
  openModal('modal-ebook-preview');
}

function _renderPreviewPage() {
  const el = document.getElementById('ereader-content');
  if (el) el.innerHTML = _previewPages[_previewPage] || '';
  const counter = document.getElementById('ereader-counter');
  if (counter) counter.textContent = `Page ${_previewPage + 1} sur ${_previewPages.length}`;
  document.getElementById('ereader-prev').disabled = _previewPage <= 0;
  document.getElementById('ereader-next').disabled = _previewPage >= _previewPages.length - 1;
}

function ereaderNext() { if (_previewPage < _previewPages.length - 1) { _previewPage++; _renderPreviewPage(); } }
function ereaderPrev() { if (_previewPage > 0) { _previewPage--; _renderPreviewPage(); } }

function ereaderSetFont(size) {
  const el = document.getElementById('ereader-content');
  if (el) el.style.fontSize = size + 'px';
}

function ereaderToggleNight() {
  const modal = document.getElementById('modal-ebook-preview');
  if (modal) modal.classList.toggle('ereader-night');
}

// ============================================================
// STATISTIQUES MANUSCRIT GLOBAL
// ============================================================
function renderManuscriptStats() {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);
  const persos   = getProjectData(id, 'personnages');
  const el       = document.getElementById('manuscript-global-stats');
  if (!el) return;

  const withContent = chapters.filter(c => c.contenu);
  const totalWords  = withContent.reduce((acc, c) => acc + wordCount(c.contenu), 0);
  const avgWords    = withContent.length ? Math.round(totalWords / withContent.length) : 0;
  const longest     = withContent.reduce((a, b) => wordCount(a.contenu) > wordCount(b.contenu) ? a : b, withContent[0]);
  const shortest    = withContent.reduce((a, b) => wordCount(a.contenu) < wordCount(b.contenu) ? a : b, withContent[0]);
  const readTime    = Math.ceil(totalWords / 250);

  const chapData = withContent.map(c => ({ label: `Ch.${c.numero}`, words: wordCount(c.contenu) }));
  const maxWords = Math.max(...chapData.map(c => c.words), 1);

  el.innerHTML = `
    <div class="manu-stats-grid">
      <div class="manu-stat"><span>${totalWords.toLocaleString('fr')}</span> Mots total</div>
      <div class="manu-stat"><span>${Math.ceil(totalWords / 250)}</span> Pages est. (250 m/p)</div>
      <div class="manu-stat"><span>${readTime}h</span> Temps lecture</div>
      <div class="manu-stat"><span>${avgWords.toLocaleString('fr')}</span> Mots/chapitre moy.</div>
      ${longest  ? `<div class="manu-stat"><span>Ch.${longest.numero}</span> Plus long (${wordCount(longest.contenu).toLocaleString('fr')} m)</div>` : ''}
      ${shortest ? `<div class="manu-stat"><span>Ch.${shortest.numero}</span> Plus court (${wordCount(shortest.contenu).toLocaleString('fr')} m)</div>` : ''}
    </div>
    <h4 style="margin:16px 0 8px">Longueur par chapitre</h4>
    <div class="manu-bars">
      ${chapData.map(c => `
        <div class="manu-bar-item" title="${c.words} mots">
          <div class="manu-bar" style="height:${Math.round((c.words / maxWords) * 80)}px"></div>
          <div class="manu-bar-label">${c.label}</div>
        </div>`).join('')}
    </div>

    <h4 style="margin:16px 0 8px">Alertes longueur</h4>
    <div>
      ${chapData.filter(c => c.words < 1000 && c.words > 0).map(c =>
        `<div class="manu-alert warning">⚠️ ${c.label} très court (${c.words} mots)</div>`).join('')}
      ${chapData.filter(c => c.words > 6000).map(c =>
        `<div class="manu-alert warning">⚠️ ${c.label} très long (${c.words} mots)</div>`).join('')}
      ${!chapData.filter(c => c.words < 1000 || c.words > 6000).length ?
        '<div style="color:#10B981;font-size:13px">✅ Toutes les longueurs semblent équilibrées.</div>' : ''}
    </div>`;
}

// ============================================================
// VALIDATEUR EPUB
// ============================================================
function validateEPUB() {
  const id      = state.currentProjectId;
  const project = getProjects().find(p => p.id === id);
  const chapters = getProjectData(id, 'chapitres');

  const checks = [];
  const addCheck = (label, pass, detail = '') => checks.push({ label, pass, detail });

  addCheck('Titre du livre défini',
    !!(document.getElementById('epub-title')?.value || project?.name));
  addCheck('Auteur défini',
    !!(document.getElementById('epub-author')?.value));
  addCheck('Au moins un chapitre avec contenu',
    chapters.some(c => c.contenu || c.contenuHtml));
  addCheck('Couverture uploadée',
    !!(document.getElementById('epub-cover-preview')?.src &&
       document.getElementById('epub-cover-preview').src !== window.location.href));
  addCheck('Description / 4e de couverture',
    !!(document.getElementById('epub-description')?.value));
  addCheck('ISBN renseigné',
    !!(document.getElementById('epub-isbn')?.value));
  addCheck('Tous chapitres ont un titre',
    chapters.every(c => c.titre));
  addCheck('Aucun chapitre vide dans l\'ordre',
    chapters.every(c => c.contenu || c.contenuHtml || (c.scenesIds && c.scenesIds.length)));

  const score = Math.round((checks.filter(c => c.pass).length / checks.length) * 100);
  const el = document.getElementById('epub-validation-results');
  if (!el) return;

  el.innerHTML = `
    <div class="epub-score" style="color:${score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'}">
      Score : ${score}/100
    </div>
    ${checks.map(c => `
      <div class="epub-check ${c.pass ? 'pass' : 'fail'}">
        <span>${c.pass ? '✅' : '❌'}</span>
        <span>${esc(c.label)}</span>
      </div>`).join('')}
    <div style="margin-top:12px">
      <button class="btn btn-primary" onclick="exportEPUB()">📥 Exporter quand même</button>
    </div>`;

  openModal('modal-epub-validator');
}

// ============================================================
// CHECKLIST PUBLICATION
// ============================================================
function getPublicationChecklist() {
  return JSON.parse(localStorage.getItem(`projet_${state.currentProjectId}_checklist`) || '[]');
}
function savePublicationChecklist(list) {
  localStorage.setItem(`projet_${state.currentProjectId}_checklist`, JSON.stringify(list));
}

const DEFAULT_CHECKLIST = [
  { id: 'c1',  cat: 'Contenu',     label: 'Tous les chapitres écrits' },
  { id: 'c2',  cat: 'Contenu',     label: 'Relu et corrigé' },
  { id: 'c3',  cat: 'Contenu',     label: 'Alpha/bêta-lecteurs' },
  { id: 'm1',  cat: 'Métadonnées', label: 'Titre définitif' },
  { id: 'm2',  cat: 'Métadonnées', label: 'Nom d\'auteur' },
  { id: 'm3',  cat: 'Métadonnées', label: 'ISBN obtenu' },
  { id: 'm4',  cat: 'Métadonnées', label: 'Description 4e de couverture' },
  { id: 'm5',  cat: 'Métadonnées', label: 'Mots-clés' },
  { id: 'f1',  cat: 'Fichiers',    label: 'Couverture professionnelle (1600x2400px)' },
  { id: 'f2',  cat: 'Fichiers',    label: 'Export EPUB validé' },
  { id: 'f3',  cat: 'Fichiers',    label: 'Test lecture sur liseuse' },
  { id: 'l1',  cat: 'Légal',       label: 'Copyright enregistré' },
  { id: 'l2',  cat: 'Légal',       label: 'Mentions légales' },
  { id: 'd1',  cat: 'Distribution','label': 'Compte KDP (Kindle) créé' },
  { id: 'd2',  cat: 'Distribution','label': 'Compte Kobo Writing Life' },
  { id: 'd3',  cat: 'Distribution','label': 'Compte Google Play Books' },
];

function renderPublicationChecklist() {
  const saved = getPublicationChecklist();
  const el    = document.getElementById('publication-checklist');
  if (!el) return;

  // Merge defaults with saved state
  const items = DEFAULT_CHECKLIST.map(item => ({
    ...item,
    done: saved.find(s => s.id === item.id)?.done || false,
  }));

  const byCategory = {};
  items.forEach(item => {
    if (!byCategory[item.cat]) byCategory[item.cat] = [];
    byCategory[item.cat].push(item);
  });

  const doneCount = items.filter(i => i.done).length;
  const score     = Math.round((doneCount / items.length) * 100);

  el.innerHTML = `
    <div class="checklist-score" style="margin-bottom:16px">
      <div class="checklist-progress">
        <div class="checklist-bar" style="width:${score}%"></div>
      </div>
      <span>${doneCount}/${items.length} complétés (${score}%)</span>
    </div>
    ${Object.entries(byCategory).map(([cat, catItems]) => `
      <div class="checklist-category">
        <h4>${cat}</h4>
        ${catItems.map(item => `
          <label class="checklist-item">
            <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem('${item.id}',this.checked)">
            <span ${item.done ? 'style="text-decoration:line-through;opacity:.6"' : ''}>${esc(item.label)}</span>
          </label>`).join('')}
      </div>`).join('')}`;
}

function toggleChecklistItem(id, done) {
  const saved = getPublicationChecklist();
  const idx   = saved.findIndex(s => s.id === id);
  if (idx !== -1) saved[idx].done = done;
  else saved.push({ id, done });
  savePublicationChecklist(saved);
  // Re-render score only
  const doneCount = DEFAULT_CHECKLIST.filter(item => {
    const s = saved.find(x => x.id === item.id);
    return s?.done;
  }).length;
  const score = Math.round((doneCount / DEFAULT_CHECKLIST.length) * 100);
  const bar   = document.querySelector('.checklist-bar');
  const label = document.querySelector('.checklist-score span');
  if (bar)   bar.style.width = score + '%';
  if (label) label.textContent = `${doneCount}/${DEFAULT_CHECKLIST.length} complétés (${score}%)`;
}

function openPublicationChecklist() {
  renderPublicationChecklist();
  openModal('modal-publication-checklist');
}

// ============================================================
// GÉNÉRATEUR PALETTES COULEURS
// ============================================================
function openPaletteGenerator() {
  document.getElementById('palette-results').innerHTML = '';
  document.getElementById('palette-manual').innerHTML = '';
  openModal('modal-palette-gen');
}

function extractPaletteFromImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    try {
      const ct = new ColorThief();
      const palette = ct.getPalette(img, 8);
      _displayExtractedPalette(palette.map(([r, g, b]) => `rgb(${r},${g},${b})`));
    } catch (err) {
      showToast('Erreur extraction palette', 'error');
    }
  };
  img.src = url;
  img.crossOrigin = 'anonymous';
}

function _displayExtractedPalette(colors) {
  const el = document.getElementById('palette-results');
  if (!el) return;
  el.innerHTML = `
    <h4>Palette extraite</h4>
    <div class="palette-swatches">
      ${colors.map(c => `
        <div class="palette-swatch" style="background:${c}" title="${c}"
             onclick="copyPaletteColor('${c}')">
          <span class="palette-hex">${_rgbToHex(c)}</span>
        </div>`).join('')}
    </div>
    <p style="font-size:12px;color:var(--gray-400)">Cliquez sur une couleur pour copier le code hex</p>`;
}

function _rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  return '#' + m.map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function copyPaletteColor(color) {
  const hex = _rgbToHex(color);
  navigator.clipboard?.writeText(hex).then(
    () => showToast(`${hex} copié !`, 'success'),
    () => showToast('Copie non supportée', 'error')
  );
}

function generateHarmony(baseColor, type) {
  const el = document.getElementById('palette-manual');
  if (!el) return;
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  const [h, s, l] = _rgbToHsl(r, g, b);

  let colors = [];
  if (type === 'complementaire') {
    colors = [baseColor, _hslToHex((h + 180) % 360, s, l)];
  } else if (type === 'analogue') {
    colors = [_hslToHex((h - 30 + 360) % 360, s, l), baseColor, _hslToHex((h + 30) % 360, s, l)];
  } else if (type === 'triadique') {
    colors = [baseColor, _hslToHex((h + 120) % 360, s, l), _hslToHex((h + 240) % 360, s, l)];
  } else if (type === 'nuances') {
    colors = [_hslToHex(h, s, 20), _hslToHex(h, s, 40), baseColor, _hslToHex(h, s, 70), _hslToHex(h, s, 85)];
  }

  el.innerHTML = `
    <h4>Harmonie ${type}</h4>
    <div class="palette-swatches">
      ${colors.map(c => `
        <div class="palette-swatch" style="background:${c}" onclick="copyPaletteColor('${c}')">
          <span class="palette-hex">${c.toUpperCase()}</span>
        </div>`).join('')}
    </div>`;
}

function _rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function _hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ============================================================
// CORRECTEUR ORTHOGRAPHE (LanguageTool API)
// ============================================================
let _spellcheckActive = false;
let _spellcheckResults = [];

async function runSpellcheck() {
  if (!editorState.quill) { showToast('Ouvrez un chapitre ou une scène pour vérifier', 'error'); return; }
  const text = editorState.quill.getText();
  if (!text.trim()) { showToast('Texte vide', 'error'); return; }

  showToast('Vérification en cours…');
  try {
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURIComponent(text)}&language=fr`,
    });
    if (!response.ok) throw new Error('API indisponible');
    const result = await response.json();
    _spellcheckResults = result.matches || [];
    _renderSpellcheckResults();
  } catch (err) {
    showToast('Correcteur indisponible (connexion requise). Erreur : ' + err.message, 'error');
  }
}

function _renderSpellcheckResults() {
  const el = document.getElementById('spellcheck-results');
  if (!el) return;

  if (!_spellcheckResults.length) {
    el.innerHTML = '<div style="color:#10B981">✅ Aucune erreur détectée !</div>';
    openModal('modal-spellcheck');
    return;
  }

  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px">${_spellcheckResults.length} problème${_spellcheckResults.length > 1 ? 's' : ''} détecté${_spellcheckResults.length > 1 ? 's' : ''}</div>
    ${_spellcheckResults.map((m, i) => `
      <div class="spell-issue">
        <div class="spell-text">"${esc(m.context?.text?.substring(m.context.offset, m.context.offset + m.context.length) || '')}"</div>
        <div class="spell-msg">${esc(m.message)}</div>
        ${m.replacements?.length ? `
          <div class="spell-suggestions">
            ${m.replacements.slice(0, 3).map(r => `
              <button class="btn btn-secondary btn-sm" onclick="applySpellFix(${i},'${r.value.replace(/'/g,"\\'")}')">
                ${esc(r.value)}
              </button>`).join('')}
          </div>` : ''}
      </div>`).join('')}`;
  openModal('modal-spellcheck');
}

function applySpellFix(matchIdx, replacement) {
  const match = _spellcheckResults[matchIdx];
  if (!match || !editorState.quill) return;
  const q = editorState.quill;
  q.deleteText(match.offset, match.length);
  q.insertText(match.offset, replacement);
  _spellcheckResults.splice(matchIdx, 1);
  _renderSpellcheckResults();
}

// ============================================================
// MOBILE IMPROVEMENTS (swipe gestures + FAB)
// ============================================================
function initMobileGestures() {
  let touchStartX = 0, touchStartY = 0;
  const SWIPE_THRESHOLD = 60;

  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx) * 0.8) return;

    const projectPage = document.getElementById('project-page');
    if (!projectPage || projectPage.classList.contains('hidden')) return;

    const SECTIONS = ['dashboard','personnages','lieux','chapitres','scenes','manuscrit','playlists','relations','timeline','notes'];
    const curIdx = SECTIONS.indexOf(state.currentSection);
    if (curIdx === -1) return;

    if (dx < -SWIPE_THRESHOLD && curIdx < SECTIONS.length - 1) {
      // Swipe left → next
      navigateTo(SECTIONS[curIdx + 1]);
    } else if (dx > SWIPE_THRESHOLD && curIdx > 0) {
      // Swipe right → prev
      navigateTo(SECTIONS[curIdx - 1]);
    }
  }, { passive: true });

  // Swipe right from edge → open sidebar
  document.addEventListener('touchend', e => {
    const startX = touchStartX;
    const dx     = e.changedTouches[0].screenX - startX;
    if (startX < 30 && dx > 80) {
      // Open sidebar on mobile
      document.getElementById('sidebar')?.classList.remove('hidden');
      document.getElementById('sidebar-overlay')?.classList.remove('hidden');
    }
  }, { passive: true });
}

// Auto-init mobile gestures on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileGestures);
} else {
  initMobileGestures();
}

// ============================================================
// SYNCHRONISATION MULTI-APPAREILS (JSONBin.io)
// ============================================================
const _SYNC_API    = 'https://api.jsonbin.io/v3/b';
const _SYNC_KEY_ID = 'wb_sync_bin_id';

function _syncGetAllData() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('projet') || k.startsWith('bibliotheque') || k.startsWith('versions_') || k.startsWith('wb_templates') || k.startsWith('wb_snippets'))) {
      out[k] = localStorage.getItem(k);
    }
  }
  return out;
}

function _syncApplyData(data) {
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
}

function _syncUpdateUI() {
  const binId = localStorage.getItem(_SYNC_KEY_ID);
  const bar   = document.getElementById('sync-status-bar');
  const push  = document.getElementById('btn-sync-push');
  const pull  = document.getElementById('btn-sync-pull');
  const disp  = document.getElementById('sync-code-display');
  const val   = document.getElementById('sync-code-value');
  if (!bar) return;
  if (binId) {
    bar.style.background  = 'var(--primary-light)';
    bar.style.color       = 'var(--primary-text)';
    bar.textContent       = '🟢 Sync activée — code : ' + binId.slice(-6).toUpperCase();
    if (push) push.disabled = false;
    if (pull) pull.disabled = false;
    if (disp) disp.style.display = '';
    if (val)  val.textContent    = binId.slice(-6).toUpperCase() + ' (' + binId + ')';
  } else {
    bar.style.background = 'var(--gray-100)';
    bar.style.color      = 'var(--gray-600)';
    bar.textContent      = '🔴 Synchronisation non configurée';
    if (push) push.disabled = true;
    if (pull) pull.disabled = true;
    if (disp) disp.style.display = 'none';
  }
}

async function syncCreate() {
  try {
    showToast('Création du code de sync…', 'info');
    const res = await fetch(_SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bin-Name': 'WorldBuilder Sync' },
      body: JSON.stringify(_syncGetAllData()),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const binId = json.metadata?.id;
    if (!binId) throw new Error('Pas d\'ID reçu');
    localStorage.setItem(_SYNC_KEY_ID, binId);
    _syncUpdateUI();
    showToast('Code de sync créé ! Copie-le pour le rejoindre sur tes autres appareils.', 'success');
  } catch (e) {
    showToast('Erreur création sync : ' + e.message, 'error');
  }
}

async function syncPush() {
  const binId = localStorage.getItem(_SYNC_KEY_ID);
  if (!binId) { showToast('Pas de sync configurée', 'error'); return; }
  try {
    showToast('Envoi en cours…', 'info');
    const res = await fetch(`${_SYNC_API}/${binId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_syncGetAllData()),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('Données envoyées ✓', 'success');
  } catch (e) {
    showToast('Erreur envoi : ' + e.message, 'error');
  }
}

async function syncPull() {
  const binId = localStorage.getItem(_SYNC_KEY_ID);
  if (!binId) { showToast('Pas de sync configurée', 'error'); return; }
  try {
    showToast('Récupération en cours…', 'info');
    const res = await fetch(`${_SYNC_API}/${binId}/latest`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    _syncApplyData(json.record || {});
    showToast('Données récupérées ✓ — rechargement…', 'success');
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast('Erreur récupération : ' + e.message, 'error');
  }
}

async function syncJoin() {
  const input = document.getElementById('sync-code-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) { showToast('Entre un code de sync', 'error'); return; }
  // Accept either full bin ID or short 6-char code — we store full ID
  // If short code: try to search... can't without master key. User must paste full ID.
  localStorage.setItem(_SYNC_KEY_ID, raw);
  _syncUpdateUI();
  showToast('Code enregistré — clique "Récupérer" pour charger les données.', 'success');
  input.value = '';
}

function syncCopyCode() {
  const binId = localStorage.getItem(_SYNC_KEY_ID);
  if (!binId) return;
  navigator.clipboard?.writeText(binId).then(() => showToast('Code copié !', 'success'))
    .catch(() => { prompt('Copie ce code :', binId); });
}

// Init sync UI whenever settings is rendered
const _origRenderSettings = typeof renderSettings === 'function' ? renderSettings : null;
document.addEventListener('DOMContentLoaded', () => {
  // Hook into renderSettings to refresh sync UI
  if (typeof renderSettings === 'function') {
    const _orig = renderSettings;
    window.renderSettings = function() { _orig.apply(this, arguments); _syncUpdateUI(); };
  }
  _syncUpdateUI();
});

// ============================================================
// NAVIGATE TO for new sections
// ============================================================
// Extend navigateTo handler (called from patched navigateTo in app.js)
function renderFeatureSection(section) {
  switch (section) {
    case 'citations': renderCitations(); break;
    case 'journal':   renderJournal();   break;
  }
}
