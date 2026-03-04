/* ============================================================
   scenes.js — Système de scènes WorldBuilder
   Dépend de app.js (state, uid, esc, showToast, showConfirm,
   openModal, closeModal, getProjectData, saveProjectData,
   touchProject, getProjects)
   ============================================================ */

'use strict';

// ============================================================
// SCENES VIEW STATE
// ============================================================
const scenesViewState = {
  mode: 'list',        // 'list' | 'cards'
  selected: new Set(), // for merge selection
  continuousChapId: null,
};

// ============================================================
// GLOBAL LIBRARY STORAGE
// ============================================================
function getGlobalScenes() {
  return JSON.parse(localStorage.getItem('bibliotheque_globale_scenes') || '[]');
}
function saveGlobalScenes(list) {
  localStorage.setItem('bibliotheque_globale_scenes', JSON.stringify(list));
}

// ============================================================
// UTILITIES
// ============================================================
function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseTags(str) {
  if (!str) return [];
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

function renderTags(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('');
}

function parseVariables(str) {
  if (!str) return [];
  return str.split(',').map(v => v.trim()).filter(v => v.startsWith('[') && v.endsWith(']'));
}

function detectVariables(content) {
  if (!content) return [];
  const matches = content.match(/\[[A-Z0-9_]+\]/g) || [];
  return [...new Set(matches)];
}

function applyVariables(content, replacements) {
  let result = content || '';
  Object.entries(replacements || {}).forEach(([varName, value]) => {
    result = result.replaceAll(varName, value || varName);
  });
  return result;
}

// How many projects have imported this global scene
function getGlobalSceneUsage(globalSceneId) {
  const projects = getProjects();
  let count = 0;
  projects.forEach(p => {
    const scenes = getProjectData(p.id, 'scenes');
    if (scenes.some(s => s.sceneGlobaleId === globalSceneId)) count++;
  });
  return count;
}

// ============================================================
// BIBLIOTHÈQUE — open / close
// ============================================================
let _previousPage = null; // 'home' | 'project'

function openBibliotheque() {
  const homePage    = document.getElementById('home-page');
  const projectPage = document.getElementById('project-page');
  const biblioPage  = document.getElementById('bibliotheque-page');

  _previousPage = homePage.classList.contains('hidden') ? 'project' : 'home';
  homePage.classList.add('hidden');
  projectPage.classList.add('hidden');
  biblioPage.classList.remove('hidden');

  // Render the active tab
  const activeTab = document.querySelector('.biblio-tab.active');
  if (activeTab && activeTab.dataset.tab === 'music') {
    renderMusicLibrary();
  } else {
    renderBibliotheque();
  }
}

function closeBibliotheque() {
  document.getElementById('bibliotheque-page').classList.add('hidden');
  if (_previousPage === 'project') {
    document.getElementById('project-page').classList.remove('hidden');
  } else {
    document.getElementById('home-page').classList.remove('hidden');
  }
}

// ============================================================
// BIBLIOTHÈQUE — render
// ============================================================
function renderBibliotheque() {
  let scenes = getGlobalScenes();
  const filterCat = document.getElementById('biblio-filter-cat')?.value || '';
  const search    = (document.getElementById('biblio-search')?.value || '').toLowerCase();

  if (filterCat) scenes = scenes.filter(s => s.categorie === filterCat);
  if (search)    scenes = scenes.filter(s =>
    s.titre.toLowerCase().includes(search) ||
    (s.tags || []).some(t => t.toLowerCase().includes(search))
  );

  const grid  = document.getElementById('biblio-grid');
  const empty = document.getElementById('no-biblio');

  if (scenes.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const CAT_BADGES = {
    'Romance':   'badge-romance',
    'Tension':   'badge-tension',
    'Action':    'badge-action',
    'Révélation':'badge-revelation',
    'Autre':     'badge-autre',
  };

  grid.innerHTML = scenes.map(s => {
    const badge   = CAT_BADGES[s.categorie] || 'badge-autre';
    const wc      = wordCount(s.contenu);
    const usage   = getGlobalSceneUsage(s.id);
    const canCopy = !!state.currentProjectId;
    return `
      <div class="biblio-card">
        <div class="biblio-card-header">
          <div class="biblio-card-title">${esc(s.titre)}</div>
          <div class="biblio-card-actions">
            <button class="btn-icon" onclick="openGlobalSceneModal('${s.id}')" title="Modifier">✏️</button>
            <button class="btn-icon" onclick="deleteGlobalSceneConfirm('${s.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
        <span class="badge ${badge}">${esc(s.categorie)}</span>
        <div class="biblio-card-meta">${wc} mot${wc !== 1 ? 's' : ''} · Utilisée dans ${usage} projet${usage !== 1 ? 's' : ''}</div>
        ${s.tags && s.tags.length ? `<div class="biblio-card-tags">${renderTags(s.tags)}</div>` : ''}
        ${s.descriptionUsage ? `<div class="biblio-card-desc">${esc(s.descriptionUsage)}</div>` : ''}
        <div class="biblio-card-footer">
          <button class="btn btn-secondary btn-sm"
                  onclick="${canCopy ? `copyGlobalToProject('${s.id}')` : `showToast('Ouvrez d\\'abord un projet', 'error')`}">
            Copier vers projet
          </button>
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// GLOBAL SCENE — CRUD
// ============================================================
let _editingGlobalId = null;

function openGlobalSceneModal(sceneId = null) {
  _editingGlobalId = sceneId;
  document.getElementById('modal-global-scene-title').textContent =
    sceneId ? 'Modifier la scène globale' : 'Nouvelle scène globale';

  ['gs-titre', 'gs-tags', 'gs-variables', 'gs-contenu', 'gs-description'].forEach(id =>
    document.getElementById(id).value = ''
  );
  document.getElementById('gs-categorie').value = 'Romance';

  if (sceneId) {
    const s = getGlobalScenes().find(x => x.id === sceneId);
    if (s) {
      document.getElementById('gs-titre').value       = s.titre || '';
      document.getElementById('gs-categorie').value   = s.categorie || 'Romance';
      document.getElementById('gs-tags').value        = (s.tags || []).join(', ');
      document.getElementById('gs-variables').value   = (s.variables || []).join(', ');
      document.getElementById('gs-contenu').value     = s.contenu || '';
      document.getElementById('gs-description').value = s.descriptionUsage || '';
    }
  }
  openModal('modal-global-scene');
  setTimeout(() => document.getElementById('gs-titre').focus(), 80);
}

function saveGlobalScene() {
  const titre = document.getElementById('gs-titre').value.trim();
  if (!titre) { showToast('Le titre est requis', 'error'); return; }
  const contenu = document.getElementById('gs-contenu').value.trim();
  if (!contenu) { showToast('Le contenu est requis', 'error'); return; }

  const now = new Date().toISOString();
  const data = {
    titre,
    categorie:       document.getElementById('gs-categorie').value,
    tags:            parseTags(document.getElementById('gs-tags').value),
    variables:       parseVariables(document.getElementById('gs-variables').value) ||
                     detectVariables(contenu),
    contenu,
    descriptionUsage: document.getElementById('gs-description').value.trim(),
    updatedAt:        now,
  };

  // Also auto-detect variables from content
  data.variables = [...new Set([...data.variables, ...detectVariables(contenu)])];

  let list = getGlobalScenes();
  if (_editingGlobalId) {
    const idx = list.findIndex(s => s.id === _editingGlobalId);
    if (idx !== -1) list[idx] = { ...list[idx], ...data };
  } else {
    list.push({ id: uid(), createdAt: now, ...data });
  }

  saveGlobalScenes(list);
  closeModal('modal-global-scene');
  renderBibliotheque();
  showToast(_editingGlobalId ? 'Scène modifiée' : 'Scène créée dans la bibliothèque', 'success');
  _editingGlobalId = null;
}

function deleteGlobalSceneConfirm(sceneId) {
  const s = getGlobalScenes().find(x => x.id === sceneId);
  if (!s) return;
  showConfirm(
    `Supprimer "${s.titre}" ?`,
    'La scène sera retirée de la bibliothèque. Les copies dans les projets ne seront pas affectées.',
    () => {
      let list = getGlobalScenes().filter(x => x.id !== sceneId);
      saveGlobalScenes(list);
      closeModal('modal-confirm');
      renderBibliotheque();
      showToast('Scène supprimée de la bibliothèque', 'success');
    }
  );
}

// Copy global scene to current project directly (from library card)
function copyGlobalToProject(globalSceneId) {
  if (!state.currentProjectId) { showToast('Ouvrez d\'abord un projet', 'error'); return; }
  const s = getGlobalScenes().find(x => x.id === globalSceneId);
  if (!s) return;

  const now    = new Date().toISOString();
  const newScene = {
    id:                uid(),
    titre:             s.titre + ' (copie)',
    statut:            'Brouillon',
    pov:               '',
    tags:              [...(s.tags || [])],
    contenu:           s.contenu || '',
    notes:             '',
    typeScene:         'copie',
    sceneGlobaleId:    null,
    variablesRemplacees: {},
    assigneChapitreId: null,
    ordreInChapitre:   0,
    createdAt:         now,
    updatedAt:         now,
  };

  const scenes = getProjectData(state.currentProjectId, 'scenes');
  scenes.push(newScene);
  saveProjectData(state.currentProjectId, 'scenes', scenes);
  touchProject(state.currentProjectId);
  showToast(`Scène copiée vers le projet`, 'success');
}

// ============================================================
// LOCAL SCENES — render
// ============================================================
function renderScenes() {
  const id       = state.currentProjectId;
  const scenes   = getProjectData(id, 'scenes');
  const chapters = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);

  // Render stats bar
  _renderScenesStats(scenes, chapters);

  // Unassigned scenes
  const unassigned = scenes.filter(s => !s.assigneChapitreId);
  document.getElementById('unassigned-count').textContent = unassigned.length;
  const unassignedZone = document.getElementById('scenes-unassigned');
  unassignedZone.className = `scenes-drop-zone${scenesViewState.mode === 'cards' ? ' cork-board-grid' : ''}`;
  unassignedZone.innerHTML =
    (scenesViewState.mode !== 'cards' ? '<div class="drop-hint">Glisser une scène ici pour la désassigner</div>' : '') +
    unassigned.map(s => renderSceneCard(s, null, chapters)).join('');

  // By chapter
  const byChapter = document.getElementById('scenes-by-chapter');
  if (chapters.length === 0) {
    byChapter.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">
        Créez des chapitres pour y assigner vos scènes.
      </div>`;
    return;
  }

  byChapter.innerHTML = chapters.map(chap => {
    const chapSceneIds = chap.scenesIds || [];
    // Ordered scenes for this chapter
    const chapScenes = chapSceneIds
      .map(sid => scenes.find(s => s.id === sid))
      .filter(Boolean);

    return `
      <div class="scenes-block">
        <div class="scenes-block-header">
          <h3 class="scenes-block-title">Ch. ${chap.numero} — ${esc(chap.titre)}</h3>
          <div class="scenes-block-actions">
            <span class="scene-count-badge">${chapScenes.length} scène${chapScenes.length !== 1 ? 's' : ''}</span>
            <button class="btn btn-ghost btn-sm" onclick="previewChapter('${chap.id}')">👁 Préview</button>
            <button class="btn btn-ghost btn-sm" onclick="openLocalSceneModal(null, '${chap.id}')">+ Ajouter</button>
          </div>
        </div>
        <div class="scenes-drop-zone ${scenesViewState.mode === 'cards' ? 'cork-board-grid' : ''}"
             data-chapter-id="${chap.id}"
             ondragover="onDragOver(event)"
             ondragleave="onDragLeave(event)"
             ondrop="onDropScene(event, '${chap.id}')">
          ${scenesViewState.mode !== 'cards' ? '<div class="drop-hint">Glisser une scène ici</div>' : ''}
          ${chapScenes.map((s, idx) => renderSceneCard(s, chap.id, chapters, idx, chapScenes.length)).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderSceneCard(s, chapitreId, chapters, idx = -1, total = 0) {
  const STATUT_BADGES = {
    'Brouillon': 'badge-brouillon',
    'En cours':  'badge-en-cours',
    'Terminé':   'badge-termine',
  };
  const statBadge = STATUT_BADGES[s.statut] || 'badge-brouillon';
  const wc        = wordCount(s.contenu);

  // POV character name
  let povName = '';
  if (s.pov && state.currentProjectId) {
    const chars = getProjectData(state.currentProjectId, 'personnages');
    const c     = chars.find(x => x.id === s.pov);
    if (c) povName = [c.prenom, c.nom].filter(Boolean).join(' ');
  }

  // Reorder arrows (only inside a chapter)
  let orderBtns = '';
  if (chapitreId && idx >= 0) {
    orderBtns = `
      <button class="btn-icon" onclick="moveSceneInChapter('${s.id}','${chapitreId}','up')"
              ${idx === 0 ? 'disabled style="opacity:.3"' : ''} title="Monter">▲</button>
      <button class="btn-icon" onclick="moveSceneInChapter('${s.id}','${chapitreId}','down')"
              ${idx >= total - 1 ? 'disabled style="opacity:.3"' : ''} title="Descendre">▼</button>`;
  }

  return `
    <div class="scene-card"
         id="scard-${s.id}"
         draggable="true"
         ondragstart="onDragStart(event,'${s.id}')"
         ondragend="onDragEnd(event)">
      <div class="scene-card-header">
        <div class="scene-card-left">
          <span class="scene-drag-handle" title="Glisser">⠿</span>
          <span class="scene-card-title">${esc(s.titre)}</span>
        </div>
        <div class="scene-card-actions">
          ${orderBtns}
          <button class="btn-icon" onclick="openSceneEditor('${s.id}')" title="Écrire">✍️</button>
          <button class="btn-icon" onclick="openLocalSceneModal('${s.id}')" title="Modifier">✏️</button>
          <button class="btn-icon" onclick="deleteSceneConfirm('${s.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="scene-card-badges">
        <span class="badge ${statBadge}">${esc(s.statut)}</span>
        ${s.typeScene === 'reference' ? '<span class="badge badge-globale">Globale</span>' : ''}
      </div>
      <div class="scene-card-meta">
        ${povName ? `<span>👤 ${esc(povName)}</span>` : ''}
        <span>📝 ${wc} mot${wc !== 1 ? 's' : ''}</span>
      </div>
      ${s.tags && s.tags.length ? `<div class="scene-card-tags">${renderTags(s.tags)}</div>` : ''}
    </div>`;
}

// ============================================================
// LOCAL SCENE — modal
// ============================================================
let _editingLocalId = null;

function openLocalSceneModal(sceneId = null, presetChapitreId = null) {
  _editingLocalId = sceneId;
  document.getElementById('modal-local-scene-title').textContent =
    sceneId ? 'Modifier la scène' : 'Nouvelle scène';

  ['ls-titre', 'ls-tags', 'ls-contenu', 'ls-notes'].forEach(id =>
    document.getElementById(id).value = ''
  );
  document.getElementById('ls-statut').value = 'Brouillon';

  // Populate POV select
  const povSel = document.getElementById('ls-pov');
  const chars  = getProjectData(state.currentProjectId, 'personnages');
  povSel.innerHTML = '<option value="">— Aucun —</option>' +
    chars.map(c => {
      const name = [c.prenom, c.nom].filter(Boolean).join(' ');
      return `<option value="${c.id}">${esc(name)}</option>`;
    }).join('');

  // Populate chapter select
  const chapSel  = document.getElementById('ls-chapitre');
  const chapters = getProjectData(state.currentProjectId, 'chapitres').sort((a, b) => a.numero - b.numero);
  chapSel.innerHTML = '<option value="">— Non assignée —</option>' +
    chapters.map(c => `<option value="${c.id}">Ch. ${c.numero} — ${esc(c.titre)}</option>`).join('');

  if (presetChapitreId) chapSel.value = presetChapitreId;

  if (sceneId) {
    const s = getProjectData(state.currentProjectId, 'scenes').find(x => x.id === sceneId);
    if (s) {
      document.getElementById('ls-titre').value   = s.titre   || '';
      document.getElementById('ls-statut').value  = s.statut  || 'Brouillon';
      document.getElementById('ls-pov').value     = s.pov     || '';
      document.getElementById('ls-chapitre').value = s.assigneChapitreId || '';
      document.getElementById('ls-tags').value    = (s.tags || []).join(', ');
      document.getElementById('ls-contenu').value = s.contenu || '';
      document.getElementById('ls-notes').value   = s.notes   || '';
    }
  }

  // if a Quill editor is active (chapter/scene page), blur it so keystrokes go to modal
  if (window.editorState && window.editorState.quill) {
    try { window.editorState.quill.blur(); } catch {}
  }
  openModal('modal-local-scene');
  // focus title field as soon as modal is visible
  const titleEl = document.getElementById('ls-titre');
  titleEl.focus();

}

function saveLocalScene() {
  const titre = document.getElementById('ls-titre').value.trim();
  if (!titre) { showToast('Le titre est requis', 'error'); return; }

  const now          = new Date().toISOString();
  const newChapId    = document.getElementById('ls-chapitre').value || null;

  let scenes = getProjectData(state.currentProjectId, 'scenes');

  if (_editingLocalId) {
    const idx = scenes.findIndex(s => s.id === _editingLocalId);
    if (idx !== -1) {
      const oldChapId = scenes[idx].assigneChapitreId;
      scenes[idx] = {
        ...scenes[idx],
        titre,
        statut:  document.getElementById('ls-statut').value,
        pov:     document.getElementById('ls-pov').value,
        tags:    parseTags(document.getElementById('ls-tags').value),
        contenu: document.getElementById('ls-contenu').value.trim(),
        notes:   document.getElementById('ls-notes').value.trim(),
        assigneChapitreId: newChapId,
        updatedAt: now,
      };
      // Sync chapter scenesIds
      _syncChapterScenes(state.currentProjectId, _editingLocalId, oldChapId, newChapId);
    }
  } else {
    const scene = {
      id: uid(),
      titre,
      statut:              document.getElementById('ls-statut').value,
      pov:                 document.getElementById('ls-pov').value,
      tags:                parseTags(document.getElementById('ls-tags').value),
      contenu:             document.getElementById('ls-contenu').value.trim(),
      notes:               document.getElementById('ls-notes').value.trim(),
      typeScene:           'locale',
      sceneGlobaleId:      null,
      variablesRemplacees: {},
      assigneChapitreId:   newChapId,
      ordreInChapitre:     0,
      createdAt:           now,
      updatedAt:           now,
    };
    scenes.push(scene);
    if (newChapId) _addToChapterScenes(state.currentProjectId, scene.id, newChapId);
  }

  saveProjectData(state.currentProjectId, 'scenes', scenes);
  touchProject(state.currentProjectId);
  closeModal('modal-local-scene');
  renderScenes();
  if (state.currentSection === 'manuscrit') renderManuscript();
  showToast(_editingLocalId ? 'Scène modifiée' : 'Scène créée', 'success');
  _editingLocalId = null;
}

function deleteSceneConfirm(sceneId) {
  const s = getProjectData(state.currentProjectId, 'scenes').find(x => x.id === sceneId);
  if (!s) return;
  showConfirm(`Supprimer "${s.titre}" ?`, 'Cette action est irréversible.', () => {
    const id = state.currentProjectId;
    let scenes = getProjectData(id, 'scenes').filter(x => x.id !== sceneId);
    saveProjectData(id, 'scenes', scenes);
    if (s.assigneChapitreId) _removeFromChapterScenes(id, sceneId, s.assigneChapitreId);
    touchProject(id);
    closeModal('modal-confirm');
    renderScenes();
    if (state.currentSection === 'manuscrit') renderManuscript();
    showToast('Scène supprimée', 'success');
  });
}

// ============================================================
// CHAPTER ↔ SCENE SYNC HELPERS
// ============================================================
function _addToChapterScenes(projectId, sceneId, chapitreId) {
  const chapters = getProjectData(projectId, 'chapitres');
  const chap = chapters.find(c => c.id === chapitreId);
  if (!chap) return;
  if (!chap.scenesIds) chap.scenesIds = [];
  if (!chap.scenesIds.includes(sceneId)) chap.scenesIds.push(sceneId);
  saveProjectData(projectId, 'chapitres', chapters);
}

function _removeFromChapterScenes(projectId, sceneId, chapitreId) {
  const chapters = getProjectData(projectId, 'chapitres');
  const chap = chapters.find(c => c.id === chapitreId);
  if (!chap || !chap.scenesIds) return;
  chap.scenesIds = chap.scenesIds.filter(id => id !== sceneId);
  saveProjectData(projectId, 'chapitres', chapters);
}

function _syncChapterScenes(projectId, sceneId, oldChapId, newChapId) {
  if (oldChapId === newChapId) return;
  if (oldChapId) _removeFromChapterScenes(projectId, sceneId, oldChapId);
  if (newChapId) _addToChapterScenes(projectId, sceneId, newChapId);
}

// ============================================================
// DRAG & DROP
// ============================================================
let _draggedSceneId = null;

function onDragStart(event, sceneId) {
  _draggedSceneId = sceneId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', sceneId);
  setTimeout(() => {
    const el = document.getElementById('scard-' + sceneId);
    if (el) el.classList.add('dragging');
  }, 0);
}

function onDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const zone = event.currentTarget;
  if (zone.classList.contains('scenes-drop-zone')) {
    zone.classList.add('drag-over');
  }
}

function onDragLeave(event) {
  const zone = event.currentTarget;
  if (!zone.contains(event.relatedTarget)) {
    zone.classList.remove('drag-over');
  }
}

function onDragEnd(event) {
  document.querySelectorAll('.scene-card.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  _draggedSceneId = null;
}

function onDropScene(event, chapitreId) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const sceneId = _draggedSceneId || event.dataTransfer.getData('text/plain');
  if (!sceneId) return;

  _assignSceneToChapter(sceneId, chapitreId || null);
  _draggedSceneId = null;
  renderScenes();
}

function _assignSceneToChapter(sceneId, newChapitreId) {
  const id     = state.currentProjectId;
  const scenes = getProjectData(id, 'scenes');
  const scene  = scenes.find(s => s.id === sceneId);
  if (!scene) return;

  const oldChapitreId = scene.assigneChapitreId;
  if (oldChapitreId === (newChapitreId || null)) return;

  scene.assigneChapitreId = newChapitreId || null;
  scene.updatedAt         = new Date().toISOString();

  saveProjectData(id, 'scenes', scenes);
  _syncChapterScenes(id, sceneId, oldChapitreId, newChapitreId);
  touchProject(id);
}

// ============================================================
// REORDER IN CHAPTER
// ============================================================
function moveSceneInChapter(sceneId, chapitreId, direction) {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres');
  const chap     = chapters.find(c => c.id === chapitreId);
  if (!chap || !chap.scenesIds) return;

  const idx = chap.scenesIds.indexOf(sceneId);
  if (idx === -1) return;

  if (direction === 'up'   && idx > 0)                        [chap.scenesIds[idx], chap.scenesIds[idx - 1]] = [chap.scenesIds[idx - 1], chap.scenesIds[idx]];
  if (direction === 'down' && idx < chap.scenesIds.length - 1) [chap.scenesIds[idx], chap.scenesIds[idx + 1]] = [chap.scenesIds[idx + 1], chap.scenesIds[idx]];

  saveProjectData(id, 'chapitres', chapters);
  touchProject(id);
  renderScenes();
}

// ============================================================
// IMPORT FROM LIBRARY
// ============================================================
function openImportSceneModal() {
  if (!state.currentProjectId) { showToast('Ouvrez un projet d\'abord', 'error'); return; }

  const scenes = getGlobalScenes();
  const sel    = document.getElementById('import-scene-select');
  sel.innerHTML = '<option value="">— Choisir une scène —</option>' +
    scenes.map(s => `<option value="${s.id}">${esc(s.titre)} (${esc(s.categorie)})</option>`).join('');

  document.querySelector('input[name="import-type"][value="copie"]').checked = true;
  document.getElementById('import-variables-section').classList.add('hidden');
  document.getElementById('import-variables-fields').innerHTML = '';

  openModal('modal-import-scene');
}

function onImportSceneSelect() {
  const sceneId = document.getElementById('import-scene-select').value;
  const section = document.getElementById('import-variables-section');
  const fields  = document.getElementById('import-variables-fields');

  if (!sceneId) { section.classList.add('hidden'); return; }

  const s    = getGlobalScenes().find(x => x.id === sceneId);
  const vars = detectVariables(s?.contenu || '');

  if (vars.length === 0) { section.classList.add('hidden'); return; }

  section.classList.remove('hidden');
  fields.innerHTML = vars.map(v => `
    <div class="var-row">
      <div class="var-label">${esc(v)}</div>
      <input type="text" class="form-control" id="var-${esc(v.replace(/[\[\]]/g, ''))}"
             placeholder="Remplacer par…">
    </div>`).join('');
}

function importGlobalScene() {
  const sceneId = document.getElementById('import-scene-select').value;
  if (!sceneId) { showToast('Choisissez une scène', 'error'); return; }

  const globalScene = getGlobalScenes().find(x => x.id === sceneId);
  if (!globalScene) return;

  const typeImport = document.querySelector('input[name="import-type"]:checked').value;
  const vars       = detectVariables(globalScene.contenu || '');

  const replacements = {};
  vars.forEach(v => {
    const safeId = v.replace(/[\[\]]/g, '');
    const input  = document.getElementById('var-' + safeId);
    if (input && input.value.trim()) replacements[v] = input.value.trim();
  });

  const contenu = applyVariables(globalScene.contenu, replacements);
  const now     = new Date().toISOString();

  const newScene = {
    id:                 uid(),
    titre:              globalScene.titre,
    statut:             'Brouillon',
    pov:                '',
    tags:               [...(globalScene.tags || [])],
    contenu:            contenu,
    notes:              globalScene.descriptionUsage || '',
    typeScene:          typeImport,        // 'copie' | 'reference'
    sceneGlobaleId:     typeImport === 'reference' ? sceneId : null,
    variablesRemplacees: replacements,
    assigneChapitreId:  null,
    ordreInChapitre:    0,
    createdAt:          now,
    updatedAt:          now,
  };

  const scenes = getProjectData(state.currentProjectId, 'scenes');
  scenes.push(newScene);
  saveProjectData(state.currentProjectId, 'scenes', scenes);
  touchProject(state.currentProjectId);
  closeModal('modal-import-scene');
  renderScenes();
  showToast(`Scène importée : "${globalScene.titre}"`, 'success');
}

// ============================================================
// PREVIEW CHAPTER
// ============================================================
function previewChapter(chapitreId) {
  const id       = state.currentProjectId;
  const chapters = getProjectData(id, 'chapitres');
  const chap     = chapters.find(c => c.id === chapitreId);
  if (!chap) return;

  const scenes  = getProjectData(id, 'scenes');
  const chars   = getProjectData(id, 'personnages');
  const ids     = chap.scenesIds || [];
  const ordered = ids.map(sid => scenes.find(s => s.id === sid)).filter(Boolean);

  document.getElementById('preview-chapter-title').textContent =
    `Ch. ${chap.numero} — ${chap.titre}`;

  const content = document.getElementById('preview-chapter-content');

  if (ordered.length === 0) {
    content.innerHTML = `<div class="preview-empty">Aucune scène assignée à ce chapitre.</div>`;
  } else {
    content.innerHTML = ordered.map((s, i) => {
      const c    = chars.find(x => x.id === s.pov);
      const pov  = c ? [c.prenom, c.nom].filter(Boolean).join(' ') : '';
      const wc   = wordCount(s.contenu);
      return `
        <div class="preview-scene">
          <div class="preview-scene-header">
            <span class="preview-scene-num">Scène ${i + 1}</span>
            <span class="preview-scene-title">${esc(s.titre)}</span>
            <span class="preview-scene-meta">${pov ? `POV : ${esc(pov)} · ` : ''}${wc} mots</span>
          </div>
          <div class="preview-scene-text">${esc(s.contenu || '(Contenu vide)')}</div>
        </div>`;
    }).join('');
  }

  openModal('modal-preview-chapter');
}

// ============================================================
// EXPORT / IMPORT helpers (called from app.js)
// ============================================================
function getScenesExportData(projectId) {
  return getProjectData(projectId, 'scenes');
}

function restoreScenesImportData(projectId, scenes) {
  if (Array.isArray(scenes)) saveProjectData(projectId, 'scenes', scenes);
}

// ============================================================
// SCENES STATS BAR
// ============================================================
function _renderScenesStats(scenes, chapters) {
  const el = document.getElementById('scenes-stats-bar');
  if (!el) return;
  const total      = scenes.length;
  const assigned   = scenes.filter(s => s.assigneChapitreId).length;
  const unassigned = total - assigned;
  const done       = scenes.filter(s => s.statut === 'Terminé').length;
  const inprog     = scenes.filter(s => s.statut === 'En cours').length;
  const draft      = scenes.filter(s => s.statut === 'Brouillon').length;
  const totalWords = scenes.reduce((acc, s) => acc + wordCount(s.contenu), 0);

  const alerts = [];
  if (unassigned > 0) alerts.push(`⚠️ ${unassigned} scène${unassigned > 1 ? 's' : ''} non assignée${unassigned > 1 ? 's' : ''}`);
  chapters.forEach(c => {
    if (!c.scenesIds || c.scenesIds.length === 0) alerts.push(`⚠️ Ch. ${c.numero} sans scènes`);
  });

  el.innerHTML = `
    <div class="scenes-stat-item">📊 <strong>${total}</strong> scènes</div>
    <div class="scenes-stat-item">📝 <strong>${totalWords.toLocaleString('fr')}</strong> mots</div>
    <div class="scenes-stat-item">✅ <strong>${done}</strong> terminées</div>
    <div class="scenes-stat-item">🔄 <strong>${inprog}</strong> en cours</div>
    <div class="scenes-stat-item">📋 <strong>${draft}</strong> brouillons</div>
    ${alerts.length ? `<div class="scenes-stat-alert">${alerts[0]}</div>` : ''}
  `;
}

// ============================================================
// CORKBOARD / LIST VIEW TOGGLE
// ============================================================
function setScenesView(mode) {
  scenesViewState.mode = mode;
  document.getElementById('scenes-btn-list')?.classList.toggle('active', mode === 'list');
  document.getElementById('scenes-btn-cards')?.classList.toggle('active', mode === 'cards');
  renderScenes();
}

function renderSceneCard(s, chapitreId, chapters, idx = -1, total = 0) {
  const STATUT_BADGES = {
    'Brouillon': 'badge-brouillon',
    'En cours':  'badge-en-cours',
    'Terminé':   'badge-termine',
  };
  const statBadge = STATUT_BADGES[s.statut] || 'badge-brouillon';
  const wc        = wordCount(s.contenu);
  const isCard    = scenesViewState.mode === 'cards';

  let povName = '';
  if (s.pov && state.currentProjectId) {
    const chars = getProjectData(state.currentProjectId, 'personnages');
    const c     = chars.find(x => x.id === s.pov);
    if (c) povName = [c.prenom, c.nom].filter(Boolean).join(' ');
  }

  let orderBtns = '';
  if (chapitreId && idx >= 0 && !isCard) {
    orderBtns = `
      <button class="btn-icon" onclick="moveSceneInChapter('${s.id}','${chapitreId}','up')"
              ${idx === 0 ? 'disabled style="opacity:.3"' : ''} title="Monter">▲</button>
      <button class="btn-icon" onclick="moveSceneInChapter('${s.id}','${chapitreId}','down')"
              ${idx >= total - 1 ? 'disabled style="opacity:.3"' : ''} title="Descendre">▼</button>`;
  }

  const isSelected = scenesViewState.selected.has(s.id);

  if (isCard) {
    return `
      <div class="scene-cork-card ${isSelected ? 'selected' : ''}"
           id="scard-${s.id}"
           draggable="true"
           ondragstart="onDragStart(event,'${s.id}')"
           ondragend="onDragEnd(event)"
           onclick="toggleSceneSelect('${s.id}', event)">
        <div class="cork-card-header">
          <span class="badge ${statBadge}" style="font-size:10px">${esc(s.statut)}</span>
          ${s.typeScene === 'reference' ? '<span class="badge badge-globale" style="font-size:10px">G</span>' : ''}
          <span class="cork-card-wc">${wc}m</span>
        </div>
        <div class="cork-card-title">${esc(s.titre)}</div>
        ${povName ? `<div class="cork-card-pov">👤 ${esc(povName)}</div>` : ''}
        ${s.tags && s.tags.length ? `<div class="cork-card-tags">${renderTags(s.tags.slice(0,2))}</div>` : ''}
        <div class="cork-card-actions">
          <button class="btn-icon" onclick="openSceneEditor('${s.id}');event.stopPropagation()" title="Écrire">✍️</button>
          <button class="btn-icon" onclick="openLocalSceneModal('${s.id}');event.stopPropagation()" title="Modifier">✏️</button>
          <button class="btn-icon" onclick="deleteSceneConfirm('${s.id}');event.stopPropagation()" title="Supprimer">🗑️</button>
        </div>
      </div>`;
  }

  return `
    <div class="scene-card"
         id="scard-${s.id}"
         draggable="true"
         ondragstart="onDragStart(event,'${s.id}')"
         ondragend="onDragEnd(event)">
      <div class="scene-card-header">
        <div class="scene-card-left">
          <input type="checkbox" class="scene-select-cb" ${isSelected ? 'checked' : ''}
                 onclick="toggleSceneSelect('${s.id}', event)" title="Sélectionner">
          <span class="scene-drag-handle" title="Glisser">⠿</span>
          <span class="scene-card-title">${esc(s.titre)}</span>
        </div>
        <div class="scene-card-actions">
          ${orderBtns}
          <button class="btn-icon" onclick="openSceneEditor('${s.id}')" title="Écrire">✍️</button>
          <button class="btn-icon" onclick="openLocalSceneModal('${s.id}')" title="Modifier">✏️</button>
          <button class="btn-icon" onclick="deleteSceneConfirm('${s.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="scene-card-badges">
        <span class="badge ${statBadge}">${esc(s.statut)}</span>
        ${s.typeScene === 'reference' ? '<span class="badge badge-globale">Globale</span>' : ''}
      </div>
      <div class="scene-card-meta">
        ${povName ? `<span>👤 ${esc(povName)}</span>` : ''}
        <span>📝 ${wc} mot${wc !== 1 ? 's' : ''}</span>
      </div>
      ${s.tags && s.tags.length ? `<div class="scene-card-tags">${renderTags(s.tags)}</div>` : ''}
    </div>`;
}

function toggleSceneSelect(sceneId, event) {
  if (event) event.stopPropagation();
  if (scenesViewState.selected.has(sceneId)) {
    scenesViewState.selected.delete(sceneId);
  } else {
    scenesViewState.selected.add(sceneId);
  }
  _updateMergeBar();
  // Refresh card highlight without full re-render
  const el = document.getElementById('scard-' + sceneId);
  if (el) el.classList.toggle('selected', scenesViewState.selected.has(sceneId));
  const cb = el?.querySelector('.scene-select-cb');
  if (cb) cb.checked = scenesViewState.selected.has(sceneId);
}

function _updateMergeBar() {
  const bar = document.getElementById('scenes-merge-bar');
  if (!bar) return;
  const n = scenesViewState.selected.size;
  if (n >= 2) {
    bar.classList.remove('hidden');
    bar.querySelector('.merge-count').textContent = `${n} scènes sélectionnées`;
  } else {
    bar.classList.add('hidden');
  }
}

// ============================================================
// MERGE SCENES
// ============================================================
function mergeSelectedScenes() {
  const id = state.currentProjectId;
  const scenes = getProjectData(id, 'scenes');
  const selectedIds = [...scenesViewState.selected];
  if (selectedIds.length < 2) return;

  // Sort by chapter order, then by creation
  const selected = selectedIds
    .map(sid => scenes.find(s => s.id === sid))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.assigneChapitreId === b.assigneChapitreId) {
        return (a.ordreInChapitre ?? 999) - (b.ordreInChapitre ?? 999);
      }
      return 0;
    });

  const mergedContent = selected.map(s => s.contenu || '').join('\n\n');
  const first = selected[0];
  const merged = {
    id:                uid(),
    titre:             first.titre + ' (fusionnée)',
    pov:               first.pov,
    statut:            first.statut,
    tags:              [...new Set(selected.flatMap(s => s.tags || []))],
    contenu:           mergedContent,
    contenuHtml:       mergedContent.split('\n').map(l => `<p>${l || '<br>'}</p>`).join(''),
    notes:             selected.map(s => s.notes).filter(Boolean).join('\n'),
    typeScene:         'locale',
    sceneGlobaleId:    null,
    assigneChapitreId: first.assigneChapitreId,
    ordreInChapitre:   first.ordreInChapitre,
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
  };

  // Remove selected scenes, insert merged at first's position
  const chaptersData = getProjectData(id, 'chapitres');
  let newScenes = scenes.filter(s => !scenesViewState.selected.has(s.id));

  // Update chapter scenesIds
  chaptersData.forEach(c => {
    if (!c.scenesIds) return;
    const positions = selectedIds.map(sid => c.scenesIds.indexOf(sid)).filter(i => i >= 0);
    if (positions.length > 0) {
      const insertAt = Math.min(...positions);
      c.scenesIds = c.scenesIds.filter(sid => !selectedIds.includes(sid));
      c.scenesIds.splice(insertAt, 0, merged.id);
    }
  });

  newScenes.push(merged);
  saveProjectData(id, 'scenes', newScenes);
  saveProjectData(id, 'chapitres', chaptersData);
  touchProject(id);

  scenesViewState.selected.clear();
  showToast(`${selected.length} scènes fusionnées`, 'success');
  renderScenes();
}

// ============================================================
// CONVERT CHAPTER → SCENES
// ============================================================
function openConvertChapterModal(chapId) {
  const id   = state.currentProjectId;
  const chap = getProjectData(id, 'chapitres').find(c => c.id === chapId);
  if (!chap) return;

  const text = chap.contenu || '';
  if (!text.trim()) { showToast('Chapitre vide', 'error'); return; }

  // Auto-detect split points
  const separatorPatterns = [
    /\n\s*#{1,3}\s+/g,   // ### heading
    /\n\s*\*{3}\s*\n/g,  // ***
    /\n\s*---\s*\n/g,    // ---
    /\n{3,}/g,           // triple newlines
  ];

  let parts = [text];
  for (const pattern of separatorPatterns) {
    const split = text.split(pattern);
    if (split.length > parts.length) parts = split;
  }

  parts = parts.map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    // Force split by double newlines as fallback
    parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  }

  const preview = parts.map((p, i) => `
    <div class="convert-part">
      <div class="convert-part-header">
        <span>Scène ${i + 1}</span>
        <span class="convert-part-wc">${wordCount(p)} mots</span>
      </div>
      <div class="convert-part-preview">${esc(p.substring(0, 120))}${p.length > 120 ? '…' : ''}</div>
    </div>`).join('');

  document.getElementById('convert-chapter-id').value = chapId;
  document.getElementById('convert-preview').innerHTML = preview;
  document.getElementById('convert-count').textContent = parts.length;
  document.getElementById('convert-parts-data').value  = JSON.stringify(parts);
  openModal('modal-convert-chapter');
}

function confirmConvertChapter() {
  const id     = state.currentProjectId;
  const chapId = document.getElementById('convert-chapter-id').value;
  const parts  = JSON.parse(document.getElementById('convert-parts-data').value || '[]');
  if (!parts.length) return;

  const chapters = getProjectData(id, 'chapitres');
  const ci = chapters.findIndex(c => c.id === chapId);
  if (ci === -1) return;

  const chap   = chapters[ci];
  const scenes = getProjectData(id, 'scenes');
  const newIds = [];

  parts.forEach((text, idx) => {
    const sc = {
      id:                uid(),
      titre:             `${chap.titre || 'Scène'} — partie ${idx + 1}`,
      pov:               chap.pov || '',
      statut:            'Brouillon',
      tags:              chap.tags ? [...chap.tags] : [],
      contenu:           text,
      contenuHtml:       text.split('\n').map(l => `<p>${l || '<br>'}</p>`).join(''),
      notes:             '',
      typeScene:         'locale',
      sceneGlobaleId:    null,
      assigneChapitreId: chapId,
      ordreInChapitre:   idx,
      createdAt:         new Date().toISOString(),
      updatedAt:         new Date().toISOString(),
    };
    scenes.push(sc);
    newIds.push(sc.id);
  });

  chapters[ci].scenesIds = newIds;
  chapters[ci].contenu   = '';
  chapters[ci].contenuHtml = '';

  saveProjectData(id, 'scenes', scenes);
  saveProjectData(id, 'chapitres', chapters);
  touchProject(id);
  closeModal('modal-convert-chapter');
  showToast(`Chapitre converti en ${parts.length} scènes`, 'success');
  navigateTo('scenes');
}

// ============================================================
// CONTINUOUS VIEW (scenes assembled in chapter)
// ============================================================
function openContinuousView(chapId) {
  scenesViewState.continuousChapId = chapId;
  const id      = state.currentProjectId;
  const chaps   = getProjectData(id, 'chapitres');
  const scenes  = getProjectData(id, 'scenes');
  const chap    = chaps.find(c => c.id === chapId);
  if (!chap) return;

  const scenesList = (chap.scenesIds || [])
    .map(sid => scenes.find(s => s.id === sid))
    .filter(Boolean);

  const html = scenesList.map((s, i) => `
    <div class="continuous-scene">
      <div class="continuous-scene-sep">— Scène ${i + 1} : ${esc(s.titre)} —</div>
      <div class="continuous-scene-body">${s.contenuHtml || s.contenu.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('') || '<p class="empty-scene">Scène vide</p>'}</div>
    </div>`).join('');

  document.getElementById('continuous-view-title').textContent = `Ch. ${chap.numero} — ${chap.titre}`;
  document.getElementById('continuous-view-body').innerHTML = html || '<p style="color:var(--gray-400)">Aucune scène assignée</p>';
  openModal('modal-continuous-view');
}

// ============================================================
// TEMPLATES & SNIPPETS (Bibliothèque)
// ============================================================
function getGlobalTemplates() {
  return JSON.parse(localStorage.getItem('bibliotheque_globale_templates') || '[]');
}
function saveGlobalTemplates(list) {
  localStorage.setItem('bibliotheque_globale_templates', JSON.stringify(list));
}
function getGlobalSnippets() {
  return JSON.parse(localStorage.getItem('bibliotheque_globale_snippets') || '[]');
}
function saveGlobalSnippets(list) {
  localStorage.setItem('bibliotheque_globale_snippets', JSON.stringify(list));
}

let _editingTemplateId = null;
let _editingSnippetId  = null;

function openTemplateModal(id = null) {
  _editingTemplateId = id;
  const templates = getGlobalTemplates();
  const tpl = id ? templates.find(t => t.id === id) : null;
  document.getElementById('tpl-titre').value    = tpl?.titre    || '';
  document.getElementById('tpl-categorie').value = tpl?.categorie || 'Autre';
  document.getElementById('tpl-contenu').value  = tpl?.contenu  || '';
  document.getElementById('tpl-desc').value     = tpl?.description || '';
  document.getElementById('modal-template-title').textContent = id ? 'Modifier template' : 'Nouveau template';
  openModal('modal-template');
}

function saveTemplate() {
  const titre    = document.getElementById('tpl-titre').value.trim();
  const contenu  = document.getElementById('tpl-contenu').value.trim();
  if (!titre) { showToast('Titre requis', 'error'); return; }

  const templates = getGlobalTemplates();
  const entry = {
    id:          _editingTemplateId || uid(),
    titre,
    categorie:   document.getElementById('tpl-categorie').value,
    contenu,
    description: document.getElementById('tpl-desc').value.trim(),
    createdAt:   _editingTemplateId ? (templates.find(t => t.id === _editingTemplateId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };

  if (_editingTemplateId) {
    const idx = templates.findIndex(t => t.id === _editingTemplateId);
    if (idx !== -1) templates[idx] = entry; else templates.push(entry);
  } else {
    templates.push(entry);
  }
  saveGlobalTemplates(templates);
  closeModal('modal-template');
  showToast('Template sauvegardé', 'success');
  renderBibliotheque();
}

function deleteTemplateConfirm(id) {
  showConfirm('Supprimer ce template ?', '', () => {
    const templates = getGlobalTemplates().filter(t => t.id !== id);
    saveGlobalTemplates(templates);
    renderBibliotheque();
    showToast('Template supprimé');
  });
}

function useTemplate(id) {
  const tpl = getGlobalTemplates().find(t => t.id === id);
  if (!tpl) return;
  openLocalSceneModal(null, null, tpl.contenu, tpl.titre);
}

function openSnippetModal(id = null) {
  _editingSnippetId = id;
  const snippets = getGlobalSnippets();
  const snip = id ? snippets.find(s => s.id === id) : null;
  document.getElementById('snip-titre').value   = snip?.titre   || '';
  document.getElementById('snip-contenu').value = snip?.contenu || '';
  document.getElementById('snip-tags').value    = (snip?.tags || []).join(', ');
  document.getElementById('modal-snippet-title').textContent = id ? 'Modifier snippet' : 'Nouveau snippet';
  openModal('modal-snippet');
}

function saveSnippet() {
  const titre   = document.getElementById('snip-titre').value.trim();
  const contenu = document.getElementById('snip-contenu').value.trim();
  if (!titre) { showToast('Titre requis', 'error'); return; }

  const snippets = getGlobalSnippets();
  const entry = {
    id:        _editingSnippetId || uid(),
    titre,
    contenu,
    tags:      parseTags(document.getElementById('snip-tags').value),
    createdAt: _editingSnippetId ? (snippets.find(s => s.id === _editingSnippetId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (_editingSnippetId) {
    const idx = snippets.findIndex(s => s.id === _editingSnippetId);
    if (idx !== -1) snippets[idx] = entry; else snippets.push(entry);
  } else {
    snippets.push(entry);
  }
  saveGlobalSnippets(snippets);
  closeModal('modal-snippet');
  showToast('Snippet sauvegardé', 'success');
  renderBibliotheque();
}

function deleteSnippetConfirm(id) {
  showConfirm('Supprimer ce snippet ?', '', () => {
    const snippets = getGlobalSnippets().filter(s => s.id !== id);
    saveGlobalSnippets(snippets);
    renderBibliotheque();
    showToast('Snippet supprimé');
  });
}

function copySnippet(id) {
  const snip = getGlobalSnippets().find(s => s.id === id);
  if (!snip) return;
  navigator.clipboard?.writeText(snip.contenu || '').then(
    () => showToast('Snippet copié !', 'success'),
    () => showToast('Copie non supportée', 'error')
  );
}

// ============================================================
// BIBLIOTHÈQUE TABS
// ============================================================
function switchBiblioTab(tab) {
  document.querySelectorAll('.biblio-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.biblio-tab[data-tab="${tab}"]`).classList.add('active');

  document.getElementById('biblio-tab-scenes').style.display = tab === 'scenes' ? '' : 'none';
  document.getElementById('biblio-tab-music').style.display = tab === 'music' ? '' : 'none';
  document.getElementById('biblio-tab-sections').style.display = tab === 'sections' ? '' : 'none';

  document.getElementById('biblio-actions-scenes').style.display = tab === 'scenes' ? 'flex' : 'none';
  document.getElementById('biblio-actions-music').style.display = tab === 'music' ? 'flex' : 'none';
  document.getElementById('biblio-actions-sections').style.display = tab === 'sections' ? 'flex' : 'none';

  if (tab === 'music') renderMusicLibrary();
  else if (tab === 'sections') renderGlobalSectionsLibrary();
  else renderBibliotheque();
}

// ============================================================
// GLOBAL MUSIC LIBRARY STORAGE
// ============================================================
function getGlobalMusic() {
  return JSON.parse(localStorage.getItem('bibliotheque_globale_music') || '[]');
}
function saveGlobalMusic(list) {
  localStorage.setItem('bibliotheque_globale_music', JSON.stringify(list));
}

// ============================================================
// MUSIC LIBRARY — render
// ============================================================
const MOOD_COLORS = {
  'Épique':       'badge-action',
  'Mélancolique': 'badge-tension',
  'Joyeux':       'badge-romance',
  'Sombre':       'badge-tension',
  'Romantique':   'badge-romance',
  'Tension':      'badge-tension',
  'Calme':        'badge-revelation',
  'Autre':        'badge-autre',
};

function renderMusicLibrary() {
  let music = getGlobalMusic();
  const filterMood = document.getElementById('biblio-music-filter-mood')?.value || '';
  const search     = (document.getElementById('biblio-music-search')?.value || '').toLowerCase();

  if (filterMood) music = music.filter(m => m.mood === filterMood);
  if (search) music = music.filter(m =>
    (m.titre || '').toLowerCase().includes(search) ||
    (m.artiste || '').toLowerCase().includes(search) ||
    (m.tags || []).some(t => t.toLowerCase().includes(search))
  );

  const grid  = document.getElementById('biblio-music-grid');
  const empty = document.getElementById('no-biblio-music');

  if (music.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = music.map(m => {
    const badge = m.mood ? `<span class="biblio-card-badge ${MOOD_COLORS[m.mood] || 'badge-autre'}">${esc(m.mood)}</span>` : '';
    const tags  = (m.tags && m.tags.length) ? `<div class="biblio-card-tags">${m.tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : '';
    const img   = m.image ? `<div class="music-card-cover"><img src="${m.image}" alt="couverture"></div>` : '';
    const usage = getGlobalMusicUsage(m.id);

    return `
      <div class="biblio-card music-card">
        ${img}
        <div class="biblio-card-header">
          <div>
            <div class="biblio-card-title">${esc(m.titre)}</div>
            ${m.artiste ? `<div class="music-card-artist">${esc(m.artiste)}</div>` : ''}
          </div>
          <div class="biblio-card-actions">
            <button class="btn-icon" onclick="openGlobalMusicModal('${m.id}')" title="Modifier">✏️</button>
            <button class="btn-icon" onclick="deleteGlobalMusicConfirm('${m.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
        ${m.album ? `<div class="biblio-card-meta"><small>Album : ${esc(m.album)}</small></div>` : ''}
        ${badge}
        ${tags}
        ${m.notes ? `<div class="biblio-card-desc">${esc(m.notes)}</div>` : ''}
        <div class="biblio-card-footer">
          <span class="biblio-usage">${usage} projet${usage !== 1 ? 's' : ''}</span>
          <div style="display:flex;gap:6px">
            ${m.url ? `<button class="btn btn-spotify btn-sm" onclick="window.open('${esc(m.url)}','_blank')">▶️ Écouter</button>` : ''}
            ${m.audioData ? `<button class="btn btn-secondary btn-sm" onclick="playGlobalMusic('${m.id}')">🔊 Lire</button>` : ''}
            ${state.currentProjectId ? `<button class="btn btn-secondary btn-sm" onclick="copyGlobalMusicToProject('${m.id}')">⬇ Copier</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function getGlobalMusicUsage(globalMusicId) {
  const projects = getProjects();
  let count = 0;
  projects.forEach(p => {
    const playlists = getProjectData(p.id, 'playlists');
    if (playlists.some(pl => (pl.titres || []).some(t => t.globalMusicId === globalMusicId))) count++;
  });
  return count;
}

// ============================================================
// GLOBAL MUSIC — CRUD
// ============================================================
let _editingGlobalMusicId = null;

function openGlobalMusicModal(musicId = null) {
  _editingGlobalMusicId = musicId;
  document.getElementById('modal-global-music-title').textContent =
    musicId ? 'Modifier la musique' : 'Nouvelle musique';

  // Reset fields
  ['gm-titre', 'gm-artiste', 'gm-album', 'gm-url', 'gm-tags', 'gm-notes'].forEach(id =>
    document.getElementById(id).value = ''
  );
  document.getElementById('gm-mood').value = '';
  document.getElementById('gm-file').value = '';
  document.getElementById('gm-file-info').textContent = '';
  document.getElementById('gm-image').value = '';
  document.getElementById('gm-image-preview').innerHTML = '';

  if (musicId) {
    const m = getGlobalMusic().find(x => x.id === musicId);
    if (m) {
      document.getElementById('gm-titre').value   = m.titre || '';
      document.getElementById('gm-artiste').value  = m.artiste || '';
      document.getElementById('gm-album').value    = m.album || '';
      document.getElementById('gm-url').value      = m.url || '';
      document.getElementById('gm-mood').value     = m.mood || '';
      document.getElementById('gm-tags').value     = (m.tags || []).join(', ');
      document.getElementById('gm-notes').value    = m.notes || '';
      if (m.audioData) {
        document.getElementById('gm-file-info').textContent = '🎵 Fichier audio déjà enregistré';
      }
      if (m.image) {
        document.getElementById('gm-image-preview').innerHTML =
          `<img src="${m.image}" alt="couverture" style="max-width:120px;border-radius:4px">`;
      }
    }
  }

  // Image preview handler
  document.getElementById('gm-image').onchange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('gm-image-preview').innerHTML =
          `<img src="${ev.target.result}" alt="aperçu" style="max-width:120px;border-radius:4px">`;
      };
      reader.readAsDataURL(file);
    }
  };

  // Audio file info
  document.getElementById('gm-file').onchange = e => {
    const file = e.target.files[0];
    if (file) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      document.getElementById('gm-file-info').textContent = `🎵 ${file.name} (${sizeMB} Mo)`;
    }
  };

  openModal('modal-global-music');
}

function saveGlobalMusic() {
  const titre = document.getElementById('gm-titre').value.trim();
  if (!titre) { showToast('Le titre est requis', 'error'); return; }

  const artiste = document.getElementById('gm-artiste').value.trim();
  const album   = document.getElementById('gm-album').value.trim();
  const url     = document.getElementById('gm-url').value.trim();
  const mood    = document.getElementById('gm-mood').value;
  const tags    = parseTags(document.getElementById('gm-tags').value);
  const notes   = document.getElementById('gm-notes').value.trim();

  const audioFile = document.getElementById('gm-file').files[0];
  const imageFile = document.getElementById('gm-image').files[0];

  const processAudio = (cb) => {
    if (audioFile) {
      const reader = new FileReader();
      reader.onload = ev => cb(ev.target.result);
      reader.readAsDataURL(audioFile);
    } else {
      cb(null);
    }
  };

  const processImage = (cb) => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = ev => cb(ev.target.result);
      reader.readAsDataURL(imageFile);
    } else {
      cb(null);
    }
  };

  processAudio(audioData => {
    processImage(imageData => {
      const list = getGlobalMusic();
      let item = _editingGlobalMusicId ? list.find(x => x.id === _editingGlobalMusicId) : null;
      const now = new Date().toISOString();

      if (!item) {
        item = { id: uid(), createdAt: now };
        list.push(item);
      }

      item.titre   = titre;
      item.artiste  = artiste;
      item.album    = album;
      item.url      = url;
      item.mood     = mood;
      item.tags     = tags;
      item.notes    = notes;
      item.updatedAt = now;

      if (audioData) item.audioData = audioData;
      if (imageData) item.image = imageData;

      saveGlobalMusic(list);
      closeModal('modal-global-music');
      showToast('Musique enregistrée', 'success');
      renderMusicLibrary();
    });
  });
}

function deleteGlobalMusicConfirm(musicId) {
  const m = getGlobalMusic().find(x => x.id === musicId);
  if (!m) return;
  showConfirm(
    `Supprimer "${m.titre}" ?`,
    'Cette musique sera retirée de la bibliothèque globale.',
    () => {
      const list = getGlobalMusic().filter(x => x.id !== musicId);
      saveGlobalMusic(list);
      renderMusicLibrary();
      showToast('Musique supprimée', 'success');
    }
  );
}

// ============================================================
// PLAY AUDIO FROM LIBRARY
// ============================================================
let _globalAudioPlayer = null;

function playGlobalMusic(musicId) {
  const m = getGlobalMusic().find(x => x.id === musicId);
  if (!m || !m.audioData) return;

  if (_globalAudioPlayer) {
    _globalAudioPlayer.pause();
    _globalAudioPlayer = null;
  }

  _globalAudioPlayer = new Audio(m.audioData);
  _globalAudioPlayer.play().catch(() => showToast('Lecture impossible', 'error'));
  showToast(`Lecture : ${m.titre}`, 'success');
}

// ============================================================
// COPY GLOBAL MUSIC TO PROJECT (as playlist track)
// ============================================================
function copyGlobalMusicToProject(globalMusicId) {
  if (!state.currentProjectId) { showToast('Ouvrez un projet d\'abord', 'error'); return; }

  const m = getGlobalMusic().find(x => x.id === globalMusicId);
  if (!m) return;

  // Create a new single-track playlist from this music
  const playlists = getProjectData(state.currentProjectId, 'playlists');
  const now = new Date().toISOString();
  const newPlaylist = {
    id: uid(),
    nom: m.titre + (m.artiste ? ' – ' + m.artiste : ''),
    url: m.url || '',
    image: m.image || '',
    tags: m.tags || [],
    notes: m.notes || '',
    associated: [],
    titres: [{
      titre: m.titre,
      artiste: m.artiste || '',
      globalMusicId: m.id
    }],
    createdAt: now,
    updatedAt: now,
  };
  playlists.push(newPlaylist);
  saveProjectData(state.currentProjectId, 'playlists', playlists);
  touchProject(state.currentProjectId);
  showToast(`"${m.titre}" ajouté aux playlists du projet`, 'success');
}

// ============================================================
// IMPORT MUSIC MODAL (from project playlists section)
// ============================================================
let _selectedMusicImports = new Set();

function openImportMusicModal() {
  if (!state.currentProjectId) { showToast('Ouvrez un projet d\'abord', 'error'); return; }
  _selectedMusicImports.clear();
  document.getElementById('import-music-mood-filter').value = '';
  document.getElementById('import-music-search').value = '';
  renderImportMusicList();
  openModal('modal-import-music');
}

function renderImportMusicList() {
  let music = getGlobalMusic();
  const mood   = document.getElementById('import-music-mood-filter')?.value || '';
  const search = (document.getElementById('import-music-search')?.value || '').toLowerCase();

  if (mood) music = music.filter(m => m.mood === mood);
  if (search) music = music.filter(m =>
    (m.titre || '').toLowerCase().includes(search) ||
    (m.artiste || '').toLowerCase().includes(search) ||
    (m.tags || []).some(t => t.toLowerCase().includes(search))
  );

  const container = document.getElementById('import-music-list');
  const empty     = document.getElementById('import-music-empty');

  if (music.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  container.innerHTML = music.map(m => {
    const checked = _selectedMusicImports.has(m.id) ? 'checked' : '';
    const moodBadge = m.mood ? `<span class="tag-chip">${esc(m.mood)}</span>` : '';
    return `
      <label class="import-music-item">
        <input type="checkbox" ${checked} onchange="toggleMusicImport('${m.id}')">
        <div class="import-music-info">
          <strong>${esc(m.titre)}</strong>
          ${m.artiste ? `<span class="import-music-artist">— ${esc(m.artiste)}</span>` : ''}
          ${moodBadge}
        </div>
      </label>`;
  }).join('');
}

function toggleMusicImport(musicId) {
  if (_selectedMusicImports.has(musicId)) _selectedMusicImports.delete(musicId);
  else _selectedMusicImports.add(musicId);
}

function importSelectedMusic() {
  if (_selectedMusicImports.size === 0) {
    showToast('Sélectionnez au moins une musique', 'error');
    return;
  }

  const allMusic  = getGlobalMusic();
  const playlists = getProjectData(state.currentProjectId, 'playlists');
  const now       = new Date().toISOString();

  _selectedMusicImports.forEach(musicId => {
    const m = allMusic.find(x => x.id === musicId);
    if (!m) return;

    playlists.push({
      id: uid(),
      nom: m.titre + (m.artiste ? ' – ' + m.artiste : ''),
      url: m.url || '',
      image: m.image || '',
      tags: m.tags || [],
      notes: m.notes || '',
      associated: [],
      titres: [{
        titre: m.titre,
        artiste: m.artiste || '',
        globalMusicId: m.id
      }],
      createdAt: now,
      updatedAt: now,
    });
  });

  saveProjectData(state.currentProjectId, 'playlists', playlists);
  touchProject(state.currentProjectId);
  closeModal('modal-import-music');
  renderPlaylists();
  showToast(`${_selectedMusicImports.size} musique(s) importée(s)`, 'success');
  _selectedMusicImports.clear();
}

// ============================================================
// GLOBAL SECTIONS LIBRARY STORAGE
// ============================================================
function getGlobalSections() {
  return JSON.parse(localStorage.getItem('bibliotheque_globale_sections') || '[]');
}
function saveGlobalSectionsLib(list) {
  localStorage.setItem('bibliotheque_globale_sections', JSON.stringify(list));
}

// ============================================================
// GLOBAL SECTIONS LIBRARY — render
// ============================================================
function renderGlobalSectionsLibrary() {
  const all = getGlobalSections();
  const filterDisplay = (document.getElementById('biblio-sections-filter-display') || {}).value || '';
  const search = (document.getElementById('biblio-sections-search') || {}).value.toLowerCase().trim();

  let filtered = all;
  if (filterDisplay) filtered = filtered.filter(s => s.typeAffichage === filterDisplay);
  if (search) filtered = filtered.filter(s =>
    s.nom.toLowerCase().includes(search) ||
    (s.tags || []).some(t => t.toLowerCase().includes(search)) ||
    (s.description || '').toLowerCase().includes(search)
  );

  const grid = document.getElementById('biblio-sections-grid');
  const empty = document.getElementById('no-biblio-sections');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  const displayLabels = { cards: '🖼 Galerie', liste: '≡ Liste', tableau: '⊞ Tableau' };

  grid.innerHTML = filtered.map(s => {
    const fieldsPreview = (s.champs || []).slice(0, 4).map(f => esc(f.nom)).join(', ');
    const extraFields = (s.champs || []).length > 4 ? ` +${(s.champs || []).length - 4}` : '';
    const usageCount = _countGlobalSectionUsage(s.id);
    return `
    <div class="biblio-card biblio-section-card" onclick="openGlobalSectionModal('${s.id}')">
      <div class="biblio-section-icon">${esc(s.icone || '📁')}</div>
      <h4 class="biblio-card-title">${esc(s.nom)}</h4>
      ${s.description ? `<p class="biblio-section-desc">${esc(s.description)}</p>` : ''}
      <div class="biblio-section-meta">
        <span class="badge badge-neutral">${displayLabels[s.typeAffichage] || 'Galerie'}</span>
        <span class="biblio-section-fields">${(s.champs || []).length} champ(s)</span>
      </div>
      ${fieldsPreview ? `<p class="biblio-section-fields-preview">${fieldsPreview}${extraFields}</p>` : ''}
      ${(s.tags || []).length > 0 ? `<div class="biblio-tags">${s.tags.map(t => `<span class="badge">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="biblio-section-usage">${usageCount} projet(s) l'utilisent</div>
    </div>`;
  }).join('');
}

function _countGlobalSectionUsage(globalId) {
  let count = 0;
  const projects = JSON.parse(localStorage.getItem('projects') || '[]');
  projects.forEach(p => {
    const cs = JSON.parse(localStorage.getItem(`projet_${p.id}_customSections`) || '[]');
    if (cs.some(s => s.globalSectionId === globalId)) count++;
  });
  return count;
}

// ============================================================
// GLOBAL SECTIONS — modal (create/edit)
// ============================================================
let _gsSectionChamps = [];
let _gsEditingId = null;

function openGlobalSectionModal(sectionId) {
  _gsEditingId = sectionId || null;
  _gsSectionChamps = [];

  document.getElementById('modal-gs-title').textContent = sectionId ? 'Modifier la section' : 'Nouvelle section (bibliothèque)';
  document.getElementById('gs-nom').value = '';
  document.getElementById('gs-icone').value = '📁';
  document.getElementById('gs-affichage').value = 'cards';
  document.getElementById('gs-description').value = '';
  document.getElementById('gs-tags').value = '';
  document.getElementById('gs-delete-btn').style.display = sectionId ? 'inline-block' : 'none';

  const icons = ['📁','🔮','⚔️','💭','🔐','📦','🌟','💎','🎭','🗝️','📜','🌍','🎵','🐉','🧙','🏰','⚗️','🌸','🎨','📚','🔬','🧩','🎯','💡','🔑'];
  const grid = document.getElementById('gs-icon-grid');
  if (grid) {
    grid.innerHTML = icons.map(ic =>
      `<button type="button" class="cs-icon-btn" onclick="document.getElementById('gs-icone').value='${ic}'">${ic}</button>`
    ).join('');
  }

  if (sectionId) {
    const s = getGlobalSections().find(x => x.id === sectionId);
    if (s) {
      document.getElementById('gs-nom').value = s.nom;
      document.getElementById('gs-icone').value = s.icone || '📁';
      document.getElementById('gs-affichage').value = s.typeAffichage || 'cards';
      document.getElementById('gs-description').value = s.description || '';
      document.getElementById('gs-tags').value = (s.tags || []).join(', ');
      _gsSectionChamps = (s.champs || []).map(f => ({...f}));
    }
  }

  renderGSFieldBuilder();
  openModal('modal-global-section');
  setTimeout(() => document.getElementById('gs-nom').focus(), 80);
}

function renderGSFieldBuilder() {
  const container = document.getElementById('gs-champs-list');
  if (!container) return;
  if (_gsSectionChamps.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-400);font-size:13px;margin:8px 0">Aucun champ. Cliquez sur "+ Ajouter un champ".</p>';
    return;
  }
  const fieldTypes = [
    { value: 'text',            label: '📝 Texte court' },
    { value: 'textarea',        label: '📄 Texte long' },
    { value: 'number',          label: '🔢 Nombre' },
    { value: 'date',            label: '📅 Date' },
    { value: 'color',           label: '🎨 Couleur' },
    { value: 'image',           label: '🖼️ Image' },
    { value: 'link_personnage', label: '🔗 Lien personnage' },
    { value: 'link_lieu',       label: '🔗 Lien lieu' },
    { value: 'link_chapitre',   label: '🔗 Lien chapitre' },
    { value: 'checkbox',        label: '☑️ Checkbox' },
    { value: 'rating',          label: '⭐ Rating (1-5)' },
    { value: 'select',          label: '📋 Liste déroulante' },
    { value: 'tags',            label: '🏷️ Tags' },
  ];
  container.innerHTML = _gsSectionChamps.map((f, idx) => `
    <div class="cs-field-row">
      <span class="cs-field-drag">⠿</span>
      <input type="text" class="form-control cs-field-nom" value="${esc(f.nom)}" placeholder="Nom du champ"
             oninput="_gsSectionChamps[${idx}].nom=this.value">
      <select class="form-control cs-field-type" onchange="_gsSectionChamps[${idx}].type=this.value;renderGSFieldBuilder()">
        ${fieldTypes.map(t=>`<option value="${t.value}" ${f.type===t.value?'selected':''}>${t.label}</option>`).join('')}
      </select>
      <label class="cs-field-req"><input type="checkbox" ${f.obligatoire?'checked':''}
             onchange="_gsSectionChamps[${idx}].obligatoire=this.checked"> Requis</label>
      ${f.type==='select'?`<input type="text" class="form-control" style="min-width:150px" placeholder="Option1, Option2..."
             value="${esc((f.options||[]).join(', '))}"
             oninput="_gsSectionChamps[${idx}].options=this.value.split(',').map(x=>x.trim()).filter(Boolean)">`:'' }
      <button class="btn-icon" onclick="_gsSectionChamps.splice(${idx},1);renderGSFieldBuilder()" title="Supprimer">🗑️</button>
    </div>`).join('');
}

function gsAddField() {
  if (_gsSectionChamps.length >= 50) { showToast('Maximum 50 champs par section', 'error'); return; }
  _gsSectionChamps.push({ id: uid(), nom: '', type: 'text', obligatoire: false, options: [] });
  renderGSFieldBuilder();
}

function saveGlobalSection() {
  const nom = document.getElementById('gs-nom').value.trim();
  if (!nom) { showToast('Le nom est requis', 'error'); return; }
  for (const f of _gsSectionChamps) {
    if (!f.nom.trim()) { showToast('Tous les champs doivent avoir un nom', 'error'); return; }
  }
  const icone = document.getElementById('gs-icone').value.trim() || '📁';
  const typeAffichage = document.getElementById('gs-affichage').value;
  const description = document.getElementById('gs-description').value.trim();
  const tags = document.getElementById('gs-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const now = new Date().toISOString();

  const sections = getGlobalSections();
  if (_gsEditingId) {
    const idx = sections.findIndex(x => x.id === _gsEditingId);
    if (idx !== -1) {
      sections[idx] = { ...sections[idx], nom, icone, typeAffichage, description, tags, champs: _gsSectionChamps, updatedAt: now };
    }
  } else {
    sections.push({ id: uid(), nom, icone, typeAffichage, description, tags, champs: _gsSectionChamps, createdAt: now, updatedAt: now });
  }

  saveGlobalSectionsLib(sections);
  closeModal('modal-global-section');
  renderGlobalSectionsLibrary();
  showToast(_gsEditingId ? 'Section modifiée' : 'Section ajoutée à la bibliothèque', 'success');
  _gsEditingId = null;
}

function deleteGlobalSectionConfirm() {
  if (!_gsEditingId) return;
  if (!confirm('Supprimer cette section de la bibliothèque ? Les sections déjà importées dans vos projets ne seront pas affectées.')) return;
  const sections = getGlobalSections().filter(x => x.id !== _gsEditingId);
  saveGlobalSectionsLib(sections);
  closeModal('modal-global-section');
  renderGlobalSectionsLibrary();
  showToast('Section supprimée de la bibliothèque', 'success');
  _gsEditingId = null;
}

// ============================================================
// IMPORT SECTIONS FROM LIBRARY INTO PROJECT
// ============================================================
let _selectedSectionImports = new Set();

function openImportSectionModal() {
  if (!state.currentProjectId) { showToast('Ouvrez un projet d\'abord', 'error'); return; }
  _selectedSectionImports.clear();
  renderImportSectionList();
  openModal('modal-import-section');
}

function renderImportSectionList() {
  const allSections = getGlobalSections();
  const search = (document.getElementById('import-section-search') || {}).value.toLowerCase().trim();
  const listEl = document.getElementById('import-section-list');
  const emptyEl = document.getElementById('import-section-empty');
  if (!listEl) return;

  let filtered = allSections;
  if (search) {
    filtered = filtered.filter(s =>
      s.nom.toLowerCase().includes(search) ||
      (s.tags || []).some(t => t.toLowerCase().includes(search)) ||
      (s.description || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const existingSections = typeof getCustomSections === 'function' ? getCustomSections() : [];
  const alreadyImported = new Set(existingSections.filter(s => s.globalSectionId).map(s => s.globalSectionId));

  listEl.innerHTML = filtered.map(s => {
    const imported = alreadyImported.has(s.id);
    const checked = _selectedSectionImports.has(s.id);
    const fieldsInfo = (s.champs || []).length + ' champ(s)';
    return `
    <label class="import-section-item ${imported ? 'import-section-imported' : ''} ${checked ? 'selected' : ''}">
      <input type="checkbox" ${checked ? 'checked' : ''} ${imported ? 'disabled' : ''}
             onchange="toggleSectionImport('${s.id}')">
      <span class="import-section-icon">${esc(s.icone || '📁')}</span>
      <div class="import-section-info">
        <strong>${esc(s.nom)}</strong>
        ${s.description ? `<span class="import-section-desc">${esc(s.description)}</span>` : ''}
        <span class="import-section-meta">${fieldsInfo}</span>
      </div>
      ${imported ? '<span class="badge badge-neutral">Déjà importée</span>' : ''}
    </label>`;
  }).join('');
}

function toggleSectionImport(sectionId) {
  if (_selectedSectionImports.has(sectionId)) _selectedSectionImports.delete(sectionId);
  else _selectedSectionImports.add(sectionId);
}

function importSelectedSections() {
  if (_selectedSectionImports.size === 0) {
    showToast('Sélectionnez au moins une section', 'error');
    return;
  }

  const allGlobal = getGlobalSections();
  const sections = typeof getCustomSections === 'function' ? getCustomSections() : [];

  _selectedSectionImports.forEach(globalId => {
    const gs = allGlobal.find(x => x.id === globalId);
    if (!gs) return;
    if (sections.some(s => s.globalSectionId === globalId)) return;

    sections.push({
      id: uid(),
      nom: gs.nom,
      icone: gs.icone || '📁',
      typeAffichage: gs.typeAffichage || 'cards',
      champs: (gs.champs || []).map(f => ({...f, id: uid()})),
      items: [],
      globalSectionId: gs.id
    });
  });

  if (typeof saveCustomSections === 'function') saveCustomSections(sections);
  if (typeof touchProject === 'function') touchProject(state.currentProjectId);
  closeModal('modal-import-section');
  if (typeof renderCustomSectionsSidebar === 'function') renderCustomSectionsSidebar();
  showToast(`${_selectedSectionImports.size} section(s) importée(s)`, 'success');
  _selectedSectionImports.clear();
}
