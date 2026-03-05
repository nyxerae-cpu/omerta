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

function _setSpellModalTitle(title) {
  const el = document.getElementById('spellcheck-title');
  if (el) el.textContent = title;
}

async function runSpellcheck() {
  if (!editorState.quill) { showToast('Ouvrez un chapitre ou une scène pour vérifier', 'error'); return; }
  const text = editorState.quill.getText();
  if (!text.trim()) { showToast('Texte vide', 'error'); return; }

  _setSpellModalTitle('Correcteur orthographique');

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

async function runGrammarCheck() {
  if (!editorState.quill) { showToast('Ouvrez un chapitre ou une scène pour vérifier', 'error'); return; }
  const text = editorState.quill.getText();
  if (!text.trim()) { showToast('Texte vide', 'error'); return; }

  _setSpellModalTitle('Correcteur grammatical');

  showToast('Analyse grammaticale en cours…');
  try {
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURIComponent(text)}&language=fr&enabledOnly=false`,
    });
    if (!response.ok) throw new Error('API indisponible');
    const result = await response.json();
    const matches = result.matches || [];

    _spellcheckResults = matches.filter(m => {
      const category = (m.rule && m.rule.category && m.rule.category.id) ? m.rule.category.id.toUpperCase() : '';
      const issue = (m.rule && m.rule.issueType) ? m.rule.issueType.toLowerCase() : '';
      return category.includes('GRAMMAR') || issue.includes('grammar') || issue.includes('typographical');
    });

    _renderSpellcheckResults('grammaire');
  } catch (err) {
    showToast('Analyse grammaticale indisponible (connexion requise). Erreur : ' + err.message, 'error');
  }
}

function _renderSpellcheckResults(mode = 'orthographe') {
  const el = document.getElementById('spellcheck-results');
  if (!el) return;

  if (!_spellcheckResults.length) {
    const okMsg = mode === 'grammaire'
      ? '✅ Aucune anomalie grammaticale détectée !'
      : '✅ Aucune erreur détectée !';
    el.innerHTML = `<div style="color:#10B981">${okMsg}</div>`;
    openModal('modal-spellcheck');
    return;
  }

  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px">${_spellcheckResults.length} problème${_spellcheckResults.length > 1 ? 's' : ''} détecté${_spellcheckResults.length > 1 ? 's' : ''}</div>
    ${_spellcheckResults.map((m, i) => `
      <div class="spell-issue">
        <div class="spell-text">"${esc(m.context?.text?.substring(m.context.offset, m.context.offset + m.context.length) || '')}"</div>
        <div class="spell-msg">${esc(m.message)}</div>
        <div class="spell-msg" style="margin-top:-2px;color:var(--gray-400)">${esc(m.rule?.description || '')}</div>
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

function detectEntitiesFromEditor() {
  if (!editorState.quill) {
    showToast('Ouvrez un chapitre ou une scène pour détecter les entrées', 'error');
    return;
  }
  const projectId = state.currentProjectId;
  if (!projectId) {
    showToast('Aucun projet ouvert', 'error');
    return;
  }

  const text = editorState.quill.getText() || '';
  if (!text.trim()) {
    showToast('Texte vide', 'error');
    return;
  }

  const existingChars = getCharactersForProject(projectId, true) || [];
  const existingLocs = getLocationsForProject(projectId, true) || [];
  const existingNames = new Set([
    ...existingChars.map(c => [c.prenom, c.nom].filter(Boolean).join(' ').trim().toLowerCase()),
    ...existingLocs.map(l => (l.nom || '').trim().toLowerCase()),
  ].filter(Boolean));

  const stopwords = new Set(['Le', 'La', 'Les', 'Un', 'Une', 'Des', 'Du', 'De', 'Et', 'Ou', 'Mais', 'Donc', 'Or', 'Ni', 'Car', 'Je', 'Tu', 'Il', 'Elle', 'Nous', 'Vous', 'Ils', 'Elles']);
  const pattern = /\b([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+){0,2})\b/g;
  const counts = new Map();
  const contexts = new Map();
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const raw = (m[1] || '').trim();
    if (!raw || stopwords.has(raw)) continue;
    const key = raw.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!contexts.has(key)) contexts.set(key, []);
    const start = Math.max(0, m.index - 24);
    const end = Math.min(text.length, m.index + raw.length + 24);
    contexts.get(key).push(text.slice(start, end).toLowerCase());
  }

  const candidates = [];
  counts.forEach((count, key) => {
    const name = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const isTwoPlusWords = key.includes(' ');
    if (count < 2 && !isTwoPlusWords) return;
    if (existingNames.has(key)) return;

    const ctx = (contexts.get(key) || []).join(' ');
    const placeHints = /(a\s|au\s|aux\s|dans\s|vers\s|ville|rue|quartier|chateau|for[eê]t|lac|mont|place\s)/.test(ctx);
    const type = placeHints ? 'lieux' : 'personnages';
    candidates.push({ name, type, count });
  });

  candidates.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  _setSpellModalTitle('Detection d\'entrees (persos/lieux)');
  const el = document.getElementById('spellcheck-results');
  if (!el) return;

  if (!candidates.length) {
    el.innerHTML = '<div style="color:#10B981">Aucune nouvelle entree detectee automatiquement.</div>';
    openModal('modal-spellcheck');
    return;
  }

  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px">${candidates.length} proposition${candidates.length > 1 ? 's' : ''} detectee${candidates.length > 1 ? 's' : ''}</div>
    ${candidates.map(c => `
      <div class="spell-issue">
        <div class="spell-text">${esc(c.name)}</div>
        <div class="spell-msg">Type suggere: <strong>${c.type === 'personnages' ? 'Personnage' : 'Lieu'}</strong> - ${c.count} occurrence(s)</div>
        <div class="spell-suggestions">
          <button class="btn btn-secondary btn-sm" onclick="createDetectedEntry('${c.name.replace(/'/g, "\\'")}', 'personnages')">+ Personnage</button>
          <button class="btn btn-secondary btn-sm" onclick="createDetectedEntry('${c.name.replace(/'/g, "\\'")}', 'lieux')">+ Lieu</button>
        </div>
      </div>
    `).join('')}
  `;
  openModal('modal-spellcheck');
}

function createDetectedEntry(name, type) {
  const projectId = state.currentProjectId;
  if (!projectId || !name || !type) return;

  if (type === 'personnages') {
    const chars = getProjectData(projectId, 'personnages') || [];
    const exists = chars.some(c => ([c.prenom, c.nom].filter(Boolean).join(' ').trim().toLowerCase() === name.toLowerCase()));
    if (exists) {
      showToast('Ce personnage existe deja', 'error');
      return;
    }
    const parts = name.trim().split(/\s+/);
    const prenom = parts.shift() || name;
    const nom = parts.join(' ');
    chars.push({
      id: uid(),
      prenom,
      nom,
      age: '',
      role: 'Secondaire',
      notes: 'Cree depuis detection automatique',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveProjectData(projectId, 'personnages', chars);
    if (typeof renderCharacters === 'function') renderCharacters();
    touchProject(projectId);
    showToast(`Personnage cree: ${name}`, 'success');
    return;
  }

  if (type === 'lieux') {
    const lieux = getProjectData(projectId, 'lieux') || [];
    const exists = lieux.some(l => (l.nom || '').trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast('Ce lieu existe deja', 'error');
      return;
    }
    lieux.push({
      id: uid(),
      nom: name,
      ville: '',
      type: 'Résidence',
      notes: 'Cree depuis detection automatique',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveProjectData(projectId, 'lieux', lieux);
    if (typeof renderLocations === 'function') renderLocations();
    touchProject(projectId);
    showToast(`Lieu cree: ${name}`, 'success');
  }
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

    const SECTIONS = ['dashboard','personnages','lieux','chapitres','scenes','manuscrit','playlists','relations','timeline','notes','assistant'];
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

// ============================================================
// ASSISTANT NARRATIF LOCAL
// ============================================================
const _ASSISTANT_GLOBAL_KNOWLEDGE_KEY = 'wb_assistant_global_knowledge';
const _ASSISTANT_GLOBAL_CONTEXT_KEY = 'wb_assistant_global_context';
const _ASSISTANT_GLOBAL_FACTS_KEY = 'wb_assistant_global_facts';
const _ASSISTANT_PROJECT_UI_COMPACT_KEY = 'wb_assistant_project_ui_compact';
const _ASSISTANT_DOC_CHUNK_CHARS = 3500;
const _ASSISTANT_DOC_MAX_CHUNKS_PER_FILE = 18;
const _ASSISTANT_DOC_MAX_FILES_PER_IMPORT = 6;
const _ASSISTANT_EYE_DEFS = [
  { key: 'bleu', variants: ['bleu', 'bleue', 'bleus', 'bleues'] },
  { key: 'vert', variants: ['vert', 'verte', 'verts', 'vertes'] },
  { key: 'marron', variants: ['marron', 'brun', 'bruns'] },
  { key: 'noir', variants: ['noir', 'noirs', 'noire', 'noires'] },
  { key: 'gris', variants: ['gris', 'grise', 'grisatre'] },
  { key: 'ambre', variants: ['ambre', 'ambres', 'dore', 'dores'] },
];

function _assistantReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}

function _assistantWriteJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function _assistantIsProjectCompactUI() {
  const raw = localStorage.getItem(_ASSISTANT_PROJECT_UI_COMPACT_KEY);
  if (raw == null) return true;
  return raw !== '0';
}

function _assistantApplyProjectUIMode() {
  const advancedPanel = document.getElementById('assistant-project-advanced');
  const toggleBtn = document.getElementById('assistant-toggle-advanced-btn');
  if (!toggleBtn) return;
  const compact = _assistantIsProjectCompactUI();
  if (advancedPanel) {
    advancedPanel.classList.toggle('hidden', compact);
  }
  toggleBtn.textContent = compact ? 'Afficher paramètres' : 'Masquer paramètres';
}

function assistantToggleAdvancedUI(forceExpanded) {
  const currentCompact = _assistantIsProjectCompactUI();
  const nextCompact = typeof forceExpanded === 'boolean' ? !forceExpanded : !currentCompact;
  localStorage.setItem(_ASSISTANT_PROJECT_UI_COMPACT_KEY, nextCompact ? '1' : '0');
  _assistantApplyProjectUIMode();
}

function _assistantGetScope() {
  const sel = document.getElementById('assistant-scope');
  const wanted = sel ? sel.value : 'project';
  if (wanted === 'universe' && !getProjectUniverseId(state.currentProjectId)) return 'project';
  return wanted || 'project';
}

function _assistantUniverseId() {
  return getProjectUniverseId(state.currentProjectId);
}

function _assistantScopeLabel(scope) {
  if (scope === 'universe') return 'univers';
  return 'livre';
}

function _assistantGetGlobalKnowledge() {
  const rows = _assistantReadJson(_ASSISTANT_GLOBAL_KNOWLEDGE_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function _assistantSaveGlobalKnowledge(rows) {
  _assistantWriteJson(_ASSISTANT_GLOBAL_KNOWLEDGE_KEY, rows || []);
}

function _assistantGetUniverseKnowledge() {
  const universeId = _assistantUniverseId();
  if (!universeId) return [];
  const rows = getUniverseData(universeId, 'assistant_knowledge') || [];
  return Array.isArray(rows) ? rows : [];
}

function _assistantSaveUniverseKnowledge(rows) {
  const universeId = _assistantUniverseId();
  if (!universeId) return;
  saveUniverseData(universeId, 'assistant_knowledge', rows || []);
}

function _assistantGetGlobalContext() {
  return String(localStorage.getItem(_ASSISTANT_GLOBAL_CONTEXT_KEY) || '').trim();
}

function _assistantGetGlobalFacts() {
  const rows = _assistantReadJson(_ASSISTANT_GLOBAL_FACTS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function _assistantSaveGlobalFacts(rows) {
  _assistantWriteJson(_ASSISTANT_GLOBAL_FACTS_KEY, rows || []);
}

function _assistantGetUniverseFacts() {
  const universeId = _assistantUniverseId();
  if (!universeId) return [];
  const rows = getUniverseData(universeId, 'assistant_facts') || [];
  return Array.isArray(rows) ? rows : [];
}

function _assistantSaveUniverseFacts(rows) {
  const universeId = _assistantUniverseId();
  if (!universeId) return;
  saveUniverseData(universeId, 'assistant_facts', rows || []);
}

function _assistantSaveGlobalContext(text) {
  localStorage.setItem(_ASSISTANT_GLOBAL_CONTEXT_KEY, String(text || '').trim());
}

function _assistantGetUniverseContext() {
  const universeId = _assistantUniverseId();
  if (!universeId) return '';
  const value = getUniverseData(universeId, 'assistant_context') || '';
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && value.text) return String(value.text).trim();
  return '';
}

function _assistantSaveUniverseContext(text) {
  const universeId = _assistantUniverseId();
  if (!universeId) return;
  saveUniverseData(universeId, 'assistant_context', { text: String(text || '').trim(), updatedAt: new Date().toISOString() });
}

function _assistantDefaultState() {
  return {
    knowledge: [],
    facts: [],
    contextProject: '',
    chat: [
      {
        role: 'assistant',
        text: 'Assistant narratif pret. Tu peux parler normalement. Exemple: "je veux creer un perso mais je n\'ai pas d\'idee".',
        ts: new Date().toISOString(),
      },
    ],
  };
}

function getAssistantState() {
  const key = `projet_${state.currentProjectId}_assistant`;
  const raw = localStorage.getItem(key);
  if (!raw) return _assistantDefaultState();
  try {
    const parsed = JSON.parse(raw);
    return {
      knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      contextProject: String(parsed.contextProject || ''),
      chat: Array.isArray(parsed.chat) && parsed.chat.length ? parsed.chat : _assistantDefaultState().chat,
    };
  } catch (_) {
    return _assistantDefaultState();
  }
}

function saveAssistantState(s) {
  if (!state.currentProjectId) return;
  localStorage.setItem(`projet_${state.currentProjectId}_assistant`, JSON.stringify(s));
}

function _assistantCategoryLabel(cat) {
  const map = {
    livre: 'Livre/source',
    trope: 'Trope',
    prenom: 'Prenom',
    regle: 'Regle ecriture',
    univers: 'Regle univers',
    note: 'Note',
    document: 'Document',
  };
  return map[cat] || cat;
}

function _assistantTargetLabel(target) {
  const map = {
    project: 'livre',
    universe: 'univers',
    global: 'global',
  };
  return map[target] || target;
}

function _assistantResolveTarget(targetRaw) {
  const target = targetRaw || 'project';
  if (target === 'universe' && !_assistantUniverseId()) return 'project';
  return target;
}

function _assistantMergeKnowledge(scope) {
  const projectRows = getAssistantState().knowledge || [];
  const universeRows = _assistantGetUniverseKnowledge();
  const globalRows = _assistantGetGlobalKnowledge();

  const bundles = scope === 'universe'
    ? [
      { source: 'global', rows: globalRows },
      { source: 'universe', rows: universeRows },
      { source: 'project', rows: projectRows },
    ]
    : [
      { source: 'global', rows: globalRows },
      { source: 'project', rows: projectRows },
    ];

  const out = [];
  const seen = new Set();
  bundles.forEach(({ source, rows }) => {
    rows.forEach(r => {
      if (!r || !r.text) return;
      const key = `${(r.category || 'note').toLowerCase()}|${String(r.text).trim().toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...r, _source: source });
    });
  });
  return out;
}

function _assistantFactsTarget() {
  const sel = document.getElementById('assistant-facts-target');
  const fallback = document.getElementById('assistant-kb-target');
  const wanted = sel ? sel.value : (fallback ? fallback.value : 'project');
  return _assistantResolveTarget(wanted || 'project');
}

function _assistantPushFact(target, fact) {
  if (target === 'global') {
    const rows = _assistantGetGlobalFacts();
    rows.push(fact);
    _assistantSaveGlobalFacts(rows);
    return;
  }
  if (target === 'universe') {
    const rows = _assistantGetUniverseFacts();
    rows.push(fact);
    _assistantSaveUniverseFacts(rows);
    return;
  }
  const s = getAssistantState();
  s.facts = s.facts || [];
  s.facts.push(fact);
  saveAssistantState(s);
}

function _assistantSetFacts(target, rows) {
  if (target === 'global') {
    _assistantSaveGlobalFacts(rows || []);
    return;
  }
  if (target === 'universe') {
    _assistantSaveUniverseFacts(rows || []);
    return;
  }
  const s = getAssistantState();
  s.facts = rows || [];
  saveAssistantState(s);
}

function _assistantMergeFacts(scope) {
  const s = getAssistantState();
  const projectRows = Array.isArray(s.facts) ? s.facts : [];
  const universeRows = _assistantGetUniverseFacts();
  const globalRows = _assistantGetGlobalFacts();

  const bundles = scope === 'universe'
    ? [
      { source: 'global', rows: globalRows },
      { source: 'universe', rows: universeRows },
      { source: 'project', rows: projectRows },
    ]
    : [
      { source: 'global', rows: globalRows },
      { source: 'project', rows: projectRows },
    ];

  const out = [];
  bundles.forEach(({ source, rows }) => {
    (rows || []).forEach(r => {
      if (!r || !r.entityType || !r.key || !String(r.value || '').trim()) return;
      out.push({ ...r, _source: source });
    });
  });
  return out;
}

function _assistantGetCombinedContext(scope) {
  const stateData = getAssistantState();
  const globalCtx = _assistantGetGlobalContext();
  const projectCtx = String(stateData.contextProject || '').trim();
  const universeCtx = _assistantGetUniverseContext();
  const pieces = scope === 'universe'
    ? [globalCtx, universeCtx, projectCtx]
    : [globalCtx, projectCtx];
  return pieces.filter(Boolean).join('\n\n');
}

function _assistantGetEditableContext(scope) {
  if (scope === 'universe' && _assistantUniverseId()) return _assistantGetUniverseContext();
  return String(getAssistantState().contextProject || '').trim();
}

function _assistantRemoveKnowledgeBySource(source, id) {
  if (!id) return;
  if (source === 'global') {
    const rows = _assistantGetGlobalKnowledge().filter(x => x.id !== id);
    _assistantSaveGlobalKnowledge(rows);
    return;
  }
  if (source === 'universe') {
    const rows = _assistantGetUniverseKnowledge().filter(x => x.id !== id);
    _assistantSaveUniverseKnowledge(rows);
    return;
  }
  const s = getAssistantState();
  s.knowledge = (s.knowledge || []).filter(x => x.id !== id);
  saveAssistantState(s);
}

function _assistantPushKnowledge(target, entry) {
  if (target === 'global') {
    const rows = _assistantGetGlobalKnowledge();
    rows.push(entry);
    _assistantSaveGlobalKnowledge(rows);
    return;
  }
  if (target === 'universe') {
    const rows = _assistantGetUniverseKnowledge();
    rows.push(entry);
    _assistantSaveUniverseKnowledge(rows);
    return;
  }
  const s = getAssistantState();
  s.knowledge = s.knowledge || [];
  s.knowledge.push(entry);
  saveAssistantState(s);
}

function _assistantSetKnowledge(target, rows) {
  if (target === 'global') {
    _assistantSaveGlobalKnowledge(rows || []);
    return;
  }
  if (target === 'universe') {
    _assistantSaveUniverseKnowledge(rows || []);
    return;
  }
  const s = getAssistantState();
  s.knowledge = rows || [];
  saveAssistantState(s);
}

function _assistantCurrentTarget() {
  const sel = document.getElementById('assistant-kb-target');
  return _assistantResolveTarget(sel ? sel.value : 'project');
}

function _assistantGetChapterFromQuery(queryText) {
  const chapters = (getProjectData(state.currentProjectId, 'chapitres') || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
  if (!chapters.length) return null;

  const m = (queryText || '').match(/chapitre\s*(\d{1,3})/i);
  if (m) {
    const wanted = parseInt(m[1], 10);
    const found = chapters.find(c => Number(c.numero) === wanted);
    if (found) return found;
  }

  if (typeof editorState !== 'undefined' && editorState.type === 'chapter' && editorState.id) {
    const current = chapters.find(c => c.id === editorState.id);
    if (current) return current;
  }

  return chapters[chapters.length - 1];
}

function _assistantRecommendMusic(queryText) {
  const chapter = _assistantGetChapterFromQuery(queryText);
  const playlists = getProjectData(state.currentProjectId, 'playlists') || [];
  const globalMusic = typeof getGlobalMusic === 'function' ? (getGlobalMusic() || []) : [];
  if (!playlists.length && !globalMusic.length) return 'Aucune musique disponible pour recommander.';

  const chapterText = chapter
    ? `${chapter.titre || ''} ${(chapter.notes || '')} ${(chapter.resume || '')} ${(chapter.contenu || '')}`.toLowerCase()
    : '';
  const query = (queryText || '').toLowerCase();
  const sample = `${chapterText} ${query}`;

  const moodWords = ['sombre', 'romantique', 'epique', 'tension', 'calme', 'melancolique', 'joyeux'];
  const matchedMood = moodWords.filter(w => sample.includes(w));
  const povId = chapter && chapter.pov ? chapter.pov : null;

  const candidates = [];
  playlists.forEach(p => {
    let score = 0;
    const reasons = [];
    const tagText = `${(p.nom || '')} ${(p.notes || '')} ${((p.tags || []).join(' '))}`.toLowerCase();
    matchedMood.forEach(m => {
      if (tagText.includes(m)) {
        score += 2;
        reasons.push(`mood:${m}`);
      }
    });
    if (povId && (p.associated || []).some(a => a && a.type === 'personnages' && a.id === povId)) {
      score += 3;
      reasons.push('liee-au-POV');
    }
    if ((query.includes('dialogue') || sample.includes('dialogue')) && tagText.includes('calme')) {
      score += 1;
      reasons.push('compatible-dialogue');
    }
    if (score > 0) {
      candidates.push({
        kind: 'playlist',
        playlistId: p.id,
        title: p.nom || 'Playlist',
        hint: (p.tags || []).slice(0, 3).join(', '),
        score,
        reasons,
      });
    }
  });

  globalMusic.forEach(m => {
    let score = 0;
    const reasons = [];
    const tagText = `${(m.titre || '')} ${(m.artiste || '')} ${(m.notes || '')} ${((m.tags || []).join(' '))} ${(m.mood || '')}`.toLowerCase();
    matchedMood.forEach(x => {
      if (tagText.includes(x)) {
        score += 2;
        reasons.push(`mood:${x}`);
      }
    });
    if ((query.includes('romance') || sample.includes('romance')) && tagText.includes('romant')) {
      score += 2;
      reasons.push('romance');
    }
    if ((query.includes('action') || sample.includes('combat')) && (tagText.includes('epique') || tagText.includes('tension'))) {
      score += 2;
      reasons.push('action-tension');
    }
    if (score > 0) {
      candidates.push({
        kind: 'musique',
        globalMusicId: m.id,
        title: `${m.titre || 'Titre inconnu'}${m.artiste ? ` - ${m.artiste}` : ''}`,
        hint: [m.mood || '', ...(m.tags || []).slice(0, 2)].filter(Boolean).join(', '),
        score,
        reasons,
      });
    }
  });

  if (!candidates.length) {
    const fallback = playlists.slice(0, 2).map(p => `- Playlist: ${p.nom || 'Sans nom'}`).join('\n');
    if (fallback) return `Je n'ai pas trouve de correspondance forte. Essaie ces options:\n${fallback}`;
    return 'Je n\'ai pas trouve de correspondance forte dans ta bibliotheque musicale.';
  }

  candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const top = candidates.slice(0, 4);
  const chapLabel = chapter ? `chapitre ${chapter.numero || '?'}` : 'chapitre courant';
  const maxScore = Math.max(1, ...top.map(c => c.score || 0));

  window._assistantMusicRecoCache = {
    queryText: queryText || '',
    chapterId: chapter ? chapter.id : null,
    chapterNumero: chapter ? chapter.numero : null,
    candidates: top,
    ts: Date.now(),
  };

  const moodBuckets = {};
  top.forEach(c => {
    (c.reasons || []).forEach(r => {
      if (!r.startsWith('mood:')) return;
      const m = r.replace('mood:', '');
      moodBuckets[m] = (moodBuckets[m] || 0) + 1;
    });
  });
  const moodSummary = Object.keys(moodBuckets).length
    ? `Cluster mood: ${Object.entries(moodBuckets).map(([k, v]) => `${k}(${v})`).join(', ')}`
    : 'Cluster mood: neutre';

  return [
    `Reco musique pour ${chapLabel}:`,
    ...top.map((c, i) => {
      const pct = Math.max(1, Math.min(100, Math.round((c.score / maxScore) * 100)));
      const why = (c.reasons || []).slice(0, 3).join(', ');
      return `${i + 1}. ${c.kind === 'playlist' ? 'Playlist' : 'Musique'} - ${c.title}${c.hint ? ` (${c.hint})` : ''} [score ${c.score} | pertinence ${pct}%${why ? ` | ${why}` : ''}]`;
    }),
    moodSummary,
    'Dis-moi "ajuste en plus sombre" ou "plus romantique" pour affiner.',
  ].join('\n');
}

function _assistantSuggestLibraryScene(queryText) {
  if (typeof getGlobalScenes !== 'function') return 'Bibliotheque de scenes indisponible.';
  const scenes = getGlobalScenes() || [];
  if (!scenes.length) return 'Aucune scene globale dans la bibliotheque.';
  const q = (queryText || '').toLowerCase();
  const chapter = _assistantGetChapterFromQuery(queryText);
  const base = `${q} ${(chapter && chapter.titre) || ''} ${(chapter && chapter.resume) || ''}`.toLowerCase();
  const keywords = ['conflit', 'romance', 'reve', 'action', 'trahison', 'revelation', 'tension', 'rencontre'];

  const scored = scenes.map(s => {
    const txt = `${s.titre || ''} ${s.description || ''} ${(s.tags || []).join(' ')} ${s.categorie || ''}`.toLowerCase();
    let score = 0;
    const reasons = [];
    keywords.forEach(k => {
      if (base.includes(k) && txt.includes(k)) {
        score += 2;
        reasons.push(`mot-cle:${k}`);
      }
    });
    if (base.includes('dialogue') && txt.includes('dialogue')) {
      score += 2;
      reasons.push('dialogue');
    }
    if (base.includes('tension') && txt.includes('tension')) {
      score += 1;
      reasons.push('tension');
    }
    return { s, score, reasons };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return 'Je ne vois pas de scene bibliotheque tres proche pour ce besoin.';
  const top = scored.slice(0, 3);
  const maxScore = Math.max(1, ...top.map(x => x.score || 0));
  return [
    'Scenes bibliotheque conseillees:',
    ...top.map((x, i) => {
      const pct = Math.max(1, Math.min(100, Math.round((x.score / maxScore) * 100)));
      const why = (x.reasons || []).slice(0, 3).join(', ');
      return `${i + 1}. ${x.s.titre || 'Scene sans titre'}${x.s.categorie ? ` (${x.s.categorie})` : ''} [score ${x.score} | pertinence ${pct}%${why ? ` | ${why}` : ''}]`;
    }),
  ].join('\n');
}

function _assistantCreateRecommendedPlaylistFromCache() {
  const cache = window._assistantMusicRecoCache;
  const id = state.currentProjectId;
  if (!id) return 'Aucun projet actif.';
  if (!cache || !Array.isArray(cache.candidates) || !cache.candidates.length) {
    return 'Aucune recommandation musique recente a convertir en playlist.';
  }

  const playlists = getProjectData(id, 'playlists') || [];
  const chapter = (getProjectData(id, 'chapitres') || []).find(c => c.id === cache.chapterId);
  const chapterLabel = chapter ? `Chapitre ${chapter.numero || '?'}` : 'Chapitre';
  const baseName = `Reco ${chapterLabel}`;
  let name = baseName;
  let idx = 2;
  while (playlists.some(p => (p.nom || '').trim().toLowerCase() === name.toLowerCase())) {
    name = `${baseName} (${idx++})`;
  }

  const globalMusic = typeof getGlobalMusic === 'function' ? (getGlobalMusic() || []) : [];
  const now = new Date().toISOString();
  const titres = [];
  const tags = new Set(['reco-auto', 'assistant']);
  let chosenUrl = '';

  cache.candidates.forEach(c => {
    (c.reasons || []).forEach(r => {
      if (r.startsWith('mood:')) tags.add(r.replace('mood:', ''));
    });

    if (c.kind === 'musique' && c.globalMusicId) {
      const m = globalMusic.find(x => x.id === c.globalMusicId);
      if (!m) return;
      titres.push({ titre: m.titre || c.title, artiste: m.artiste || '', globalMusicId: m.id });
      if (!chosenUrl && m.url) chosenUrl = m.url;
      return;
    }

    if (c.kind === 'playlist' && c.playlistId) {
      const src = playlists.find(p => p.id === c.playlistId);
      if (!src) return;
      if (!chosenUrl && src.url) chosenUrl = src.url;
      if (Array.isArray(src.titres) && src.titres.length) {
        src.titres.slice(0, 2).forEach(t => {
          titres.push({
            titre: t.titre || src.nom || c.title,
            artiste: t.artiste || '',
            globalMusicId: t.globalMusicId || null,
          });
        });
      } else {
        titres.push({ titre: src.nom || c.title, artiste: 'Playlist', globalMusicId: null });
      }
    }
  });

  if (!titres.length) {
    return 'Impossible de construire une playlist (aucune source exploitable).';
  }

  const associated = [];
  if (chapter) associated.push({ type: 'chapitres', id: chapter.id });

  playlists.push({
    id: uid(),
    nom: name,
    url: chosenUrl || '',
    image: '',
    tags: Array.from(tags).slice(0, 8),
    notes: `Generee automatiquement depuis recommandations assistant (${new Date().toLocaleString('fr-FR')}).`,
    associated,
    titres,
    createdAt: now,
    updatedAt: now,
  });

  saveProjectData(id, 'playlists', playlists);
  touchProject(id);
  if (state.currentSection === 'playlists') renderPlaylists();
  return `Playlist recommandee creee: ${name} (${titres.length} titre(s)).`;
}

function _assistantContradictionScan() {
  const chapters = getProjectData(state.currentProjectId, 'chapitres') || [];
  const chars = getCharactersForProject(state.currentProjectId, true) || [];
  const out = [];

  const eyeDefs = [
    { key: 'bleu', variants: ['bleu', 'bleue', 'bleus', 'bleues'] },
    { key: 'vert', variants: ['vert', 'verte', 'verts', 'vertes'] },
    { key: 'marron', variants: ['marron', 'brun', 'bruns'] },
    { key: 'noir', variants: ['noir', 'noirs', 'noire', 'noires'] },
    { key: 'gris', variants: ['gris', 'grise', 'grisatre'] },
    { key: 'ambre', variants: ['ambre', 'ambres', 'dore', 'dores'] },
  ];

  const makeSnippet = (rawText, centerIndex) => {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const start = Math.max(0, centerIndex - 70);
    const end = Math.min(text.length, centerIndex + 90);
    const s = text.slice(start, end).trim();
    return s.length > 160 ? `${s.slice(0, 157)}...` : s;
  };

  chars.forEach(c => {
    const name = [c.prenom, c.nom].filter(Boolean).join(' ').trim() || c.prenom || c.id;
    const eyes = (c.yeux || '').trim().toLowerCase();
    if (!name || !eyes) return;

    const seen = [];
    chapters.forEach(ch => {
      const raw = `${ch.titre || ''} ${ch.contenu || ''} ${ch.notes || ''}`;
      const text = raw.toLowerCase();
      const loweredName = name.toLowerCase();
      let cursor = 0;
      while (cursor < text.length) {
        const at = text.indexOf(loweredName, cursor);
        if (at === -1) break;
        const winStart = Math.max(0, at - 120);
        const winEnd = Math.min(text.length, at + loweredName.length + 120);
        const win = text.slice(winStart, winEnd);
        eyeDefs.forEach(def => {
          const hit = def.variants.find(v => win.includes(v));
          if (!hit) return;
          if (eyes.includes(def.key)) return;
          if (eyes.includes(hit)) return;
          seen.push({
            col: def.key,
            chap: ch.numero || '?',
            title: ch.titre || `Chapitre ${ch.numero || '?'}`,
            snippet: makeSnippet(raw, at),
          });
        });
        cursor = at + loweredName.length;
      }
    });

    const uniq = new Set();
    seen.forEach(conflicting => {
      const key = `${name}|${conflicting.chap}|${conflicting.col}`;
      if (uniq.has(key)) return;
      uniq.add(key);
      out.push(`- ${name}: fiche yeux="${c.yeux}", contradiction en chapitre ${conflicting.chap} (${conflicting.title}) -> "${conflicting.col}". Extrait: "${conflicting.snippet}"`);
    });
  });

  const events = getProjectData(state.currentProjectId, 'events') || [];
  const titles = new Set();
  events.forEach(e => {
    const t = (e.titre || '').trim().toLowerCase();
    if (!t) return;
    if (titles.has(t) && /(secret|revelation|révélation)/.test(t)) {
      out.push(`- Secret potentiellement revele plusieurs fois: "${e.titre}" (event id: ${e.id || 'inconnu'}, date: ${e.date || 'n/a'}).`);
    }
    titles.add(t);
  });

  if (!out.length) return 'Pas de contradiction evidente detectee sur les controles rapides.';
  return ['Controle contradiction avec references:', ...out.slice(0, 12)].join('\n');
}

function _assistantSuggestCustomSections(queryText) {
  const q = (queryText || '').toLowerCase();
  const suggestions = [];
  if (/mafia|gang|cartel|crime/.test(q)) {
    suggestions.push('Organisation criminelle: nom, hierarchie, territoires, allies, ennemis, codes.');
  }
  if (/magie|pouvoir|sort/.test(q)) {
    suggestions.push('Systeme de magie: cout, limites, ecoles, risques, contres.');
  }
  if (/enquete|police|mystere|mystere/.test(q)) {
    suggestions.push('Enquete: pistes, indices, suspects, alibis, timeline des preuves.');
  }
  if (!suggestions.length) {
    suggestions.push('Section "Organisation": nom, role, ressources, regles, membres, conflits.');
    suggestions.push('Section "Objet cle": proprietaire, origine, pouvoir, prix narratif, statut.');
  }
  return ['Sections custom utiles:', ...suggestions.map((s, i) => `${i + 1}. ${s}`)].join('\n');
}

function renderAssistant() {
  const projectId = state.currentProjectId;
  if (!projectId) return;
  _assistantApplyProjectUIMode();
  const scope = _assistantGetScope();
  const mergedKnowledge = _assistantMergeKnowledge(scope);

  assistantUpdateChatModeUI();

  const listEl = document.getElementById('assistant-kb-list');
  const statsEl = document.getElementById('assistant-kb-stats');
  if (listEl) {
    if (!mergedKnowledge.length) {
      listEl.innerHTML = '<div class="settings-hint">Aucune entree pour le moment.</div>';
    } else {
      const sorted = [...mergedKnowledge].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
      listEl.innerHTML = sorted.slice(0, 150).map((k, idx) => `
        <div class="assistant-kb-item">
          <div class="assistant-kb-meta">${esc(_assistantCategoryLabel(k.category))} - ${esc(new Date(k.ts || Date.now()).toLocaleDateString('fr'))} - ${esc(_assistantTargetLabel(k._source || 'project'))}</div>
          <div>${esc(k.text)}</div>
          <div style="margin-top:6px"><button class="btn btn-ghost btn-sm" onclick="assistantDeleteKnowledge('${k.id || idx}','${k._source || 'project'}')">Supprimer</button></div>
        </div>
      `).join('');
    }
  }

  if (statsEl) {
    const counts = { livre: 0, trope: 0, prenom: 0, regle: 0, univers: 0, note: 0 };
    mergedKnowledge.forEach(k => { if (counts[k.category] !== undefined) counts[k.category]++; });
    statsEl.textContent = `Portee ${_assistantScopeLabel(scope)} - ${mergedKnowledge.length} entree(s) - Livres ${counts.livre}, Tropes ${counts.trope}, Prenoms ${counts.prenom}, Regles ${counts.regle + counts.univers}`;
  }

  const chatEl = document.getElementById('assistant-chat');
  const s = getAssistantState();
  if (chatEl) {
    chatEl.innerHTML = (s.chat || []).map((m, msgIdx) => {
      const bubble = `<div class="assistant-bubble ${m.role}">${esc(m.text)}</div>`;
      const actions = (m.role === 'assistant' && Array.isArray(m.actions) && m.actions.length)
        ? `<div class="assistant-action-row">${m.actions.map((a, actIdx) =>
          `${
            `<button class="btn btn-secondary btn-sm assistant-action-btn ${a.done ? 'done' : ''}" ${a.done ? 'disabled' : `onclick="assistantRunChatAction(${msgIdx}, ${actIdx})"`}>
              ${esc(a.done ? `✓ ${a.label || 'Action'} (faite)` : (a.label || 'Action'))}
            </button>`
          }${
            (a.done && _assistantIsReplayableAction(a))
              ? `<button class="btn btn-ghost btn-sm assistant-action-replay" onclick="assistantReplayChatAction(${msgIdx}, ${actIdx})">↺ Rejouer</button>`
              : ''
          }`
        ).join('')}</div>`
        : '';
      return `${bubble}${actions}`;
    }).join('');
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  const contextEl = document.getElementById('assistant-global-context');
  if (contextEl && document.activeElement !== contextEl) {
    contextEl.value = _assistantGetEditableContext(scope);
  }

  const brainEl = document.getElementById('assistant-brain-results');
  if (brainEl && window._assistantBrainDraft && !brainEl.dataset.locked) {
    _assistantRenderBrainResults(window._assistantBrainDraft);
  }

  assistantRenderCanonicalFactsReport();
}

function renderAssistantHubLibrary() {
  const page = document.getElementById('assistant-library-page');
  if (!page || page.classList.contains('hidden')) return;

  const rows = _assistantGetGlobalKnowledge().slice().sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
  const listEl = document.getElementById('assistant-hub-kb-list');
  const statsEl = document.getElementById('assistant-hub-kb-stats');
  const ctxEl = document.getElementById('assistant-hub-global-context');
  const factsStatsEl = document.getElementById('assistant-hub-facts-stats');

  if (ctxEl && document.activeElement !== ctxEl) {
    ctxEl.value = _assistantGetGlobalContext();
  }

  if (listEl) {
    if (!rows.length) {
      listEl.innerHTML = '<div class="settings-hint">Aucune entree globale pour le moment.</div>';
    } else {
      listEl.innerHTML = rows.slice(0, 220).map((k, idx) => `
        <div class="assistant-kb-item">
          <div class="assistant-kb-meta">${esc(_assistantCategoryLabel(k.category || 'note'))} - ${esc(new Date(k.ts || Date.now()).toLocaleDateString('fr'))}</div>
          <div>${esc(String(k.text || '').slice(0, 900))}${String(k.text || '').length > 900 ? ' ...' : ''}</div>
          <div style="margin-top:6px"><button class="btn btn-ghost btn-sm" onclick="assistantHubDeleteKnowledge('${k.id || idx}')">Supprimer</button></div>
        </div>
      `).join('');
    }
  }

  if (statsEl) {
    const counts = { livre: 0, trope: 0, prenom: 0, regle: 0, univers: 0, note: 0, document: 0 };
    rows.forEach(k => {
      if (counts[k.category] !== undefined) counts[k.category]++;
    });
    statsEl.textContent = `Base globale: ${rows.length} entree(s) - Livres ${counts.livre}, Tropes ${counts.trope}, Prenoms ${counts.prenom}, Regles ${counts.regle + counts.univers}, Docs ${counts.document}`;
  }

  if (factsStatsEl) {
    const facts = _assistantGetGlobalFacts();
    factsStatsEl.textContent = `Faits canoniques globaux: ${facts.length}`;
  }
}

function assistantGenerateCanonicalFacts() {
  const target = _assistantFactsTarget();
  const id = state.currentProjectId;
  const now = new Date().toISOString();
  let added = 0;

  const existing = [];
  if (target === 'global') existing.push(..._assistantGetGlobalFacts());
  else if (target === 'universe') existing.push(..._assistantGetUniverseFacts());
  else existing.push(...(getAssistantState().facts || []));

  const seen = new Set(existing.map(f => `${f.entityType}|${f.entityId || f.entityName || ''}|${f.key}|${String(f.value || '').toLowerCase()}`));

  const pushFact = (fact) => {
    const value = String(fact.value || '').trim();
    if (!value) return;
    const key = `${fact.entityType}|${fact.entityId || fact.entityName || ''}|${fact.key}|${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    _assistantPushFact(target, {
      id: uid(),
      entityType: fact.entityType,
      entityId: fact.entityId || null,
      entityName: fact.entityName || '',
      key: fact.key,
      value,
      sourceText: fact.sourceText || 'fiches projet',
      ts: now,
    });
    added++;
  };

  const chars = getCharactersForProject(id, true) || [];
  chars.forEach(c => {
    const name = [c.prenom, c.nom].filter(Boolean).join(' ').trim() || c.prenom || c.id;
    pushFact({ entityType: 'personnage', entityId: c.id, entityName: name, key: 'yeux', value: c.yeux || '' });
    pushFact({ entityType: 'personnage', entityId: c.id, entityName: name, key: 'cheveux', value: c.cheveux || '' });
    pushFact({ entityType: 'personnage', entityId: c.id, entityName: name, key: 'age', value: c.age || '' });
    pushFact({ entityType: 'personnage', entityId: c.id, entityName: name, key: 'role', value: c.role || '' });
  });

  const lieux = getLocationsForProject(id, true) || [];
  lieux.forEach(l => {
    const name = (l.nom || '').trim() || l.id;
    pushFact({ entityType: 'lieu', entityId: l.id, entityName: name, key: 'ville', value: l.ville || '' });
    pushFact({ entityType: 'lieu', entityId: l.id, entityName: name, key: 'type', value: l.type || '' });
  });

  touchProject(id);
  assistantRenderCanonicalFactsReport();
  showToast(`${added} fait(s) canonique(s) ajoute(s) dans ${_assistantTargetLabel(target)}`, 'success');
}

function _assistantComputeCanonicalFactCheck(scope) {
  const facts = _assistantMergeFacts(scope);
  const report = [];
  const chapters = getProjectData(state.currentProjectId, 'chapitres') || [];

  const entityFilter = document.getElementById('assistant-facts-entity-filter')?.value || '';
  const filteredFacts = entityFilter ? facts.filter(f => f.entityType === entityFilter) : facts;

  const byCanonicalKey = new Map();
  filteredFacts.forEach(f => {
    const k = `${f.entityType}|${f.entityId || f.entityName}|${f.key}`;
    if (!byCanonicalKey.has(k)) byCanonicalKey.set(k, []);
    byCanonicalKey.get(k).push(f);
  });

  byCanonicalKey.forEach((rows, k) => {
    const values = Array.from(new Set(rows.map(r => String(r.value || '').trim().toLowerCase()).filter(Boolean)));
    if (values.length > 1) {
      const first = rows[0];
      report.push({
        severity: 'warning',
        title: `Fait canonique ambigu: ${first.entityName || first.entityId} - ${first.key}`,
        text: `Plusieurs valeurs canoniques detectees: ${values.join(' / ')}`,
        meta: `Sources: ${Array.from(new Set(rows.map(r => r._source || 'project'))).join(', ')}`,
      });
    }
  });

  // Text contradiction check for character eye color against chapters.
  filteredFacts
    .filter(f => f.entityType === 'personnage' && f.key === 'yeux' && String(f.value || '').trim())
    .forEach(f => {
      const canon = String(f.value || '').toLowerCase();
      const name = (f.entityName || '').toLowerCase();
      if (!name) return;
      chapters.forEach(ch => {
        const raw = `${ch.titre || ''} ${ch.contenu || ''} ${ch.notes || ''}`;
        const low = raw.toLowerCase();
        const at = low.indexOf(name);
        if (at === -1) return;
        const win = low.slice(Math.max(0, at - 120), Math.min(low.length, at + name.length + 120));
        _ASSISTANT_EYE_DEFS.forEach(def => {
          const has = def.variants.some(v => win.includes(v));
          if (!has) return;
          if (canon.includes(def.key)) return;
          const snippet = raw.replace(/\s+/g, ' ').trim().slice(Math.max(0, at - 60), Math.max(0, at - 60) + 150);
          report.push({
            severity: 'error',
            title: `Contradiction texte: ${f.entityName} (yeux)` ,
            text: `Canon="${f.value}" mais chapitre ${ch.numero || '?'} mentionne "${def.key}".`,
            meta: snippet ? `Extrait: ${snippet}` : '',
          });
        });
      });
    });

  return {
    factsCount: filteredFacts.length,
    warnings: report.filter(r => r.severity === 'warning').length,
    errors: report.filter(r => r.severity === 'error').length,
    items: report.slice(0, 60),
  };
}

function assistantRenderCanonicalFactsReport() {
  const summaryEl = document.getElementById('assistant-facts-summary');
  const reportEl = document.getElementById('assistant-facts-report');
  if (!summaryEl || !reportEl || !state.currentProjectId) return;

  const scope = _assistantGetScope();
  const result = _assistantComputeCanonicalFactCheck(scope);
  summaryEl.textContent = `Faits canoniques: ${result.factsCount} - ${result.errors} erreur(s), ${result.warnings} avertissement(s).`;

  if (!result.items.length) {
    reportEl.innerHTML = '<div class="settings-hint">Aucune contradiction canonique detectee pour le moment.</div>';
    return;
  }

  reportEl.innerHTML = result.items.map(it => `
    <div class="assistant-fact-item ${it.severity}">
      <div><strong>${esc(it.title || 'Alerte canonique')}</strong></div>
      <div>${esc(it.text || '')}</div>
      ${it.meta ? `<div class="assistant-fact-meta">${esc(it.meta)}</div>` : ''}
    </div>
  `).join('');
}

function assistantRunCanonicalFactCheck() {
  assistantRenderCanonicalFactsReport();
  showToast('Controle des faits canoniques mis a jour', 'success');
}

function assistantClearCanonicalFactsConfirm() {
  const target = _assistantFactsTarget();
  showConfirm(`Vider les faits canoniques (${_assistantTargetLabel(target)}) ?`, '', () => {
    _assistantSetFacts(target, []);
    assistantRenderCanonicalFactsReport();
    showToast('Faits canoniques vides', 'success');
  });
}

function assistantAddKnowledge() {
  const category = document.getElementById('assistant-kb-category')?.value || 'note';
  const text = (document.getElementById('assistant-kb-input')?.value || '').trim();
  if (!text) { showToast('Ajoute un contenu', 'error'); return; }

  const target = _assistantCurrentTarget();
  _assistantPushKnowledge(target, { id: uid(), category, text, ts: new Date().toISOString() });
  document.getElementById('assistant-kb-input').value = '';
  renderAssistant();
  showToast(`Ajoute a la base assistant (${_assistantTargetLabel(target)})`, 'success');
}

function assistantHubAddKnowledge() {
  const category = document.getElementById('assistant-hub-kb-category')?.value || 'note';
  const inputEl = document.getElementById('assistant-hub-kb-input');
  const text = String(inputEl?.value || '').trim();
  if (!text) {
    showToast('Ajoute un contenu', 'error');
    return;
  }
  _assistantPushKnowledge('global', { id: uid(), category, text, ts: new Date().toISOString() });
  if (inputEl) inputEl.value = '';
  renderAssistantHubLibrary();
  showToast('Ajoute a la base globale assistant', 'success');
}

function assistantHubDeleteKnowledge(id) {
  if (!id) return;
  _assistantRemoveKnowledgeBySource('global', id);
  renderAssistantHubLibrary();
}

function assistantHubImportBulk() {
  const bulkEl = document.getElementById('assistant-hub-bulk-input');
  const raw = String(bulkEl?.value || '').trim();
  if (!raw) {
    showToast('Rien a importer', 'error');
    return;
  }

  let added = 0;
  raw.split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
    let category = 'note';
    let text = line;
    const m = line.match(/^(livre|trope|prenom|regle|univers|note)\s*:\s*(.+)$/i);
    if (m) {
      category = String(m[1] || 'note').toLowerCase();
      text = String(m[2] || '').trim();
    }
    if (!text) return;
    _assistantPushKnowledge('global', { id: uid(), category, text, ts: new Date().toISOString() });
    added++;
  });

  if (bulkEl) bulkEl.value = '';
  renderAssistantHubLibrary();
  showToast(`${added} entree(s) importee(s) dans la base globale`, 'success');
}

function assistantHubClearKnowledgeConfirm() {
  showConfirm('Vider toute la base globale assistant ?', '', () => {
    _assistantSetKnowledge('global', []);
    renderAssistantHubLibrary();
    showToast('Base globale assistant videe', 'success');
  });
}

function assistantHubSaveContext() {
  const ctx = document.getElementById('assistant-hub-global-context')?.value || '';
  _assistantSaveGlobalContext(ctx);
  renderAssistantHubLibrary();
  showToast('Contexte global enregistre', 'success');
}

function assistantHubExportKnowledge() {
  const payload = {
    exportedAt: new Date().toISOString(),
    scope: 'global',
    knowledge: _assistantGetGlobalKnowledge(),
    context: _assistantGetGlobalContext(),
    facts: _assistantGetGlobalFacts(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'assistant_global_library.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function assistantHubImportKnowledgeFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    const rows = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.knowledge) ? parsed.knowledge : []);

    const existing = _assistantGetGlobalKnowledge();
    const seen = new Set(existing.map(r => `${String(r.category || 'note').toLowerCase()}|${String(r.text || '').trim().toLowerCase()}`));
    let added = 0;

    rows.forEach(r => {
      if (!r || !r.text) return;
      const category = String(r.category || 'note').toLowerCase();
      const text = String(r.text || '').trim();
      if (!text) return;
      const key = `${category}|${text.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      existing.push({
        id: uid(),
        category,
        text,
        ts: r.ts || new Date().toISOString(),
        meta: r && typeof r.meta === 'object' ? r.meta : null,
      });
      added++;
    });

    _assistantSaveGlobalKnowledge(existing);

    if (parsed && typeof parsed.context === 'string' && parsed.context.trim()) {
      _assistantSaveGlobalContext(parsed.context);
    }

    if (parsed && Array.isArray(parsed.facts) && parsed.facts.length) {
      const facts = _assistantGetGlobalFacts();
      parsed.facts.forEach(f => {
        if (!f || !f.entityType || !f.key || !String(f.value || '').trim()) return;
        facts.push({
          id: uid(),
          entityType: f.entityType,
          entityId: f.entityId || null,
          entityName: f.entityName || '',
          key: f.key,
          value: String(f.value || '').trim(),
          sourceText: f.sourceText || 'import',
          ts: f.ts || new Date().toISOString(),
        });
      });
      _assistantSaveGlobalFacts(facts);
    }

    renderAssistantHubLibrary();
    showToast(`Import global termine (${added} entree(s))`, 'success');
  } catch (err) {
    showToast('Import impossible: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}

function _assistantNormalizeDocText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function _assistantDocExt(name = '') {
  const i = name.lastIndexOf('.');
  if (i === -1) return '';
  return name.slice(i + 1).toLowerCase();
}

function _assistantSplitDocChunks(text) {
  const norm = _assistantNormalizeDocText(text);
  if (!norm) return [];
  const paras = norm.split(/\n\n+/).map(x => x.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  paras.forEach(p => {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length <= _ASSISTANT_DOC_CHUNK_CHARS) {
      current = candidate;
      return;
    }
    if (current) chunks.push(current);
    if (p.length <= _ASSISTANT_DOC_CHUNK_CHARS) {
      current = p;
      return;
    }
    for (let i = 0; i < p.length; i += _ASSISTANT_DOC_CHUNK_CHARS) {
      chunks.push(p.slice(i, i + _ASSISTANT_DOC_CHUNK_CHARS));
    }
    current = '';
  });
  if (current) chunks.push(current);
  return chunks.slice(0, _ASSISTANT_DOC_MAX_CHUNKS_PER_FILE);
}

function _assistantLoadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src=\"${url}\"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Echec chargement script: ${url}`)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = '1';
      resolve();
    };
    s.onerror = () => reject(new Error(`Echec chargement script: ${url}`));
    document.head.appendChild(s);
  });
}

async function _assistantEnsurePdfJsLoaded() {
  if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') return;
  const candidates = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
  ];
  let lastErr = null;
  for (const url of candidates) {
    try {
      await _assistantLoadScriptOnce(url);
      if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(lastErr ? lastErr.message : 'Lecteur PDF non disponible');
}

async function _assistantEnsureMammothLoaded() {
  if (window.mammoth && typeof window.mammoth.extractRawText === 'function') return;
  const candidates = [
    'https://unpkg.com/mammoth/mammoth.browser.min.js',
    'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  ];
  let lastErr = null;
  for (const url of candidates) {
    try {
      await _assistantLoadScriptOnce(url);
      if (window.mammoth && typeof window.mammoth.extractRawText === 'function') return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(lastErr ? lastErr.message : 'Lecteur DOCX non disponible');
}

async function _assistantExtractPdfText(file) {
  await _assistantEnsurePdfJsLoaded();
  try {
    if (window.pdfjsLib.GlobalWorkerOptions) {
      // Prefer no worker in constrained standalone/PWA contexts.
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  } catch (_) {
    // Ignore worker setup issues and let pdf.js fallback.
  }
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const txt = (content.items || []).map(it => it.str || '').join(' ').trim();
    if (txt) pages.push(`Page ${p}: ${txt}`);
  }
  return pages.join('\n\n');
}

async function _assistantExtractDocxText(file) {
  await _assistantEnsureMammothLoaded();
  const buf = await file.arrayBuffer();
  const out = await window.mammoth.extractRawText({ arrayBuffer: buf });
  return String(out && out.value ? out.value : '');
}

async function _assistantExtractDocumentText(file) {
  const ext = _assistantDocExt(file && file.name ? file.name : '');
  if (ext === 'pdf') return _assistantExtractPdfText(file);
  if (ext === 'docx') return _assistantExtractDocxText(file);
  if (['txt', 'md', 'rtf'].includes(ext)) return file.text();
  if (ext === 'doc') {
    throw new Error('Le format .doc ancien n\'est pas supporte ici. Convertis en .docx ou .pdf.');
  }
  throw new Error(`Format non supporte: .${ext || 'inconnu'}`);
}

async function assistantHubImportDocumentFiles(event) {
  const files = Array.from((event.target && event.target.files) || []);
  if (!files.length) return;

  const selected = files.slice(0, _ASSISTANT_DOC_MAX_FILES_PER_IMPORT);
  const existing = _assistantGetGlobalKnowledge();
  let addedChunks = 0;
  const failures = [];
  const now = new Date().toISOString();

  for (const file of selected) {
    try {
      const text = await _assistantExtractDocumentText(file);
      const chunks = _assistantSplitDocChunks(text);
      if (!chunks.length) {
        failures.push(`${file.name}: aucun texte detecte`);
        continue;
      }
      chunks.forEach((chunk, i) => {
        existing.push({
          id: uid(),
          category: 'document',
          text: chunk,
          ts: now,
          meta: {
            fileName: file.name,
            mimeType: file.type || '',
            size: Number(file.size || 0),
            chunkIndex: i + 1,
            chunkTotal: chunks.length,
          },
        });
        addedChunks++;
      });
    } catch (err) {
      failures.push(`${file.name}: ${err && err.message ? err.message : 'erreur'}`);
    }
  }

  _assistantSaveGlobalKnowledge(existing);
  renderAssistantHubLibrary();

  if (addedChunks > 0) {
    showToast(`Import documents termine: ${addedChunks} extrait(s) ajoute(s)`, 'success');
  }
  if (failures.length) {
    showToast(`Fichiers ignores: ${failures.slice(0, 2).join(' | ')}`, 'error');
  }
  event.target.value = '';
}

function assistantDeleteKnowledge(id, source) {
  const src = source || 'project';
  _assistantRemoveKnowledgeBySource(src, id);
  renderAssistant();
}

function assistantImportBulk() {
  const raw = (document.getElementById('assistant-bulk-input')?.value || '').trim();
  if (!raw) { showToast('Rien a importer', 'error'); return; }

  const target = _assistantCurrentTarget();
  let added = 0;
  raw.split('\n').map(x => x.trim()).filter(Boolean).forEach(line => {
    let category = 'note';
    let text = line;
    const m = line.match(/^(livre|trope|prenom|regle|univers|note)\s*:\s*(.+)$/i);
    if (m) {
      category = m[1].toLowerCase();
      text = m[2].trim();
    }
    if (!text) return;
    _assistantPushKnowledge(target, { id: uid(), category, text, ts: new Date().toISOString() });
    added++;
  });

  document.getElementById('assistant-bulk-input').value = '';
  renderAssistant();
  showToast(`${added} entree(s) importee(s) dans ${_assistantTargetLabel(target)}`, 'success');
}

function assistantClearKnowledgeConfirm() {
  const target = _assistantCurrentTarget();
  showConfirm(`Vider la base assistant (${_assistantTargetLabel(target)}) ?`, '', () => {
    _assistantSetKnowledge(target, []);
    renderAssistant();
    showToast('Base assistant videe', 'success');
  });
}

function assistantExportKnowledge() {
  const scope = _assistantGetScope();
  const payload = {
    exportedAt: new Date().toISOString(),
    projectId: state.currentProjectId,
    scope,
    knowledge: _assistantMergeKnowledge(scope),
    context: _assistantGetCombinedContext(scope),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `assistant_base_${state.currentProjectId}_${scope}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function assistantImportKnowledgeFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const target = _assistantCurrentTarget();
  try {
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.knowledge) ? parsed.knowledge : []);
    if (!rows.length) throw new Error('Aucune entree');
    let added = 0;
    rows.forEach(r => {
      if (!r || !r.text) return;
      _assistantPushKnowledge(target, {
        id: uid(),
        category: r.category || 'note',
        text: String(r.text).trim(),
        ts: r.ts || new Date().toISOString(),
      });
      added++;
    });
    renderAssistant();
    showToast(`Import assistant termine (${added})`, 'success');
  } catch (err) {
    showToast('Import impossible: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}

function assistantUpdateChatModeUI() {
  const mode = document.getElementById('assistant-chat-mode')?.value || 'coach';
  const wrapPersona = document.getElementById('assistant-mode-persona-wrap');
  const wrapGroup = document.getElementById('assistant-mode-group-wrap');
  if (wrapPersona) wrapPersona.style.display = mode === 'persona' ? '' : 'none';
  if (wrapGroup) wrapGroup.style.display = mode === 'group' ? '' : 'none';

  const chars = getCharactersForProject(state.currentProjectId, true) || [];
  const personaSel = document.getElementById('assistant-persona-id');
  const groupSel = document.getElementById('assistant-group-ids');

  if (personaSel) {
    const prev = personaSel.value;
    personaSel.innerHTML = chars.map(c => {
      const name = [c.prenom, c.nom].filter(Boolean).join(' ');
      return `<option value="${c.id}">${esc(name || c.id)}</option>`;
    }).join('');
    if (prev && chars.some(c => c.id === prev)) personaSel.value = prev;
  }

  if (groupSel) {
    const prev = Array.from(groupSel.selectedOptions || []).map(o => o.value);
    groupSel.innerHTML = chars.map(c => {
      const name = [c.prenom, c.nom].filter(Boolean).join(' ');
      return `<option value="${c.id}">${esc(name || c.id)}</option>`;
    }).join('');
    prev.forEach(id => {
      const opt = groupSel.querySelector(`option[value="${id}"]`);
      if (opt) opt.selected = true;
    });
  }
}

function _assistantRenderBrainResults(draft) {
  const el = document.getElementById('assistant-brain-results');
  if (!el) return;
  const g = (title, arr) => `
    <div class="assistant-brain-group">
      <div class="assistant-brain-group-title">${esc(title)} (${arr.length})</div>
      <div>${arr.length ? arr.map(x => `<span class="assistant-brain-chip">${esc(x)}</span>`).join('') : '<span class="settings-hint">Aucun</span>'}</div>
    </div>`;
  el.innerHTML = [
    g('Personnages', draft.personnages || []),
    g('Lieux', draft.lieux || []),
    g('Chapitres', draft.chapitres || []),
    g('Tropes', draft.tropes || []),
    g('Notes', draft.notes || []),
    g('Sections suggerees', draft.sectionSuggestions || []),
  ].join('');
}

function assistantAnalyzeBrainDump() {
  const raw = (document.getElementById('assistant-brain-input')?.value || '').trim();
  if (!raw) { showToast('Colle un bloc de texte', 'error'); return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const personnages = new Set();
  const lieux = new Set();
  const chapitres = new Set();
  const tropes = new Set();
  const notes = new Set();
  const sectionSuggestions = new Set();

  const stop = new Set(['Le', 'La', 'Les', 'Un', 'Une', 'Des', 'Du', 'De', 'Et', 'Ou', 'Mais', 'Donc', 'Or', 'Ni', 'Car']);
  const nameRegex = /\b([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+){0,2})\b/g;
  let m;
  while ((m = nameRegex.exec(raw)) !== null) {
    const n = (m[1] || '').trim();
    if (!n || stop.has(n)) continue;
    if (n.length < 3) continue;
    personnages.add(n);
  }

  lines.forEach(line => {
    const l = line.toLowerCase();
    const ch = line.match(/chapitre\s*(\d{1,3})\s*[:\-]?\s*(.*)$/i);
    if (ch) {
      chapitres.add(`Chapitre ${ch[1]}${ch[2] ? ` - ${ch[2].trim()}` : ''}`);
    }

    const tr = line.match(/^trope\s*:\s*(.+)$/i);
    if (tr) tropes.add(tr[1].trim());

    const pr = line.match(/^prenom\s*:\s*(.+)$/i);
    if (pr) personnages.add(pr[1].trim());

    const li = line.match(/^(lieu|ville|quartier|bar|hotel|manoir|port|organisation)\s*:\s*(.+)$/i);
    if (li) lieux.add(li[2].trim());

    if (/mafia|gang|cartel|parrain/.test(l)) sectionSuggestions.add('Organisation criminelle');
    if (/magie|sort|pouvoir/.test(l)) sectionSuggestions.add('Systeme de magie');
    if (/police|enquete|indice|suspect/.test(l)) sectionSuggestions.add('Enquete');
    if (/timeline|chronologie|date/.test(l)) sectionSuggestions.add('Chronologie detaillee');
  });

  if (!sectionSuggestions.size) {
    sectionSuggestions.add('Organisation');
    sectionSuggestions.add('Objets cle');
  }

  lines.slice(0, 10).forEach(n => notes.add(n));

  const draft = {
    personnages: Array.from(personnages).slice(0, 20),
    lieux: Array.from(lieux).slice(0, 20),
    chapitres: Array.from(chapitres).slice(0, 20),
    tropes: Array.from(tropes).slice(0, 20),
    notes: Array.from(notes).slice(0, 20),
    sectionSuggestions: Array.from(sectionSuggestions).slice(0, 10),
  };

  window._assistantBrainDraft = draft;
  _assistantRenderBrainResults(draft);
  showToast('Analyse terminee. Verifie puis applique.', 'success');
}

function assistantApplyBrainDump() {
  const draft = window._assistantBrainDraft;
  if (!draft) {
    showToast('Aucune analyse prete', 'error');
    return;
  }

  const id = state.currentProjectId;
  const now = new Date().toISOString();
  let addedChars = 0;
  let addedLocs = 0;
  let addedChaps = 0;
  let addedNotes = 0;
  let addedTropes = 0;

  const chars = getProjectData(id, 'personnages') || [];
  const charNames = new Set(chars.map(c => ([c.prenom, c.nom].filter(Boolean).join(' ').trim().toLowerCase())).filter(Boolean));
  (draft.personnages || []).forEach(name => {
    const key = String(name || '').trim().toLowerCase();
    if (!key || charNames.has(key)) return;
    const parts = String(name).trim().split(/\s+/);
    const prenom = parts.shift() || name;
    const nom = parts.join(' ');
    chars.push({
      id: uid(),
      prenom,
      nom,
      age: '',
      role: 'Secondaire',
      notes: 'Cree depuis brain dump assistant',
      createdAt: now,
      updatedAt: now,
    });
    charNames.add(key);
    addedChars++;
  });
  saveProjectData(id, 'personnages', chars);

  const lieux = getProjectData(id, 'lieux') || [];
  const locNames = new Set(lieux.map(l => (l.nom || '').trim().toLowerCase()).filter(Boolean));
  (draft.lieux || []).forEach(name => {
    const key = String(name || '').trim().toLowerCase();
    if (!key || locNames.has(key)) return;
    lieux.push({
      id: uid(),
      nom: String(name).trim(),
      ville: '',
      type: 'Résidence',
      notes: 'Cree depuis brain dump assistant',
      createdAt: now,
      updatedAt: now,
    });
    locNames.add(key);
    addedLocs++;
  });
  saveProjectData(id, 'lieux', lieux);

  const chapitres = getProjectData(id, 'chapitres') || [];
  const chapNums = new Set(chapitres.map(c => Number(c.numero)).filter(Boolean));
  let nextNum = Math.max(0, ...Array.from(chapNums), 0) + 1;
  (draft.chapitres || []).forEach(label => {
    const m = String(label).match(/chapitre\s*(\d+)/i);
    let numero = m ? Number(m[1]) : nextNum++;
    if (!numero || chapNums.has(numero)) numero = nextNum++;
    const titre = String(label).replace(/chapitre\s*\d+\s*[-:]?\s*/i, '').trim() || `Chapitre ${numero}`;
    chapitres.push({
      id: uid(),
      numero,
      titre,
      pov: '',
      statut: 'Brouillon',
      resume: 'Genere depuis brain dump assistant',
      notes: '',
      createdAt: now,
      updatedAt: now,
    });
    chapNums.add(numero);
    addedChaps++;
  });
  saveProjectData(id, 'chapitres', chapitres);

  const notes = getProjectData(id, 'notes') || [];
  (draft.notes || []).slice(0, 8).forEach(text => {
    notes.push({
      id: uid(),
      title: String(text).slice(0, 80),
      type: 'idea',
      content: String(text),
      tags: ['brain-dump'],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
    addedNotes++;
  });
  saveProjectData(id, 'notes', notes);

  const target = _assistantCurrentTarget();
  (draft.tropes || []).forEach(t => {
    _assistantPushKnowledge(target, { id: uid(), category: 'trope', text: String(t), ts: now });
    addedTropes++;
  });

  touchProject(id);
  if (state.currentSection === 'personnages') renderCharacters();
  if (state.currentSection === 'lieux') renderLocations();
  if (state.currentSection === 'chapitres') renderChapters();
  if (state.currentSection === 'notes') renderNotes();
  renderAssistant();

  showToast(`Cree: ${addedChars} persos, ${addedLocs} lieux, ${addedChaps} chapitres, ${addedNotes} notes, ${addedTropes} tropes`, 'success');
}

function assistantSaveGlobalContext() {
  const text = (document.getElementById('assistant-global-context')?.value || '').trim();
  const scope = _assistantGetScope();
  if (scope === 'universe' && _assistantUniverseId()) {
    _assistantSaveUniverseContext(text);
    showToast('Contexte univers enregistre', 'success');
  } else {
    const s = getAssistantState();
    s.contextProject = text;
    saveAssistantState(s);
    showToast('Contexte livre enregistre', 'success');
  }
  renderAssistant();
}

function assistantGenerateContextDraft() {
  const project = getProjects().find(p => p.id === state.currentProjectId);
  const chars = getCharactersForProject(state.currentProjectId, true) || [];
  const lieux = getLocationsForProject(state.currentProjectId, true) || [];
  const chaps = getProjectData(state.currentProjectId, 'chapitres') || [];
  const events = getProjectData(state.currentProjectId, 'events') || [];
  const relations = getRelationsForProject(state.currentProjectId, true) || [];

  const names = chars.slice(0, 8).map(c => [c.prenom, c.nom].filter(Boolean).join(' ')).filter(Boolean).join(', ');
  const places = lieux.slice(0, 8).map(l => l.nom).filter(Boolean).join(', ');

  const draft = [
    `Projet: ${(project && project.name) || 'Sans nom'}`,
    project && project.description ? `Pitch: ${project.description}` : 'Pitch: a completer',
    names ? `Personnages cles: ${names}` : 'Personnages cles: a completer',
    places ? `Lieux cles: ${places}` : 'Lieux cles: a completer',
    `Structure actuelle: ${chaps.length} chapitre(s), ${events.length} evenement(s), ${relations.length} relation(s).`,
    'Ton souhaite: a definir (ex: sombre, romantique, nerveux).',
    'Contraintes narratives: a definir.',
    'Secrets majeurs et moment de revelation: a definir.',
  ].join('\n');

  const el = document.getElementById('assistant-global-context');
  if (el) el.value = draft;
  showToast('Brouillon de contexte genere', 'success');
}

function _assistantGetDialogueSourceText() {
  const input = (document.getElementById('assistant-dialogue-input')?.value || '').trim();
  if (input) return input;

  if (typeof editorState !== 'undefined' && editorState.quill) {
    const txt = editorState.quill.getText().trim();
    if (txt) return txt;
  }

  const ch = _assistantResolveChapterForProgression('');
  if (ch) {
    const txt = `${ch.titre || ''}\n${ch.contenu || ''}\n${ch.notes || ''}`.trim();
    if (txt) return txt;
  }
  return '';
}

function _assistantDialogueSegments(text) {
  const src = String(text || '');
  const matches = [];
  const re = /["«](.*?)["»]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const seg = (m[1] || '').trim();
    if (seg) matches.push(seg);
  }
  return matches;
}

function assistantDialogueAnalyze() {
  const text = _assistantGetDialogueSourceText();
  const reportEl = document.getElementById('assistant-dialogue-report');
  if (!reportEl) return;
  if (!text) {
    reportEl.innerHTML = '<div class="settings-hint">Aucun texte a analyser.</div>';
    showToast('Aucun texte pour Dialogue Doctor', 'error');
    return;
  }

  const words = text.split(/\s+/).filter(Boolean);
  const dialogues = _assistantDialogueSegments(text);
  const dialogueWords = dialogues.join(' ').split(/\s+/).filter(Boolean);
  const ratio = words.length ? Math.round((dialogueWords.length / words.length) * 100) : 0;
  const avgLine = dialogues.length ? Math.round(dialogues.reduce((a, x) => a + x.split(/\s+/).filter(Boolean).length, 0) / dialogues.length) : 0;

  const advice = [];
  if (ratio < 20) advice.push('Dialogue faible: ajoute des repliques courtes pour dynamiser.');
  else if (ratio > 60) advice.push('Dialogue tres dense: garde des respirations narratives.');
  else advice.push('Equilibre dialogue/narration correct.');
  if (avgLine > 18) advice.push('Repliques longues: coupe en intentions courtes.');
  if (!dialogues.length) advice.push('Aucune replique detectee (guillemets) dans cet extrait.');

  reportEl.innerHTML = `
    <div class="assistant-dialogue-box">
      <strong>Analyse</strong>
      <div>Mots total: ${words.length}</div>
      <div>Repliques detectees: ${dialogues.length}</div>
      <div>Ratio dialogue: ${ratio}%</div>
      <div>Longueur moyenne replique: ${avgLine || 0} mot(s)</div>
    </div>
    <div class="assistant-dialogue-box">
      <strong>Conseils</strong>
      <div>${advice.map(x => `- ${esc(x)}`).join('<br>')}</div>
    </div>
  `;
  showToast('Dialogue Doctor: analyse terminee', 'success');
}

function _assistantRewriteLine(line, style) {
  const src = String(line || '').trim();
  if (!src) return '';
  const words = src.split(/\s+/);

  if (style === 'naturel') {
    return src
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+\!/g, '!')
      .replace(/\s+\?/g, '?')
      .replace(/\s{2,}/g, ' ')
      .replace(/\bje ne\b/gi, 'je')
      .replace(/\bnous ne\b/gi, 'on ne')
      .trim();
  }
  if (style === 'tendu') {
    const short = words.slice(0, Math.min(words.length, 12)).join(' ');
    return `${short}${words.length > 12 ? '...' : ''} Fais-le. Maintenant.`;
  }
  if (style === 'sous-texte') {
    return `${src.replace(/[!?]+$/,'')}. Tu vois tres bien ce que je veux dire.`;
  }
  if (style === 'sms') {
    return src
      .toLowerCase()
      .replace(/que/g, 'ke')
      .replace(/pour/g, 'pr')
      .replace(/toujours/g, 'tjrs')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return src;
}

function assistantDialogueRewrite(style) {
  const text = _assistantGetDialogueSourceText();
  const reportEl = document.getElementById('assistant-dialogue-report');
  if (!reportEl) return;
  if (!text) {
    reportEl.innerHTML = '<div class="settings-hint">Aucun texte a reecrire.</div>';
    showToast('Aucun texte pour reecriture', 'error');
    return;
  }

  const lines = _assistantDialogueSegments(text);
  if (!lines.length) {
    reportEl.innerHTML = '<div class="settings-hint">Aucune replique detectee. Ajoute des guillemets pour cibler les dialogues.</div>';
    showToast('Aucune replique detectee', 'error');
    return;
  }

  const rewritten = lines.slice(0, 8).map((ln, i) => ({
    original: ln,
    rewritten: _assistantRewriteLine(ln, style),
    idx: i + 1,
  }));

  reportEl.innerHTML = rewritten.map(r => `
    <div class="assistant-dialogue-box">
      <strong>Replique ${r.idx} (${esc(style)})</strong>
      <div><em>Avant:</em> ${esc(r.original)}</div>
      <div><em>Apres:</em> ${esc(r.rewritten)}</div>
    </div>
  `).join('');
  showToast(`Dialogue Doctor: version ${style} generee`, 'success');
}

function assistantQuickAsk(text) {
  const input = document.getElementById('assistant-chat-input');
  if (!input) return;
  input.value = text;
  assistantSendMessage();
}

function _assistantBuildActions(userText, knowledge, answerText) {
  const q = String(userText || '').toLowerCase();
  const out = [];

  const add = action => {
    if (!action || !action.type || !action.label) return;
    if (out.some(x => x.type === action.type && x.label === action.label)) return;
    out.push(action);
  };

  if ((/perso|personnage/.test(q)) && (/pas d idee|pas d'idée|creer|créer|invent|bloqu/.test(q))) {
    const prenoms = _assistantGetKnowledge(knowledge, 'prenom').slice(0, 3);
    const picks = prenoms.length ? prenoms : ['Lena', 'Milo', 'Viktor'];
    picks.forEach(name => add({ type: 'create-character', label: `+ Creer ${name}`, name }));
    add({ type: 'goto-section', label: 'Ouvrir Personnages', section: 'personnages' });
  }

  if (/musique|playlist|son/.test(q)) {
    add({ type: 'goto-section', label: 'Ouvrir Playlists', section: 'playlists' });
    add({ type: 'goto-section', label: 'Ouvrir Timeline', section: 'timeline' });
  }

  if (/dialogue|replique|réplique|conversation|sms/.test(q)) {
    add({ type: 'open-dialogue-doctor', label: 'Ouvrir Dialogue Doctor' });
  }

  if (/section custom|nouvelle section|organisation|mafia|magie|enquete|enquête/.test(q)) {
    add({ type: 'open-custom-section', label: '+ Creer une section custom' });
  }

  if (/coheren|incoheren|incoh|contradiction|secret|yeux/.test(q)) {
    add({ type: 'run-consistency', label: 'Lancer analyse coherence' });
    add({ type: 'run-canonical-facts', label: 'Verifier faits canoniques' });
  }

  if (/twist|rebondissement|plan|trope/.test(q)) {
    const m = String(answerText || '').match(/base:\s*([^\)\n]+)/i);
    if (m && m[1]) {
      add({ type: 'add-trope', label: `+ Ajouter trope: ${m[1].trim()}`, trope: m[1].trim() });
    }
  }

  if (/chapitre\s*\d+|j\s*ai fini|j'ai fini|prochain chapitre|chapitre suivant|chapitre\s*->|chapitre\s*vers/.test(q)) {
    add({ type: 'chapter-bridge', label: 'Generer plan chapitre suivant' });
  }

  return out.slice(0, 6);
}

function _assistantIsReplayableAction(action) {
  if (!action || !action.type) return false;
  return ['goto-section', 'run-consistency', 'run-canonical-facts', 'open-custom-section', 'chapter-bridge', 'open-dialogue-doctor'].includes(action.type);
}

function _assistantExecuteChatAction(action) {
  if (!action) return 'Action invalide.';
  const id = state.currentProjectId;

  if (action.type === 'goto-section' && action.section) {
    navigateTo(action.section);
    return `Section ouverte: ${action.section}`;
  }
  if (action.type === 'run-consistency') {
    navigateTo('parametres');
    if (typeof analyzeConsistencyNow === 'function') {
      setTimeout(() => analyzeConsistencyNow(), 80);
      return 'Analyse de coherence lancee.';
    }
    return 'Analyse coherence indisponible.';
  }
  if (action.type === 'run-canonical-facts') {
    navigateTo('assistant');
    setTimeout(() => assistantRunCanonicalFactCheck(), 60);
    return 'Verification des faits canoniques lancee.';
  }
  if (action.type === 'open-custom-section') {
    if (typeof openCustomSectionModal === 'function') {
      openCustomSectionModal();
      return 'Creation de section custom ouverte.';
    }
    return 'Section custom non disponible ici.';
  }
  if (action.type === 'open-dialogue-doctor') {
    navigateTo('assistant');
    setTimeout(() => {
      const el = document.getElementById('assistant-dialogue-input');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      assistantDialogueAnalyze();
    }, 80);
    return 'Dialogue Doctor ouvert et analyse lancee.';
  }
  if (action.type === 'chapter-bridge') {
    const scope = _assistantGetScope();
    const knowledge = _assistantMergeKnowledge(scope);
    const context = _assistantGetCombinedContext(scope);
    const out = _assistantBuildChapterBridgePlan('', knowledge, context);
    return out.answer || 'Plan chapitre suivant genere.';
  }
  if (action.type === 'create-next-chapter-draft') {
    const list = getProjectData(id, 'chapitres') || [];
    const exists = list.some(c => Number(c.numero) === Number(action.nextNumero));
    if (exists) return `Le chapitre ${action.nextNumero} existe deja.`;

    list.push({
      id: uid(),
      numero: Number(action.nextNumero) || (Math.max(0, ...list.map(c => Number(c.numero) || 0)) + 1),
      titre: action.titre || `Chapitre ${(action.nextNumero || '?')}`,
      pov: '',
      statut: 'Brouillon',
      resume: action.resume || 'Brouillon genere par assistant chapitre -> chapitre',
      notes: action.notes || '',
      contenu: '',
      contenuHtml: '',
      scenesIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveProjectData(id, 'chapitres', list);
    touchProject(id);
    if (state.currentSection === 'chapitres') renderChapters();
    return `Brouillon cree: chapitre ${action.nextNumero}.`;
  }
  if (action.type === 'add-trope' && action.trope) {
    const target = _assistantCurrentTarget();
    _assistantPushKnowledge(target, { id: uid(), category: 'trope', text: String(action.trope), ts: new Date().toISOString() });
    renderAssistant();
    return `Trope ajoute dans ${_assistantTargetLabel(target)}: ${action.trope}`;
  }
  if (action.type === 'create-character' && action.name) {
    const chars = getProjectData(id, 'personnages') || [];
    const key = String(action.name).trim().toLowerCase();
    const exists = chars.some(c => ([c.prenom, c.nom].filter(Boolean).join(' ').trim().toLowerCase() === key));
    if (exists) return `${action.name} existe deja.`;

    const parts = String(action.name).trim().split(/\s+/);
    const prenom = parts.shift() || action.name;
    const nom = parts.join(' ');
    chars.push({
      id: uid(),
      prenom,
      nom,
      age: '',
      role: 'Secondaire',
      notes: 'Cree depuis action chat assistant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    saveProjectData(id, 'personnages', chars);
    touchProject(id);
    if (state.currentSection === 'personnages') renderCharacters();
    return `Personnage cree: ${action.name}`;
  }

  return 'Action executee.';
}

function assistantRunChatAction(msgIdx, actionIdx) {
  const s = getAssistantState();
  const msg = (s.chat || [])[msgIdx];
  if (!msg || !Array.isArray(msg.actions) || !msg.actions[actionIdx]) return;

  const action = msg.actions[actionIdx];
  if (action.done) {
    showToast('Action deja executee', 'error');
    return;
  }
  const feedback = _assistantExecuteChatAction(action);

  msg.actions[actionIdx] = {
    ...action,
    done: true,
    doneAt: new Date().toISOString(),
  };
  s.chat.push({ role: 'assistant', text: feedback, ts: new Date().toISOString() });
  if (s.chat.length > 170) s.chat = s.chat.slice(-170);
  saveAssistantState(s);
  renderAssistant();
  showToast(feedback, 'success');
}

function assistantReplayChatAction(msgIdx, actionIdx) {
  const s = getAssistantState();
  const msg = (s.chat || [])[msgIdx];
  if (!msg || !Array.isArray(msg.actions) || !msg.actions[actionIdx]) return;

  const action = msg.actions[actionIdx];
  if (!action.done) {
    showToast('Action pas encore executee', 'error');
    return;
  }
  if (!_assistantIsReplayableAction(action)) {
    showToast('Cette action ne peut pas etre rejouee', 'error');
    return;
  }

  const feedback = _assistantExecuteChatAction(action);
  s.chat.push({ role: 'assistant', text: `Rejeu: ${feedback}`, ts: new Date().toISOString() });
  if (s.chat.length > 170) s.chat = s.chat.slice(-170);
  saveAssistantState(s);
  renderAssistant();
  showToast('Action rejouee', 'success');
}

function _assistantPersonaReply(text) {
  const chars = getCharactersForProject(state.currentProjectId, true) || [];
  const mode = document.getElementById('assistant-chat-mode')?.value || 'coach';
  const lower = (text || '').toLowerCase();

  if (mode === 'persona') {
    const pid = document.getElementById('assistant-persona-id')?.value || '';
    const c = chars.find(x => x.id === pid);
    if (!c) return 'Choisis un personnage pour ce mode.';
    const name = [c.prenom, c.nom].filter(Boolean).join(' ') || 'Perso';
    const tone = (c.notes || '').slice(0, 90);
    return [
      `SMS - ${name}:`,
      `"${lower.includes('chapitre') ? 'Ok, on avance. Garde la pression et montre le conflit tout de suite.' : 'Je te suis. Donne-moi la situation precise et je reagis en role.'}"`,
      tone ? `Sous-texte du perso: ${tone}` : 'Sous-texte du perso: a completer dans sa fiche pour un rendu encore plus precis.',
    ].join('\n');
  }

  if (mode === 'group') {
    const ids = Array.from(document.getElementById('assistant-group-ids')?.selectedOptions || []).map(o => o.value);
    const group = chars.filter(c => ids.includes(c.id)).slice(0, 4);
    if (!group.length) return 'Selectionne au moins 1 personnage dans Groupe.';
    const lines = group.map((c, i) => {
      const name = [c.prenom, c.nom].filter(Boolean).join(' ') || `Perso ${i + 1}`;
      const intents = ['On agit maintenant.', 'Attends, il manque une info.', 'Je ne fais confiance a personne.', 'On peut negocier.'];
      return `${name}: "${intents[i % intents.length]}"`;
    });
    return ['Discussion de groupe (simulation):', ...lines, 'Dis-moi "version plus tendue" ou "version plus emotionnelle".'].join('\n');
  }

  return '';
}

function assistantSendMessage() {
  const input = document.getElementById('assistant-chat-input');
  if (!input) return;
  let text = (input.value || '').trim();
  if (!text) return;

  const s = getAssistantState();
  s.chat.push({ role: 'user', text, ts: new Date().toISOString() });

  const modeReply = _assistantPersonaReply(text);
  const scope = _assistantGetScope();
  const knowledge = _assistantMergeKnowledge(scope);
  const context = _assistantGetCombinedContext(scope);
  const answer = modeReply || assistantBuildResponse(text, knowledge, context);

  const actions = modeReply ? [] : _assistantBuildActions(text, knowledge, answer);

  if (!modeReply && /chapitre\s*\d+|j\s*ai fini|j'ai fini|prochain chapitre|chapitre suivant|chapitre\s*->|chapitre\s*vers/i.test(text)) {
    const bridge = _assistantBuildChapterBridgePlan(text, knowledge, context);
    if (bridge && bridge.action && !actions.some(a => a.type === bridge.action.type && a.nextNumero === bridge.action.nextNumero)) {
      actions.unshift(bridge.action);
    }
  }

  s.chat.push({ role: 'assistant', text: answer, ts: new Date().toISOString(), actions });
  if (s.chat.length > 150) s.chat = s.chat.slice(-150);
  saveAssistantState(s);

  input.value = '';
  renderAssistant();
}

function _assistantPick(list, count) {
  if (!list.length) return [];
  const out = [];
  const used = new Set();
  while (out.length < Math.min(count, list.length)) {
    const i = Math.floor(Math.random() * list.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(list[i]);
  }
  return out;
}

function _assistantGetKnowledge(knowledge, category) {
  return (knowledge || []).filter(k => k.category === category).map(k => k.text);
}

function _assistantScenarioIdeas(knowledge, contextText = '') {
  const tropes = _assistantGetKnowledge(knowledge, 'trope');
  const regles = _assistantGetKnowledge(knowledge, 'regle').slice(0, 3);
  const universeRules = _assistantGetKnowledge(knowledge, 'univers').slice(0, 2);
  const hooks = [
    'Une promesse impossible force le protagoniste a choisir entre amour et loyaute.',
    'Un secret de famille ressort et inverse les alliances.',
    'Le personnage principal gagne ce qu\'il voulait, mais perd ce dont il avait besoin.',
    'Une fausse victoire masque un danger plus grand.',
    'Le mentor devient obstacle moral au pire moment.',
  ];
  const picks = _assistantPick(hooks, 3);
  let out = 'Voici 3 pistes scenario avancees:\n';
  picks.forEach((p, i) => {
    const trope = tropes[i % (tropes.length || 1)] || 'trope libre';
    out += `${i + 1}. ${p} (base: ${trope})\n`;
  });
  if (regles.length || universeRules.length) {
    out += '\nContraintes appliquees:\n';
    [...regles, ...universeRules].slice(0, 4).forEach(r => { out += `- ${r}\n`; });
  }
  if (contextText) {
    out += `\nContexte prioritaire: ${contextText.split('\n')[0].slice(0, 120)}...`;
  }
  return out.trim();
}

function _assistantCharacterIdeas(knowledge) {
  const prenoms = _assistantGetKnowledge(knowledge, 'prenom');
  const tropes = _assistantGetKnowledge(knowledge, 'trope');
  const roles = ['Protagoniste', 'Antagoniste', 'Secondaire cle', 'Mentor', 'Allie ambigu'];
  const traits = ['controle', 'impulsif', 'charismatique', 'fuyant', 'obsessionnel', 'empathique'];
  const wounds = ['abandon', 'trahison', 'honte', 'culpabilite', 'echec public'];

  let out = 'Top idees de personnages:\n';
  for (let i = 0; i < 5; i++) {
    const name = prenoms[i % (prenoms.length || 1)] || `Personnage-${i + 1}`;
    const role = roles[i % roles.length];
    const trait = traits[(i + 2) % traits.length];
    const wound = wounds[(i + 1) % wounds.length];
    const trope = tropes[i % (tropes.length || 1)] || 'trope libre';
    out += `${i + 1}. ${name} - ${role}. Trait dominant: ${trait}. Blessure: ${wound}. Axe narratif: ${trope}.\n`;
  }
  out += '\nSi tu veux, dis: "developpe le 2" et je te fais objectif, peur, besoin, arc et conflit.';
  return out;
}

function _assistantResolveChapterForProgression(text) {
  const chapters = (getProjectData(state.currentProjectId, 'chapitres') || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
  if (!chapters.length) return null;

  const low = String(text || '').toLowerCase();
  const m = low.match(/chapitre\s*(\d{1,3})/);
  if (m) {
    const n = Number(m[1]);
    const found = chapters.find(c => Number(c.numero) === n);
    if (found) return found;
  }

  if (typeof editorState !== 'undefined' && editorState.type === 'chapter' && editorState.id) {
    const current = chapters.find(c => c.id === editorState.id);
    if (current) return current;
  }

  return chapters[chapters.length - 1];
}

function _assistantBuildChapterBridgePlan(text, knowledge, contextText = '') {
  const current = _assistantResolveChapterForProgression(text);
  const chapters = (getProjectData(state.currentProjectId, 'chapitres') || []).slice().sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const events = getProjectData(state.currentProjectId, 'events') || [];
  const tropes = _assistantGetKnowledge(knowledge, 'trope');

  if (!current) {
    return {
      answer: 'Je ne trouve aucun chapitre. Cree d\'abord un chapitre pour activer l\'assistant chapitre -> chapitre.',
      action: null,
    };
  }

  const nextNum = Number(current.numero || 0) + 1;
  const existingNext = chapters.find(c => Number(c.numero) === nextNum);
  const currentTitle = current.titre || `Chapitre ${current.numero || '?'}`;
  const linkedEvents = events.filter(e => (e.associated || []).some(a => a && a.type === 'chapitres' && a.id === current.id));
  const lastEvent = linkedEvents.length ? linkedEvents[linkedEvents.length - 1] : null;
  const tropeA = tropes[0] || 'conflit relationnel';
  const tropeB = tropes[1] || 'revelation partielle';
  const tropeC = tropes[2] || 'choix impossible';

  const nextTitle = existingNext
    ? (existingNext.titre || `Chapitre ${nextNum}`)
    : `Chapitre ${nextNum} - Rupture`;

  const summary = [
    `Objectif narratif: transformer la consequence de ${currentTitle} en nouveau risque concret.`,
    `Pivot central: ${tropeB}.`,
    `Sortie de chapitre: decision irreversible qui pousse vers ${nextTitle}.`,
  ].join(' ');

  const beats = [
    `Ouverture: retombee immediate de ${currentTitle}.`,
    `Pression: complication active (${tropeA}).`,
    `Pivot: info qui change les alliances (${tropeB}).`,
    `Cloture: choix a cout eleve (${tropeC}).`,
  ];

  const answer = [
    `Passage chapitre ${current.numero || '?'} -> ${nextNum}:`,
    `Chapitre courant: ${currentTitle}.`,
    lastEvent ? `Dernier event lie: ${lastEvent.titre || 'sans titre'} (${lastEvent.date || 'sans date'}).` : 'Aucun event lie au chapitre courant.',
    '',
    '3 trajectoires possibles:',
    '1. Douce: renforcer l\'emotion et la consequence personnelle avant l\'action.',
    '2. Medium: alterner tension externe et friction relationnelle.',
    '3. Choc: revelation immediate + rupture de confiance en fin de chapitre.',
    '',
    'Beats proposes pour le prochain chapitre:',
    ...beats.map((b, i) => `${i + 1}. ${b}`),
    contextText ? `\nContrainte prioritaire: ${contextText.split('\n')[0].slice(0, 140)}...` : '',
  ].filter(Boolean).join('\n');

  const action = existingNext
    ? null
    : {
      type: 'create-next-chapter-draft',
      label: `+ Creer brouillon chapitre ${nextNum}`,
      baseChapterId: current.id,
      nextNumero: nextNum,
      titre: nextTitle,
      resume: summary,
      notes: beats.join(' | '),
    };

  return { answer, action };
}

function _assistantSceneUnblock(knowledge, text = '') {
  const tropes = _assistantGetKnowledge(knowledge, 'trope');
  const cards = [
    'Complication: une information vitale arrive trop tard.',
    'Complication: le personnage se trompe de cible emotionnelle.',
    'Pivot: un allie pose une condition impossible.',
    'Pivot: une preuve invalide la certitude actuelle.',
    'Sortie: mini-victoire a cout moral eleve.',
    'Sortie: echec apparent qui ouvre un meilleur angle au chapitre suivant.',
  ];
  const picks = _assistantPick(cards, 4);
  let out = 'Blocage detecte: voici 4 mouvements de scene possibles:\n';
  picks.forEach((p, i) => {
    const trope = tropes[i % (tropes.length || 1)] || 'coherence interne';
    out += `${i + 1}. ${p} (ancrage: ${trope})\n`;
  });
  if (/chapitre\s*\d+/.test((text || '').toLowerCase())) {
    out += '\nTu as mentionne un chapitre precis: je peux aussi te proposer une transition propre vers le chapitre suivant.';
  }
  out += '\nChoisis un numero et je te propose la version douce, medium ou choc.';
  return out;
}

function _assistantThreeActPlan(knowledge) {
  const tropes = _assistantGetKnowledge(knowledge, 'trope');
  const t1 = tropes[0] || 'conflit relationnel';
  const t2 = tropes[1] || 'secret revele';
  const t3 = tropes[2] || 'choix impossible';
  return [
    'Plan 3 actes (base sur tes donnees):',
    `Acte I: Mise en place + incident declencheur (${t1}).`,
    `Acte II: Escalade + point milieu + crise (${t2}).`,
    `Acte III: Confrontation finale + resolution avec cout (${t3}).`,
    'Je peux te convertir ce plan en 12 beats detailles si tu veux.',
  ].join('\n');
}

function _assistantProjectSummary() {
  const id = state.currentProjectId;
  const chars = (getCharactersForProject(id, true) || []).length;
  const locs = (getLocationsForProject(id, true) || []).length;
  const chaps = (getProjectData(id, 'chapitres') || []).length;
  const scenes = (getProjectData(id, 'scenes') || []).length;
  const rels = (getRelationsForProject(id, true) || []).length;
  return `Etat du projet: ${chars} perso(s), ${locs} lieu(x), ${rels} relation(s), ${chaps} chapitre(s), ${scenes} scene(s).`;
}

function _assistantQueryTokens(text) {
  const stop = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'est', 'sont', 'dans', 'avec', 'pour', 'sur', 'par', 'que', 'qui', 'quoi', 'comment', 'pourquoi', 'quand', 'mais', 'donc', 'car', 'au', 'aux']);
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !stop.has(t));
}

function _assistantEscapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _assistantDocSnippet(text, tokens) {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  if (!src) return '';
  let idx = -1;
  for (const token of tokens) {
    idx = src.toLowerCase().indexOf(token.toLowerCase());
    if (idx !== -1) break;
  }
  if (idx === -1) return src.slice(0, 260);
  const start = Math.max(0, idx - 90);
  const end = Math.min(src.length, idx + 220);
  return src.slice(start, end);
}

function _assistantAnswerFromDocuments(text, knowledge) {
  const docs = (knowledge || []).filter(k => k && k.category === 'document' && k.text);
  if (!docs.length) return '';
  const tokens = _assistantQueryTokens(text);
  if (!tokens.length) return '';

  const ranked = docs.map(d => {
    const low = String(d.text || '').toLowerCase();
    let score = 0;
    tokens.forEach(t => {
      if (low.includes(t)) score += 2;
      const re = new RegExp(`\\b${_assistantEscapeRegex(t)}\\b`, 'g');
      const cnt = (low.match(re) || []).length;
      score += Math.min(cnt, 4);
    });
    return { d, score };
  }).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!ranked.length) return '';

  const lines = ranked.map((x, i) => {
    const meta = x.d.meta || {};
    const source = meta.fileName ? `${meta.fileName}${meta.chunkTotal ? ` (${meta.chunkIndex || 1}/${meta.chunkTotal})` : ''}` : `Document ${i + 1}`;
    const snippet = _assistantDocSnippet(x.d.text, tokens);
    return `${i + 1}. Source: ${source}\n   Extrait: ${snippet}`;
  });

  return [
    `J'ai trouve des passages utiles dans tes documents importes pour: "${text}".`,
    ...lines,
    'Si tu veux, je peux te faire un resume cible de ces sources (personnages, timeline, regles, lore, etc.).',
  ].join('\n');
}

function assistantBuildResponse(text, knowledge, contextText = '') {
  const q = text.toLowerCase();

  if (/bonjour|salut|hello|yo/.test(q)) {
    return `Salut. ${_assistantProjectSummary()}\nParle-moi normalement et je te guide pas a pas.`;
  }
  if (/resume|etat du projet|ou j en suis|où j'en suis/.test(q)) {
    return _assistantProjectSummary();
  }
  if (/musique|playlist|son/.test(q)) {
    return _assistantRecommendMusic(text);
  }
  if (/scene bibliotheque|scene globale|bibliotheque de scene|bibliothèque de scène/.test(q)) {
    return _assistantSuggestLibraryScene(text);
  }
  if (/contradiction|incoherence|incoh|yeux|secret/.test(q)) {
    return _assistantContradictionScan();
  }
  if (/canon|canoniq|faits?\s+canon|memoire des faits/.test(q)) {
    const r = _assistantComputeCanonicalFactCheck(_assistantGetScope());
    return [
      `Memoire canonique: ${r.factsCount} fait(s) - ${r.errors} erreur(s), ${r.warnings} avertissement(s).`,
      r.items[0] ? `Priorite: ${r.items[0].title} - ${r.items[0].text}` : 'Aucune alerte prioritaire.',
      'Tu peux cliquer sur "Verifier faits canoniques" pour le rapport detaille.',
    ].join('\n');
  }
  if (/dialogue|replique|réplique|conversation|sms/.test(q)) {
    const sample = _assistantGetDialogueSourceText();
    const lines = _assistantDialogueSegments(sample);
    const words = String(sample || '').split(/\s+/).filter(Boolean).length;
    const dwords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    const ratio = words ? Math.round((dwords / words) * 100) : 0;
    return [
      `Dialogue Doctor: ${lines.length} replique(s) detectee(s), ratio dialogue ${ratio}% .`,
      'Styles disponibles: naturel, tendu, sous-texte, sms.',
      'Clique sur "Ouvrir Dialogue Doctor" pour analyser et generer des variantes de repliques.',
    ].join('\n');
  }
  if (/section custom|nouvelle section|organisation|mafia|systeme de magie|système de magie/.test(q)) {
    return _assistantSuggestCustomSections(text);
  }
  if ((/perso|personnage/.test(q)) && (/pas d idee|pas d'idée|bloqu|creer|créer|invent/.test(q))) {
    return _assistantCharacterIdeas(knowledge);
  }
  if (/chapitre\s*\d+\s*(?:et|-|a|à)\s*\d+|chapitre\s*\d+\s*vers\s*\d+|j\s*ai fini|j'ai fini|prochain chapitre|chapitre suivant/.test(q)) {
    const bridge = _assistantBuildChapterBridgePlan(text, knowledge, contextText);
    return bridge.answer;
  }
  if (/bloqu|pas d idee|pas d'idée|scene|scène/.test(q)) {
    return _assistantSceneUnblock(knowledge, text);
  }
  if (/twist|rebondissement|surprise/.test(q)) {
    return _assistantScenarioIdeas(knowledge, contextText);
  }
  if (/3 actes|trois actes|plan/.test(q)) {
    return _assistantThreeActPlan(knowledge);
  }
  if (/coheren|incoheren|incoh/.test(q)) {
    return 'Tu peux lancer l\'analyse dans Parametres > Analyse de coherence. Je peux aussi te preparer une checklist coherence scene par scene.';
  }
  if (/regle|r[eé]ecrit|style|dialogue/.test(q)) {
    const regs = _assistantGetKnowledge(knowledge, 'regle');
    if (!regs.length) {
      return 'Ajoute d\'abord tes regles d\'ecriture dans la Bibliotheque assistant (categorie Regle ecriture), puis je pourrai te proposer des reecritures guidees.';
    }
    return `J\'ai ${regs.length} regle(s) de style en base. Envoie un extrait et je te propose une version dialogue plus naturelle, tout en respectant tes regles.`;
  }

  const docAnswer = _assistantAnswerFromDocuments(text, knowledge);
  if (docAnswer) return docAnswer;

  return [
    'Je peux t\'aider en mode discussion naturelle, avec les donnees de ton projet.',
    'Exemples utiles:',
    '- "Je veux creer un perso mais pas d\'idee"',
    '- "J\'ai fini le chapitre 3, aide-moi pour le 4"',
    '- "Trouve une musique pour ce chapitre"',
    '- "Simule un groupe Lena/Milo/Viktor"',
    '- "Propose une section custom pour mon histoire de mafia"',
    '',
    _assistantProjectSummary(),
  ].join('\n');
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
    case 'assistant': renderAssistant(); break;
  }
}
