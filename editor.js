/* ============================================================
   editor.js — Professional Chapter/Scene Editor
   Depends on: app.js (state, uid, esc, showToast, getProjectData,
               saveProjectData, touchProject, navigateTo, parseTags)
               scenes.js (_syncChapterScenes)
   ============================================================ */

'use strict';

// ============================================================
// EDITOR STATE
// ============================================================
const editorState = {
  type:             null,   // 'chapter' | 'scene'
  id:               null,   // current item id
  quill:            null,   // active Quill instance
  autoSaveTimer:    null,
  statusTimer:      null,
  lastSaved:        null,
  isDirty:          false,
  focusMode:        false,
  sidebarCollapsed: false,
  // Session stats
  sessionStartTime: null,
  sessionStartWords: 0,
  sessionTimer:     null,
  // Find/Replace
  findMatches:      [],
  findIndex:        -1,
  // Typo auto-format
  typoEnabled:      true,
};

// ============================================================
// UTILITIES
// ============================================================
function plainToHtml(text) {
  if (!text || !text.trim()) return '';
  return text.split('\n')
    .map(line => `<p>${line.trim() ? line : '<br>'}</p>`)
    .join('');
}

function htmlWordCount(quill) {
  if (!quill) return 0;
  const text = quill.getText().trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

// ============================================================
// OPEN CHAPTER EDITOR
// ============================================================
function openChapterEditor(chapId) {
  const chapters = getProjectData(state.currentProjectId, 'chapitres')
    .sort((a, b) => a.numero - b.numero);
  const chap = chapters.find(c => c.id === chapId);
  if (!chap) return;

  editorState.type = 'chapter';
  editorState.id   = chapId;
  editorState.isDirty = false;

  // Hide project page, show chapter editor
  document.getElementById('project-page').classList.add('hidden');
  document.getElementById('chapter-editor-page').classList.remove('hidden');

  // Header
  document.getElementById('ce-title').value = chap.titre || '';

  // Nav arrows
  _updateChapterNavBtns();

  // Sidebar metadata
  document.getElementById('ce-numero').value = chap.numero || '';
  document.getElementById('ce-statut').value = chap.statut || 'Brouillon';
  document.getElementById('ce-tags').value   = (chap.tags || []).join(', ');
  document.getElementById('ce-notes').value  = chap.notes || '';

  // POV select (characters)
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const povSel = document.getElementById('ce-pov');
  povSel.innerHTML = '<option value="">— Aucun —</option>' +
    chars.map(c => {
      const name = [c.prenom, c.nom].filter(Boolean).join(' ');
      return `<option value="${c.id}">${esc(name)}</option>`;
    }).join('');
  povSel.value = chap.pov || '';

  // Init Quill – if chapter contains scenes, build content from them (separator ###)
  let html;
  const scenes = getProjectData(state.currentProjectId, 'scenes');
  if (chap.scenesIds && chap.scenesIds.length) {
    // assemble scenes in order, ignore existing chapitre content
    html = '';
    chap.scenesIds.forEach((sid, idx) => {
      const s = scenes.find(sc => sc.id === sid);
      if (s) {
        html += `<p>${esc(s.contenu || '')}</p>`;
        if (idx < chap.scenesIds.length - 1) html += '<p>###</p>';
      }
    });
  } else {
    html = chap.contenuHtml || plainToHtml(chap.contenu || '');
  }
  _initQuill('chapter-quill-wrap', html);

  // Stats & autosave
  _updateStats();
  _startAutoSave();
  _startSessionStats();
  editorState.lastSaved = Date.now();
  _setAutosaveStatus('saved');

  // Reset focus / sidebar
  if (editorState.focusMode) _applyFocusMode(false);
  if (editorState.sidebarCollapsed) {
    document.getElementById('ce-sidebar').classList.remove('collapsed');
    editorState.sidebarCollapsed = false;
  }
}

// ============================================================
// OPEN SCENE EDITOR
// ============================================================
function openSceneEditor(sceneId) {
  const scenes = getProjectData(state.currentProjectId, 'scenes');
  const scene  = scenes.find(s => s.id === sceneId);
  if (!scene) return;

  editorState.type = 'scene';
  editorState.id   = sceneId;
  editorState.isDirty = false;

  // Hide project page, show scene editor
  document.getElementById('project-page').classList.add('hidden');
  document.getElementById('scene-editor-page').classList.remove('hidden');

  // Header
  document.getElementById('se-title').value = scene.titre || '';

  // POV select (characters)
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const povSel = document.getElementById('se-pov');
  povSel.innerHTML = '<option value="">— Aucun —</option>' +
    chars.map(c => {
      const name = [c.prenom, c.nom].filter(Boolean).join(' ');
      return `<option value="${c.id}">${esc(name)}</option>`;
    }).join('');
  povSel.value = scene.pov || '';

  // Sidebar metadata
  document.getElementById('se-statut').value = scene.statut || 'Brouillon';
  document.getElementById('se-tags').value   = (scene.tags || []).join(', ');
  document.getElementById('se-notes').value  = scene.notes || '';

  // Chapter select
  const chapters = getProjectData(state.currentProjectId, 'chapitres')
    .sort((a, b) => a.numero - b.numero);
  const chapSel = document.getElementById('se-chapitre');
  chapSel.innerHTML = '<option value="">— Non assignée —</option>' +
    chapters.map(c => `<option value="${c.id}">Ch. ${c.numero} — ${esc(c.titre)}</option>`).join('');
  chapSel.value = scene.assigneChapitreId || '';

  // Init Quill
  const html = scene.contenuHtml || plainToHtml(scene.contenu || '');
  _initQuill('scene-quill-wrap', html);

  // Stats & autosave
  _updateStats();
  _startAutoSave();
  _startSessionStats();
  editorState.lastSaved = Date.now();
  _setAutosaveStatus('saved');

  // Reset focus / sidebar
  if (editorState.focusMode) _applyFocusMode(false);
  if (editorState.sidebarCollapsed) {
    document.getElementById('se-sidebar').classList.remove('collapsed');
    editorState.sidebarCollapsed = false;
  }
}

// ============================================================
// QUILL INIT
// ============================================================
function _initQuill(wrapperId, htmlContent) {
  const wrap = document.getElementById(wrapperId);
  wrap.innerHTML = '';
  editorState.quill = null;

  const quill = new Quill(wrap, {
    theme: 'snow',
    placeholder: 'Commencez à écrire votre histoire…',
    modules: {
      toolbar: false,
      clipboard: { matchVisual: false },
    },
  });

  // Set initial content
  if (htmlContent && htmlContent.trim()) {
    quill.root.innerHTML = htmlContent;
  }

  // Move cursor to end
  quill.setSelection(quill.getLength(), 0, 'silent');

  quill.on('text-change', () => {
    if (editorState.quill !== quill) return;
    _updateStats();
    _markDirty();
  });

  // Typographic auto-formatting
  _initTypoFormatting(quill);

  quill.on('selection-change', () => {
    if (editorState.quill !== quill) return;
    _updateToolbarState();
  });

  editorState.quill = quill;
  setTimeout(() => quill.focus(), 120);
}

// ============================================================
// CLOSE EDITORS
// ============================================================
function closeChapterEditor() {
  _saveCurrentEditor();
  _stopAutoSave();
  _stopSessionStats();
  closeFindReplace();
  editorState.type = null;
  editorState.id   = null;
  if (editorState.focusMode) _applyFocusMode(false);
  document.getElementById('chapter-editor-page').classList.add('hidden');
  document.getElementById('project-page').classList.remove('hidden');
  navigateTo('chapitres');
}

function closeSceneEditor() {
  _saveCurrentEditor();
  _stopAutoSave();
  _stopSessionStats();
  closeFindReplace();
  editorState.type = null;
  editorState.id   = null;
  if (editorState.focusMode) _applyFocusMode(false);
  document.getElementById('scene-editor-page').classList.add('hidden');
  document.getElementById('project-page').classList.remove('hidden');
  navigateTo('scenes');
}

// ============================================================
// SAVE
// ============================================================
function _saveCurrentEditor() {
  if (editorState.type === 'chapter') _saveChapterEditor();
  else if (editorState.type === 'scene') _saveSceneEditor();
}

function _saveChapterEditor() {
  const id     = state.currentProjectId;
  const chapId = editorState.id;
  if (!id || !chapId) return;

  const chapters = getProjectData(id, 'chapitres');
  const idx      = chapters.findIndex(c => c.id === chapId);
  if (idx === -1) return;

  const quill = editorState.quill;
  const html  = quill ? quill.root.innerHTML : '';
  const plain = quill ? quill.getText().replace(/\n+$/, '') : '';

  const titre = document.getElementById('ce-title').value.trim();

  if (typeof snapshotVersion === 'function') snapshotVersion('chapitre', chapId, chapters[idx]);

  chapters[idx] = {
    ...chapters[idx],
    titre:       titre || chapters[idx].titre,
    numero:      parseInt(document.getElementById('ce-numero').value, 10) || chapters[idx].numero,
    pov:         document.getElementById('ce-pov').value,
    statut:      document.getElementById('ce-statut').value,
    tags:        parseTags(document.getElementById('ce-tags').value),
    notes:       document.getElementById('ce-notes').value.trim(),
    contenuHtml: html,
    contenu:     plain,
    updatedAt:   new Date().toISOString(),
  };
  // if chapter has scenes, propagate edits back into them split by separator
  if (chapters[idx].scenesIds && chapters[idx].scenesIds.length) {
    const scenesData = getProjectData(id, 'scenes');
    const parts = plain.split(/\s*###\s*/);
    chapters[idx].scenesIds.forEach((sid, si) => {
      const sidx = scenesData.findIndex(s => s.id === sid);
      if (sidx !== -1) {
        scenesData[sidx].contenu = parts[si] || '';
        scenesData[sidx].contenuHtml = parts[si] ? plainToHtml(parts[si]) : '';
        scenesData[sidx].updatedAt = new Date().toISOString();
      }
    });
    saveProjectData(id, 'scenes', scenesData);
  }

  saveProjectData(id, 'chapitres', chapters);
  touchProject(id);
  editorState.lastSaved = Date.now();
  editorState.isDirty   = false;
  _setAutosaveStatus('saved');
}

function _saveSceneEditor() {
  const id      = state.currentProjectId;
  const sceneId = editorState.id;
  if (!id || !sceneId) return;

  const scenes = getProjectData(id, 'scenes');
  const idx    = scenes.findIndex(s => s.id === sceneId);
  if (idx === -1) return;

  const quill = editorState.quill;
  const html  = quill ? quill.root.innerHTML : '';
  const plain = quill ? quill.getText().replace(/\n+$/, '') : '';

  const titre     = document.getElementById('se-title').value.trim();
  const newChapId = document.getElementById('se-chapitre').value || null;
  const oldChapId = scenes[idx].assigneChapitreId;

  if (typeof snapshotVersion === 'function') snapshotVersion('scene', sceneId, scenes[idx]);

  scenes[idx] = {
    ...scenes[idx],
    titre:             titre || scenes[idx].titre,
    pov:               document.getElementById('se-pov').value,
    statut:            document.getElementById('se-statut').value,
    tags:              parseTags(document.getElementById('se-tags').value),
    notes:             document.getElementById('se-notes').value.trim(),
    assigneChapitreId: newChapId,
    contenuHtml:       html,
    contenu:           plain,
    updatedAt:         new Date().toISOString(),
  };

  saveProjectData(id, 'scenes', scenes);

  if (oldChapId !== newChapId) {
    _syncChapterScenes(id, sceneId, oldChapId, newChapId);
  }

  touchProject(id);
  editorState.lastSaved = Date.now();
  editorState.isDirty   = false;
  _setAutosaveStatus('saved');
}

// Public save wrappers (called by buttons)
function saveChapterEditor() {
  _saveChapterEditor();
  showToast('Chapitre sauvegardé', 'success');
}
function saveSceneEditor() {
  _saveSceneEditor();
  showToast('Scène sauvegardée', 'success');
}

// ============================================================
// AUTO-SAVE
// ============================================================
function _startAutoSave() {
  _stopAutoSave();
  editorState.autoSaveTimer = setInterval(() => {
    if (editorState.isDirty) _saveCurrentEditor();
  }, 30000);
}
function _stopAutoSave() {
  if (editorState.autoSaveTimer) {
    clearInterval(editorState.autoSaveTimer);
    editorState.autoSaveTimer = null;
  }
}
function _markDirty() {
  editorState.isDirty = true;
  _setAutosaveStatus('unsaved');
}

function _setAutosaveStatus(status) {
  const pfx = editorState.type === 'chapter' ? 'ce' : 'se';
  const el  = document.getElementById(pfx + '-autosave');
  if (!el) return;

  if (status === 'saved') {
    el.className   = 'editor-autosave saved';
    el.textContent = 'Sauvegardé';
  } else if (status === 'saving') {
    el.className   = 'editor-autosave saving';
    el.textContent = 'Sauvegarde…';
  } else {
    el.className   = 'editor-autosave';
    el.textContent = 'Non sauvegardé';
  }
}

// Periodic "saved X seconds ago" update
setInterval(() => {
  if (!editorState.type || !editorState.lastSaved || editorState.isDirty) return;
  const pfx = editorState.type === 'chapter' ? 'ce' : 'se';
  const el  = document.getElementById(pfx + '-autosave');
  if (!el || !el.classList.contains('saved')) return;
  const secs = Math.round((Date.now() - editorState.lastSaved) / 1000);
  if (secs < 10)        el.textContent = 'Sauvegardé';
  else if (secs < 60)   el.textContent = `Sauvegardé il y a ${secs}s`;
  else                  el.textContent = `Sauvegardé il y a ${Math.floor(secs / 60)} min`;
}, 8000);

// ============================================================
// STATS
// ============================================================
function _updateStats() {
  const quill = editorState.quill;
  if (!quill) return;

  const text    = quill.getText();
  const trimmed = text.trim();
  const words   = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const chars   = text.replace(/\n/g, '').length;
  const paras   = trimmed ? text.split('\n').filter(l => l.trim().length > 0).length : 0;
  const readMin = words > 0 ? Math.max(1, Math.ceil(words / 250)) : 0;

  const pfx = editorState.type === 'chapter' ? 'ce' : 'se';

  // Header word count
  const wcEl = document.getElementById(pfx + '-wordcount');
  if (wcEl) wcEl.textContent = `${words} mot${words !== 1 ? 's' : ''}`;

  // Sidebar stats
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set(pfx + '-stat-words', words);
  set(pfx + '-stat-chars', chars);
  set(pfx + '-stat-paras', paras);
  set(pfx + '-stat-read',  readMin > 0 ? readMin + ' min' : '< 1 min');

  // Goal progress
  const goalEl = document.getElementById(pfx + '-goal-input');
  const barEl  = document.getElementById(pfx + '-goal-bar');
  const lblEl  = document.getElementById(pfx + '-goal-label');
  if (goalEl && barEl) {
    const goal = parseInt(goalEl.value, 10) || 0;
    if (goal > 0) {
      const pct = Math.min(100, Math.round((words / goal) * 100));
      barEl.style.width = pct + '%';
      barEl.className = 'progress-bar-inner' + (pct >= 100 ? ' complete' : '');
      if (lblEl) lblEl.textContent = `${words} / ${goal} (${pct}%)`;
    } else {
      barEl.style.width = '0%';
      if (lblEl) lblEl.textContent = '';
    }
  }
}

// ============================================================
// CHAPTER NAVIGATION
// ============================================================
function navigateChapterEditor(dir) {
  if (editorState.type !== 'chapter') return;
  _saveChapterEditor();

  const chapters = getProjectData(state.currentProjectId, 'chapitres')
    .sort((a, b) => a.numero - b.numero);
  const curIdx = chapters.findIndex(c => c.id === editorState.id);
  const nxtIdx = curIdx + dir;
  if (nxtIdx < 0 || nxtIdx >= chapters.length) return;

  openChapterEditor(chapters[nxtIdx].id);
}

function _updateChapterNavBtns() {
  const chapters = getProjectData(state.currentProjectId, 'chapitres')
    .sort((a, b) => a.numero - b.numero);
  const idx     = chapters.findIndex(c => c.id === editorState.id);
  const prevBtn = document.getElementById('ce-nav-prev');
  const nextBtn = document.getElementById('ce-nav-next');
  if (prevBtn) prevBtn.disabled = idx <= 0;
  if (nextBtn) nextBtn.disabled = idx >= chapters.length - 1;
}

// ============================================================
// TOOLBAR FORMATTING
// ============================================================
function editorFormat(fmt) {
  const q = editorState.quill;
  if (!q) return;
  q.format(fmt, !q.getFormat()[fmt]);
  _updateToolbarState();
  q.focus();
}

function editorSetHeading(level) {
  const q = editorState.quill;
  if (!q) return;
  const cur = q.getFormat().header;
  q.format('header', cur === level ? false : level);
  _updateToolbarState();
  q.focus();
}

function editorSetList(type) {
  const q = editorState.quill;
  if (!q) return;
  const cur = q.getFormat().list;
  q.format('list', cur === type ? false : type);
  _updateToolbarState();
  q.focus();
}

function editorIndent(dir) {
  const q = editorState.quill;
  if (!q) return;
  q.format('indent', dir === 'in' ? '+1' : '-1');
  q.focus();
}

function _updateToolbarState() {
  const q = editorState.quill;
  if (!q) return;
  const fmt = q.getFormat();
  const pfx = editorState.type === 'chapter' ? 'ce' : 'se';

  const map = {
    [`${pfx}-btn-bold`]:      !!fmt.bold,
    [`${pfx}-btn-italic`]:    !!fmt.italic,
    [`${pfx}-btn-underline`]: !!fmt.underline,
    [`${pfx}-btn-h1`]:        fmt.header === 1,
    [`${pfx}-btn-h2`]:        fmt.header === 2,
    [`${pfx}-btn-h3`]:        fmt.header === 3,
    [`${pfx}-btn-ul`]:        fmt.list === 'bullet',
    [`${pfx}-btn-ol`]:        fmt.list === 'ordered',
  };
  Object.entries(map).forEach(([id, active]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', active);
  });
}

// ============================================================
// FOCUS MODE
// ============================================================
function toggleFocusMode() {
  _applyFocusMode(!editorState.focusMode);
}

function _applyFocusMode(on) {
  editorState.focusMode = on;
  const pfx  = editorState.type === 'chapter' ? 'chapter' : 'scene';
  const page = document.getElementById(`${pfx}-editor-page`);
  if (page) page.classList.toggle('focus-mode', on);

  const hint = document.getElementById('focus-mode-hint');
  if (hint) hint.style.display = on ? 'block' : 'none';

  // Update focus buttons
  const cBtn = document.getElementById('ce-btn-focus');
  const sBtn = document.getElementById('se-btn-focus');
  if (cBtn) cBtn.classList.toggle('active', on);
  if (sBtn) sBtn.classList.toggle('active', on);
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleEditorSidebar() {
  editorState.sidebarCollapsed = !editorState.sidebarCollapsed;
  const pfx     = editorState.type === 'chapter' ? 'ce' : 'se';
  const sidebar = document.getElementById(`${pfx}-sidebar`);
  if (sidebar) sidebar.classList.toggle('collapsed', editorState.sidebarCollapsed);
}

// ============================================================
// SESSION STATS
// ============================================================
function _startSessionStats() {
  editorState.sessionStartTime  = Date.now();
  editorState.sessionStartWords = htmlWordCount(editorState.quill);
  if (editorState.sessionTimer) clearInterval(editorState.sessionTimer);
  _updateSessionStats();
  editorState.sessionTimer = setInterval(_updateSessionStats, 10000);
}

function _stopSessionStats() {
  if (editorState.sessionTimer) {
    clearInterval(editorState.sessionTimer);
    editorState.sessionTimer = null;
  }
}

function _updateSessionStats() {
  if (!editorState.sessionStartTime) return;
  const pfx     = editorState.type === 'chapter' ? 'ce' : 'se';
  const elapsed = Math.floor((Date.now() - editorState.sessionStartTime) / 1000);
  const curWords = htmlWordCount(editorState.quill);
  const added   = Math.max(0, curWords - editorState.sessionStartWords);
  const mins    = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2,'0')}`;

  const el = document.getElementById(pfx + '-session-stats');
  if (el) {
    el.style.display = '';
    const timeEl  = document.getElementById(pfx + '-session-time');
    const wordsEl = document.getElementById(pfx + '-session-words');
    if (timeEl)  timeEl.textContent  = timeStr;
    if (wordsEl) wordsEl.textContent = `+${added}`;
  }
}

// ============================================================
// FIND / REPLACE
// ============================================================
function openFindReplace() {
  const overlay = document.getElementById('find-replace-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.getElementById('fr-find').value = '';
  document.getElementById('fr-replace').value = '';
  document.getElementById('fr-status').textContent = '';
  editorState.findMatches = [];
  editorState.findIndex = -1;
  setTimeout(() => document.getElementById('fr-find').focus(), 50);
}

function closeFindReplace() {
  const overlay = document.getElementById('find-replace-overlay');
  if (overlay) overlay.classList.add('hidden');
  _clearFindHighlights();
  editorState.findMatches = [];
  editorState.findIndex = -1;
  if (editorState.quill) editorState.quill.focus();
}

function _clearFindHighlights() {
  const q = editorState.quill;
  if (!q) return;
  const len = q.getLength();
  q.formatText(0, len, 'background', false, 'silent');
  q.formatText(0, len, 'color', false, 'silent');
}

function findInEditor() {
  const q = editorState.quill;
  if (!q) return;
  const needle = document.getElementById('fr-find').value;
  if (!needle) { document.getElementById('fr-status').textContent = ''; return; }

  _clearFindHighlights();
  const text = q.getText();
  const matches = [];
  let idx = 0;
  const lower = text.toLowerCase();
  const needleLower = needle.toLowerCase();
  while ((idx = lower.indexOf(needleLower, idx)) !== -1) {
    matches.push(idx);
    idx += needle.length;
  }

  editorState.findMatches = matches;
  editorState.findIndex   = matches.length > 0 ? 0 : -1;

  // Highlight all
  matches.forEach(pos => {
    q.formatText(pos, needle.length, 'background', '#FBBF24', 'silent');
  });

  // Highlight current
  if (matches.length > 0) {
    q.formatText(matches[0], needle.length, 'background', '#F59E0B', 'silent');
    q.setSelection(matches[0], needle.length, 'silent');
    q.scrollIntoView && q.scrollIntoView();
  }

  const statusEl = document.getElementById('fr-status');
  if (statusEl) statusEl.textContent = matches.length > 0
    ? `${matches.length} résultat${matches.length > 1 ? 's' : ''}`
    : 'Aucun résultat';
}

function findNext() {
  const { findMatches, findIndex } = editorState;
  if (!findMatches.length) return;
  const needle = document.getElementById('fr-find').value;
  const q = editorState.quill;
  const newIdx = (findIndex + 1) % findMatches.length;
  editorState.findIndex = newIdx;
  // Reset all to yellow, highlight current in orange
  _clearFindHighlights();
  findMatches.forEach(pos => q.formatText(pos, needle.length, 'background', '#FBBF24', 'silent'));
  q.formatText(findMatches[newIdx], needle.length, 'background', '#F59E0B', 'silent');
  q.setSelection(findMatches[newIdx], needle.length, 'silent');
}

function findPrev() {
  const { findMatches, findIndex } = editorState;
  if (!findMatches.length) return;
  const needle = document.getElementById('fr-find').value;
  const q = editorState.quill;
  const newIdx = (findIndex - 1 + findMatches.length) % findMatches.length;
  editorState.findIndex = newIdx;
  _clearFindHighlights();
  findMatches.forEach(pos => q.formatText(pos, needle.length, 'background', '#FBBF24', 'silent'));
  q.formatText(findMatches[newIdx], needle.length, 'background', '#F59E0B', 'silent');
  q.setSelection(findMatches[newIdx], needle.length, 'silent');
}

function replaceOne() {
  const q = editorState.quill;
  const needle  = document.getElementById('fr-find').value;
  const replace = document.getElementById('fr-replace').value;
  if (!needle || editorState.findIndex < 0) return;
  const pos = editorState.findMatches[editorState.findIndex];
  q.deleteText(pos, needle.length);
  q.insertText(pos, replace);
  findInEditor();
}

function replaceAll() {
  const q = editorState.quill;
  const needle  = document.getElementById('fr-find').value;
  const replace = document.getElementById('fr-replace').value;
  if (!needle) return;
  let count = 0;
  // Work backwards to preserve indices
  const matches = [...editorState.findMatches].reverse();
  matches.forEach(pos => {
    q.deleteText(pos, needle.length);
    q.insertText(pos, replace);
    count++;
  });
  _clearFindHighlights();
  editorState.findMatches = [];
  editorState.findIndex = -1;
  const statusEl = document.getElementById('fr-status');
  if (statusEl) statusEl.textContent = `${count} remplacement${count > 1 ? 's' : ''} effectué${count > 1 ? 's' : ''}`;
}

// ============================================================
// TYPOGRAPHIC AUTO-FORMATTING
// ============================================================
function _initTypoFormatting(quill) {
  quill.on('text-change', (delta, _old, source) => {
    if (source !== 'user' || !editorState.typoEnabled) return;
    const ops = delta.ops;
    if (!ops) return;
    // Find if last op is an insert of a space or punctuation
    const lastOp = ops[ops.length - 1];
    if (!lastOp || !lastOp.insert || typeof lastOp.insert !== 'string') return;

    const char = lastOp.insert;
    const sel  = quill.getSelection();
    if (!sel) return;
    const pos = sel.index;

    // Auto-replace " at start of word → «
    if (char === '"' && pos >= 1) {
      const before = quill.getText(pos - 2, 1);
      if (!before.trim()) {
        quill.deleteText(pos - 1, 1, 'silent');
        quill.insertText(pos - 1, '« ', 'silent');
      }
    }
    // Auto-replace closing " → »
    // (simple heuristic: if there's already a « without matching »)
    if (char === '"') {
      const text = quill.getText(0, pos);
      const opens  = (text.match(/«/g) || []).length;
      const closes = (text.match(/»/g) || []).length;
      if (opens > closes) {
        quill.deleteText(pos - 1, 1, 'silent');
        quill.insertText(pos - 1, ' »', 'silent');
      }
    }
    // Replace -- with —
    if (char === '-' && pos >= 2) {
      const prev = quill.getText(pos - 2, 1);
      if (prev === '-') {
        quill.deleteText(pos - 2, 2, 'silent');
        quill.insertText(pos - 2, '—', 'silent');
      }
    }
    // Replace ... with …
    if (char === '.' && pos >= 3) {
      const prev2 = quill.getText(pos - 3, 2);
      if (prev2 === '..') {
        quill.deleteText(pos - 3, 3, 'silent');
        quill.insertText(pos - 3, '…', 'silent');
      }
    }
  });
}

function toggleTypoFormatting() {
  editorState.typoEnabled = !editorState.typoEnabled;
  const btn = document.getElementById('ce-btn-typo') || document.getElementById('se-btn-typo');
  if (btn) btn.classList.toggle('active', editorState.typoEnabled);
  showToast(editorState.typoEnabled ? 'Typographie auto activée' : 'Typographie auto désactivée');
}

// ============================================================
// SPLIT SCENE (Diviser scène au curseur)
// ============================================================
function splitSceneAtCursor() {
  if (editorState.type !== 'scene') return;
  const q = editorState.quill;
  const sel = q.getSelection();
  if (!sel) { showToast('Placez le curseur à l\'endroit de la coupure', 'error'); return; }

  const splitPos = sel.index;
  const fullText = q.getText();
  const part1 = fullText.substring(0, splitPos).trim();
  const part2 = fullText.substring(splitPos).trim();

  if (!part1 || !part2) { showToast('Les deux parties doivent avoir du contenu', 'error'); return; }

  // Save current scene with part1
  _saveSceneEditor();
  const id = state.currentProjectId;
  const scenes = getProjectData(id, 'scenes');
  const idx = scenes.findIndex(s => s.id === editorState.id);
  if (idx === -1) return;

  const orig = scenes[idx];
  scenes[idx].contenu     = part1;
  scenes[idx].contenuHtml = plainToHtml(part1);

  // Create new scene with part2
  const newScene = {
    id:                uid(),
    titre:             orig.titre + ' (suite)',
    pov:               orig.pov,
    statut:            orig.statut,
    tags:              [...(orig.tags || [])],
    contenu:           part2,
    contenuHtml:       plainToHtml(part2),
    notes:             '',
    typeScene:         'locale',
    sceneGlobaleId:    null,
    assigneChapitreId: orig.assigneChapitreId,
    ordreInChapitre:   orig.ordreInChapitre !== null ? orig.ordreInChapitre + 1 : null,
    createdAt:         new Date().toISOString(),
    updatedAt:         new Date().toISOString(),
  };
  scenes.splice(idx + 1, 0, newScene);

  // Update chapter scenesIds if assigned
  if (orig.assigneChapitreId) {
    const chaps = getProjectData(id, 'chapitres');
    const ci = chaps.findIndex(c => c.id === orig.assigneChapitreId);
    if (ci !== -1) {
      const sIds = chaps[ci].scenesIds || [];
      const sPos = sIds.indexOf(orig.id);
      if (sPos !== -1) sIds.splice(sPos + 1, 0, newScene.id);
      chaps[ci].scenesIds = sIds;
      saveProjectData(id, 'chapitres', chaps);
    }
  }

  saveProjectData(id, 'scenes', scenes);
  touchProject(id);
  showToast('Scène divisée en 2', 'success');
  closeSceneEditor();
}

// ============================================================
// GLOBAL KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  if (!editorState.type) return;

  // Ctrl/Cmd+F → find/replace
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFindReplace();
    return;
  }

  // Ctrl/Cmd+S → save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    _saveCurrentEditor();
    showToast('Sauvegardé', 'success');
    return;
  }

  // F11 → toggle focus mode
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFocusMode();
    return;
  }

  // Escape → close find/replace first, then exit focus mode
  if (e.key === 'Escape') {
    const fr = document.getElementById('find-replace-overlay');
    if (fr && !fr.classList.contains('hidden')) {
      closeFindReplace();
      return;
    }
    if (editorState.focusMode) _applyFocusMode(false);
  }
});
