/* ============================================================
   WorldBuilder — app.js
   Vanilla JS, localStorage, no dependencies
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const state = {
  currentProjectId: null,
  currentSection:   'dashboard',
  editingId:        null,
  sidebarCollapsed: false,
  confirmCallback:  null,
  relationsView:     'list',   // 'list' or 'graph'
};

// simple DOM cache to avoid repeated lookups
const elCache = {};
function $(id) {
  if (!elCache[id]) elCache[id] = document.getElementById(id);
  return elCache[id];
}

// ============================================================
// STORAGE HELPERS
// ============================================================
function getProjects() {
  return JSON.parse(localStorage.getItem('projets_liste') || '[]');
}
function saveProjects(list) {
  localStorage.setItem('projets_liste', JSON.stringify(list));
}

function getProjectData(projectId, type) {
  return JSON.parse(localStorage.getItem(`projet_${projectId}_${type}`) || '[]');
}
function saveProjectData(projectId, type, data) {
  localStorage.setItem(`projet_${projectId}_${type}`, JSON.stringify(data));
}
function clearProjectData(projectId) {
  ['personnages', 'lieux', 'chapitres', 'scenes', 'playlists', 'events', 'notes', 'relations', 'manuscrit', 'prefs', 'customSections'].forEach(t =>
    localStorage.removeItem(`projet_${projectId}_${t}`)
  );
}

function getProjectPrefs(projectId) {
  return JSON.parse(localStorage.getItem(`projet_${projectId}_prefs`) || '{}');
}
function saveProjectPrefs(projectId, prefs) {
  localStorage.setItem(`projet_${projectId}_prefs`, JSON.stringify(prefs));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function touchProject(projectId) {
  const list = getProjects();
  const idx  = list.findIndex(p => p.id === projectId);
  if (idx !== -1) {
    list[idx].updatedAt = new Date().toISOString();
    saveProjects(list);
  }
  if (state.currentProjectId === projectId) debouncedUpdateStats();
}

// ============================================================
// UTILITIES
// ============================================================
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ---------------------------------------------------------
// Global search helpers (used by keyboard ctl+k)
function performGlobalSearch(q) {
  const out = { personnages: [], lieux: [], chapitres: [], scenes: [], relations: [], notes: [], events: [] };
  if (!q) return out;
  q = q.toLowerCase();
  const id = state.currentProjectId;
  if (!id) return out;
  out.personnages = getProjectData(id,'personnages').filter(x=>([x.prenom,x.nom].join(' ')||'').toLowerCase().includes(q));
  out.lieux = getProjectData(id,'lieux').filter(x=>x.nom.toLowerCase().includes(q));
  out.chapitres = getProjectData(id,'chapitres').filter(x=>x.titre.toLowerCase().includes(q));
  out.scenes = getProjectData(id,'scenes').filter(x=>x.titre.toLowerCase().includes(q));
  out.relations = getProjectData(id,'relations').filter(x=>x.type.toLowerCase().includes(q));
  out.notes = getProjectData(id,'notes').filter(x=>x.titre.toLowerCase().includes(q) || (x.content||'').toLowerCase().includes(q));
  out.events = getProjectData(id,'events').filter(x=>x.titre.toLowerCase().includes(q) || (x.desc||'').toLowerCase().includes(q));
  return out;
}

function showSearchResults(res) {
  const container = document.getElementById('search-results');
  if (!container) return;
  if (!res) { container.classList.add('hidden'); return; }
  let html = '';
  for (const type in res) {
    if (!res[type] || res[type].length === 0) continue;
    html += `<div class="group-title">${esc(type)}</div>`;
    res[type].forEach(item=>{
      let text = item.nom || item.titre || item.name || '';
      html += `<div class="result-item" tabindex="0" data-type="${type}" data-id="${item.id}"
                 onclick="activateSearchResult('${type}','${item.id}')"
                 onkeydown="if(event.key==='Enter')activateSearchResult('${type}','${item.id}')">
                 ${esc(text)}</div>`;
    });
  }
  if (!html) html = '<div class="result-item" tabindex="0">Aucun résultat</div>';
  container.innerHTML = html;
  container.classList.remove('hidden');
}

function activateSearchResult(type, id) {
  if (!type || !id) return;
  navigateTo(type); // section IDs match keys
  switch(type) {
    case 'personnages': openCharacterModal(id); break;
    case 'lieux': openLocationModal(id); break;
    case 'chapitres': openChapterModal(id); break;
    case 'scenes': if (typeof openLocalSceneModal === 'function') openLocalSceneModal(id); break;
    case 'relations': openRelationModal(id); break;
    case 'notes': openNoteModal(id); break;
    case 'events': openEventModal(id); break;
  }
}


// ---------------------------------------------------------
// Accessibility helpers: focus trapping, modal roles, icon labels
let lastFocused = null;
function trapTabKey(e) {
  if (e.key !== 'Tab') return;
  const modal = e.currentTarget;
  const focusableEls = modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
  if (focusableEls.length === 0) return;
  const firstFocusable = focusableEls[0];
  const lastFocusable = focusableEls[focusableEls.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  }
}

// enhance open/close modal
function openModal(id) {
  const modal = document.getElementById(id);
  lastFocused = document.activeElement;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const focusable = modal.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])');
  if (focusable) focusable.focus();
  modal.addEventListener('keydown', trapTabKey);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  modal.removeEventListener('keydown', trapTabKey);
  if (lastFocused) lastFocused.focus();
}

// on load add roles to modals and propagate aria-labels
function initAccessibilityHelpers() {
  document.querySelectorAll('.modal-overlay').forEach(mod => {
    mod.setAttribute('role', 'dialog');
    mod.setAttribute('aria-modal', 'true');
    const h3 = mod.querySelector('h3');
    if (h3) {
      if (!h3.id) h3.id = mod.id + '-title';
      mod.setAttribute('aria-labelledby', h3.id);
    }
  });
  document.querySelectorAll('.btn-icon').forEach(b=>{
    if (!b.hasAttribute('aria-label')) {
      const t = b.getAttribute('title');
      if (t) b.setAttribute('aria-label', t);
    }
  });
  document.querySelectorAll('.modal-close').forEach(b=>{
    if (!b.hasAttribute('aria-label')) b.setAttribute('aria-label','Fermer');
  });
}

document.addEventListener('DOMContentLoaded', initAccessibilityHelpers);

// simple debounce helper
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// debounced wrappers will be assigned after functions are defined
let debouncedRenderNotes, debouncedRenderTimeline, debouncedHomeSearch;


function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ============================================================
// TOAST
// ============================================================
let _toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast' + (type ? ' ' + type : '');
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ============================================================
// HOME PAGE
// ============================================================
function showHomePage() {
  state.currentProjectId = null;
  document.getElementById('home-page').classList.remove('hidden');
  document.getElementById('project-page').classList.add('hidden');
  renderProjectCards();
}

function renderProjectCards(searchResults=null) {
  // when called with search results, hide no-projects fallback
  const projects  = searchResults || getProjects();
  const grid      = $('projects-grid');
  const empty     = $('no-projects');

  if (projects.length === 0) {
    grid.innerHTML = '';
    if (!searchResults) empty.classList.remove('hidden');
    else empty.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Sort by updatedAt desc
  const sorted = [...projects].sort((a, b) =>
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  // chunk rendering if there are many projects
  window._projectCache = sorted;
  window._projectOffset = 0;
  grid.innerHTML = '';
  appendProjectCardsChunk();
}

function appendProjectCardsChunk() {
  const grid = $('projects-grid');
  const cache = window._projectCache || [];
  const start = window._projectOffset || 0;
  const chunk = 30;
  if (start >= cache.length) return;
  const slice = cache.slice(start, start + chunk);
  const html = slice.map(p => {
    const chars = getProjectData(p.id, 'personnages').length;
    const chaps = getProjectData(p.id, 'chapitres').length;
    return `
      <div class="project-card" tabindex="0" onkeydown="if(event.key==='Enter')openProject('${p.id}')">
        <div class="project-card-name">${esc(p.name)}</div>
        <div class="project-card-desc">${esc(p.description) || '<span style="color:var(--gray-300)">Aucune description</span>'}</div>
        <div class="project-card-meta">
          <div class="meta-item">👤 <strong>${chars}</strong> personnage${chars !== 1 ? 's' : ''}</div>
          <div class="meta-item">📖 <strong>${chaps}</strong> chapitre${chaps !== 1 ? 's' : ''}</div>
        </div>
        <div class="project-card-date">Modifié le ${fmtDate(p.updatedAt)}</div>
        <div class="project-card-actions">
          <button class="btn btn-primary" onclick="openProject('${p.id}')">Ouvrir</button>
          <button class="btn btn-secondary" onclick="duplicateProject('${p.id}')" title="Dupliquer">📄</button>
          <button class="btn btn-ghost" onclick="confirmDeleteProject('${p.id}', '${esc(p.name)}')">Supprimer</button>
        </div>
      </div>`;
  }).join('');
  grid.insertAdjacentHTML('beforeend', html);
  window._projectOffset = start + chunk;
  if (window._projectOffset < cache.length) {
    setTimeout(appendProjectCardsChunk, 0);
  }
}

// ============================================================
// HOME PAGE SEARCH
// ============================================================
function renderHomeSearch() {
  const q = $('home-search').value.trim().toLowerCase();
  const resultsEl = $('home-search-results');
  if (!resultsEl) return;
  if (!q) {
    resultsEl.classList.add('hidden');
    renderProjectCards();
    return;
  }
  const projects = getProjects().filter(p => {
    return p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q);
  });
  // render dropdown
  let html = '';
  projects.forEach(p=>{
    html += `<div class="result-item" tabindex="0" onclick="openProject('${p.id}')" onkeydown="if(event.key==='Enter')openProject('${p.id}')">${esc(p.name)}</div>`;
  });
  if (!html) html = `<div class="result-item" tabindex="0">Aucun projet trouvé</div>`;
  resultsEl.innerHTML = html;
  resultsEl.classList.remove('hidden');
  // also refresh grid with filtered list
  renderProjectCards(projects);
}

document.addEventListener('click', e=>{
    const res = $('home-search-results');
    res.classList.add('hidden');
});

// ============================================================
// NEW PROJECT MODAL
// ============================================================
function openNewProjectModal() {
  document.getElementById('new-project-name').value = '';
  document.getElementById('new-project-desc').value = '';
  openModal('modal-new-project');
  setTimeout(() => document.getElementById('new-project-name').focus(), 80);
}

function createProject() {
  const name = document.getElementById('new-project-name').value.trim();
  const desc = document.getElementById('new-project-desc').value.trim();
  if (!name) { showToast('Le nom du projet est requis', 'error'); return; }

  const now = new Date().toISOString();
  const p   = { id: uid(), name, description: desc, createdAt: now, updatedAt: now };
  const list = getProjects();
  list.push(p);
  saveProjects(list);
  closeModal('modal-new-project');
  showToast('Projet créé !', 'success');
  openProject(p.id);
}

// ============================================================
// OPEN PROJECT
// ============================================================
function openProject(projectId) {
  const projects = getProjects();
  const project  = projects.find(p => p.id === projectId);
  if (!project) return;

  state.currentProjectId = projectId;

  // ensure schema for existing data (add missing new fields with defaults)
  migrateProjectSchema(projectId);

  document.getElementById('home-page').classList.add('hidden');
  document.getElementById('project-page').classList.remove('hidden');
  document.getElementById('project-name-header').textContent = project.name;

  // Close dropdown if open
  document.getElementById('project-dropdown').classList.add('hidden');

  navigateTo('dashboard');

  // appearance and backup
  const prefs = getProjectPrefs(projectId);
  applyAppearance(prefs);
  checkAutoBackup();
  checkBackupAge(projectId);
  initSeasonalTheme(projectId);
  // render custom sections in sidebar
  if (typeof renderCustomSectionsSidebar === 'function') renderCustomSectionsSidebar();
}

// ============================================================
// CONFIRM DELETE PROJECT (from home page cards)
// ============================================================
function confirmDeleteProject(projectId, projectName) {
  showConfirm(
    `Supprimer le projet ?`,
    `"${projectName}" et toutes ses données seront définitivement supprimés.`,
    () => deleteProject(projectId)
  );
}

// ============================================================
// DELETE PROJECT
// ============================================================
function deleteProject(projectId) {
  let list = getProjects();
  list = list.filter(p => p.id !== projectId);
  saveProjects(list);
  clearProjectData(projectId);
  closeModal('modal-confirm');

  if (state.currentProjectId === projectId) {
    showHomePage();
  } else {
    renderProjectCards();
  }
  showToast('Projet supprimé', 'success');
}

// duplicate a project by copying its data to a new id
function duplicateProject(projectId) {
  const projects = getProjects();
  const p = projects.find(x => x.id === projectId);
  if (!p) return;
  showConfirm('Dupliquer ce projet ?', '', () => {
    const now = new Date().toISOString();
    const newId = uid();
    const newProj = {
      id: newId,
      name: p.name + ' (copie)',
      description: p.description,
      createdAt: now,
      updatedAt: now
    };
    projects.push(newProj);
    saveProjects(projects);
    // copy all data types
    ['personnages','lieux','relations','chapitres','scenes','playlists','events','notes'].forEach(t => {
      const data = getProjectData(projectId, t);
      saveProjectData(newId, t, JSON.parse(JSON.stringify(data)));
    });
    // prefs and custom sections
    const prefs = getProjectPrefs(projectId);
    saveProjectPrefs(newId, JSON.parse(JSON.stringify(prefs)));
    const custom = JSON.parse(localStorage.getItem(`projet_${projectId}_customSections`) || '[]');
    localStorage.setItem(`projet_${newId}_customSections`, JSON.stringify(custom));
    renderProjectCards();
    showToast('Projet dupliqué', 'success');
  });
}

// Called from the "Zone de danger" settings button
function confirmDeleteCurrentProject() {
  const project = getProjects().find(p => p.id === state.currentProjectId);
  if (!project) return;
  confirmDeleteProject(state.currentProjectId, project.name);
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(section) {
  state.currentSection = section;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Show correct section
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${section}`).classList.remove('hidden');

  // Render content
  switch (section) {
    case 'dashboard':    renderDashboard();   break;
    case 'personnages':  renderCharacters();  break;
    case 'lieux':        renderLocations();   break;
    case 'relations':    renderRelations();   break;
    case 'chapitres':    renderChapters(); if (typeof renderChapterTimeline === 'function') renderChapterTimeline(); break;
    case 'scenes':       renderScenes();      break;
    case 'manuscrit':    renderManuscript(); renderManuscriptStats(); break;
    case 'playlists':    renderPlaylists();   break;
    case 'timeline':     renderTimeline();    break;
    case 'notes':        renderNotes();       break;
    case 'parametres':   renderSettings();    break;
    case 'citations':
    case 'journal':
      if (typeof renderFeatureSection === 'function') renderFeatureSection(section);
      break;
  }

  // On mobile, auto-close sidebar
  if (window.innerWidth <= 768) closeSidebarMobile();
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar() {
  if (window.innerWidth <= 768) {
    // Mobile: slide-in overlay
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const isOpen   = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    overlay.classList.toggle('visible', !isOpen);
  } else {
    // Desktop: collapse/expand
    state.sidebarCollapsed = !state.sidebarCollapsed;
    document.getElementById('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    document.querySelector('.main-content').classList.toggle('expanded', state.sidebarCollapsed);
  }
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// ============================================================
// DROPDOWN (project switcher)
// ============================================================
function toggleDropdown() {
  const menu = document.getElementById('project-dropdown');
  if (menu.classList.contains('hidden')) {
    renderDropdown();
    menu.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
  }
}

function renderDropdown() {
  const projects = getProjects();
  const menu     = document.getElementById('project-dropdown');

  const homeRow = `<button class="dropdown-item home-item" onclick="showHomePage()">🏠 Tous les projets</button>`;
  const sep     = `<div class="dropdown-separator"></div>`;
  const rows    = projects
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(p => `
      <button class="dropdown-item ${p.id === state.currentProjectId ? 'active' : ''}"
              onclick="openProject('${p.id}')">
        ${esc(p.name)}
      </button>`).join('');

  menu.innerHTML = homeRow + sep + rows;
}

// ============================================================
// DASHBOARD
// ============================================================
let dashboardChart = null; // global reference for bar overview chart
let relTypesChart = null, chapStatusChart = null, roleChart = null;
function renderDashboard() {
  const id    = state.currentProjectId;
  const chars = getProjectData(id, 'personnages');
  const locs  = getProjectData(id, 'lieux');
  const rels  = getProjectData(id, 'relations');
  const chaps = getProjectData(id, 'chapitres');

  document.getElementById('stat-personnages').textContent = chars.length;
  document.getElementById('stat-lieux').textContent       = locs.length;
  document.getElementById('stat-relations').textContent   = rels.length;
  document.getElementById('stat-chapitres').textContent   = chaps.length;

  // overall counts bar chart (dashboard-chart)
  const barCtx = document.getElementById('dashboard-chart');
  if (barCtx) {
    const scenes = getProjectData(id,'scenes').length;
    const playlists = getProjectData(id,'playlists').length;
    const events  = getProjectData(id,'events').length;
    const notes   = getProjectData(id,'notes').length;
    const labels = ['Persos','Lieux','Relations','Chaps','Scènes','Playlists','Événements','Notes'];
    const data   = [chars.length, locs.length, rels.length, chaps.length, scenes, playlists, events, notes];
    if (!dashboardChart) {
      dashboardChart = new Chart(barCtx.getContext('2d'), {
        type: 'bar', data: { labels, datasets:[{label:'Total', data, backgroundColor:'var(--primary)'}] },
        options:{responsive:true,maintainAspectRatio:false}
      });
    } else {
      dashboardChart.data.labels = labels;
      dashboardChart.data.datasets[0].data = data;
      dashboardChart.update();
    }
  }

  const project = getProjects().find(p => p.id === id);
  const descEl  = document.getElementById('dashboard-desc');
  if (project && project.description) {
    descEl.innerHTML = `
      <div class="dashboard-desc-label">Description du projet</div>
      ${esc(project.description)}`;
    descEl.classList.remove('hidden');
  } else {
    descEl.classList.add('hidden');
  }

  // ---- charts ----
  // rel types pie
  const relTypes = {};
  rels.forEach(r=>{ relTypes[r.type]=(relTypes[r.type]||0)+1; });
  const relCtx = document.getElementById('chart-rel-types').getContext('2d');
  if (!relTypesChart) {
    relTypesChart = new Chart(relCtx, {
      type:'pie', data:{labels:Object.keys(relTypes), datasets:[{data:Object.values(relTypes), backgroundColor:['#2196F3','#E91E63','#FF9800','#9C27B0','#4CAF50','#F44336','gray']}]}
    });
  } else {
    relTypesChart.data.labels = Object.keys(relTypes);
    relTypesChart.data.datasets[0].data = Object.values(relTypes);
    relTypesChart.update();
  }
  // chap status bar
  const chapStatus = {};
  chaps.forEach(c=>{ chapStatus[c.statut]=(chapStatus[c.statut]||0)+1; });
  const chapCtx = document.getElementById('chart-chap-statut').getContext('2d');
  if (!chapStatusChart) {
    chapStatusChart = new Chart(chapCtx, {
      type:'bar', data:{labels:Object.keys(chapStatus), datasets:[{data:Object.values(chapStatus), backgroundColor:'#4CAF50'}]}
    });
  } else {
    chapStatusChart.data.labels = Object.keys(chapStatus);
    chapStatusChart.data.datasets[0].data = Object.values(chapStatus);
    chapStatusChart.update();
  }
  // pers by role
  const roleCount = {};
  chars.forEach(c=>{ roleCount[c.role]=(roleCount[c.role]||0)+1; });
  const roleCtx = document.getElementById('chart-pers-roles').getContext('2d');
  if (!roleChart) {
    roleChart = new Chart(roleCtx, {
      type:'bar', data:{labels:Object.keys(roleCount), datasets:[{data:Object.values(roleCount), backgroundColor:'#2196F3'}]}
    });
  } else {
    roleChart.data.labels = Object.keys(roleCount);
    roleChart.data.datasets[0].data = Object.values(roleCount);
    roleChart.update();
  }

  // network graph
  renderDashboardNetwork();

  // metrics
  renderDashboardMetrics(chars, locs, rels);
}

function renderDashboardNetwork() {
  const rels = getProjectData(state.currentProjectId,'relations');
  const chars = getProjectData(state.currentProjectId,'personnages');
  // build nodes/edges
  const nodes = chars.map(c=>({id:c.id,label:[c.prenom,c.nom].filter(Boolean).join(' ')}));
  const edges = rels.map(r=>({from:r.personA,to:r.personB}));
  const container = document.getElementById('chart-network');
  if (!container) return;
  if (!window.vis) return;
  const data = { nodes:new vis.DataSet(nodes), edges:new vis.DataSet(edges) };
  const options = { physics:{enabled:false}, nodes:{font:{size:10}}, edges:{arrows:{to:{enabled:false}}} };
  new vis.Network(container, data, options);
}

function renderDashboardMetrics(chars, locs, rels) {
  const project = getProjects().find(p => p.id === state.currentProjectId);
  // personnage le plus connecté
  const conn = {};
  rels.forEach(r=>{
    conn[r.personA] = (conn[r.personA]||0)+1;
    conn[r.personB] = (conn[r.personB]||0)+1;
  });
  let topChar='aucun'; let topConn=0;
  Object.entries(conn).forEach(([id,c])=>{ if (c>topConn){topConn=c; topChar=id;} });
  const topCharName = topChar==='aucun'? '—' : getProjectData(state.currentProjectId,'personnages').find(c=>c.id===topChar)?.prenom || topChar;

  // lieu le plus utilisé (by events association)
  const lieuCounts = {};
  getProjectData(state.currentProjectId,'events').forEach(e=>{
    (e.associated||[]).forEach(a=>{ if (a.type==='lieux'){ lieuCounts[a.id]=(lieuCounts[a.id]||0)+1;}});
  });
  let topLieu='—'; let topLieuCount=0;
  Object.entries(lieuCounts).forEach(([id,c])=>{ if(c>topLieuCount){topLieuCount=c; topLieu=id;} });
  const topLieuName = topLieu==='—'? '—' : getProjectData(state.currentProjectId,'lieux').find(l=>l.id===topLieu)?.nom || topLieu;

  // mois le plus dense
  const monthCounts = {};
  getProjectData(state.currentProjectId,'events').forEach(e=>{
    const d = new Date(e.date);
    if (!isNaN(d)) {
      const m = `${d.getFullYear()}-${d.getMonth()+1}`;
      monthCounts[m] = (monthCounts[m]||0)+1;
    }
  });
  let topMonth='—'; let topMonthCount=0;
  Object.entries(monthCounts).forEach(([m,c])=>{ if(c>topMonthCount){topMonthCount=c; topMonth=m;} });

  // avg relations per person
  const avgRel = chars.length ? (rels.length*2)/chars.length : 0;

  // additional metrics from earlier implementation
  // total words in chapters + scenes
  let words = 0;
  const chaptersArr = getProjectData(state.currentProjectId,'chapitres');
  chaptersArr.forEach(c=>{ if (c.contenu) words += wordCount(c.contenu); });
  getProjectData(state.currentProjectId,'scenes').forEach(s=>{ if (s.contenu) words += wordCount(s.contenu); });
  // most mentioned character in text
  let mentionedChar = '';
  let mentionedCount = 0;
  const allText = (chaptersArr.map(c=>c.contenu||'').concat(getProjectData(state.currentProjectId,'scenes').map(s=>s.contenu||'')).join(' ')).toLowerCase();
  getProjectData(state.currentProjectId,'personnages').forEach(c=>{
    const name = [c.prenom,c.nom].filter(Boolean).join(' ').toLowerCase();
    if (name) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'g');
      const cnt = (allText.match(re)||[]).length;
      if (cnt > mentionedCount) { mentionedCount = cnt; mentionedChar = name; }
    }
  });
  // last modified element
  let lastItem = null;
  let lastDate = new Date(0);
  ['personnages','lieux','chapitres','scenes','playlists','events','notes'].forEach(type=>{
    getProjectData(state.currentProjectId,type).forEach(item=>{
      const d = item.updatedAt ? new Date(item.updatedAt) : (item.createdAt? new Date(item.createdAt) : null);
      if (d && d > lastDate) { lastDate = d; lastItem = `${type.slice(0,-1)} "${item.nom||item.titre||item.prenom||''}"`; }
    });
  });
  if (!lastItem) lastItem = project && project.name;
  // progression semaine
  const today = new Date();
  const weekCounts = Array(7).fill(0);
  ['personnages','lieux','chapitres','scenes'].forEach(type=>{
    getProjectData(state.currentProjectId,type).forEach(item=>{
      const d = item.createdAt ? new Date(item.createdAt) : null;
      if (d) {
        const diff = Math.floor((today - d)/(1000*60*60*24));
        if (diff < 7 && diff >= 0) weekCounts[6-diff]++;
      }
    });
  });

  const el = document.getElementById('dashboard-extra-metrics');
  el.innerHTML = `
    <div><strong>Perso le + connecté:</strong> ${esc(topCharName)} (${topConn})</div>
    <div><strong>Lieu le + utilisé:</strong> ${esc(topLieuName)} (${topLieuCount})</div>
    <div><strong>Mois le + dense:</strong> ${esc(topMonth)}</div>
    <div><strong>Relations moy./perso:</strong> ${avgRel.toFixed(2)}</div>
    <hr>
    <div><strong>Mots totaux (chap/scènes):</strong> ${words}</div>
    <div><strong>Perso le + mentionné:</strong> ${esc(mentionedChar || '—')}</div>
    <div><strong>Dernier élément modifié:</strong> ${esc(lastItem)}</div>
    <div><strong>Créations cette semaine:</strong> ${weekCounts.reduce((a,b)=>a+b,0)}</div>`;
  el.classList.remove('hidden');
}

// Convenience alias
function updateStats() { if (state.currentSection === 'dashboard') renderDashboard(); }

// ============================================================
// CHARACTERS
// ============================================================
const CHAR_BADGES = {
  'Protagoniste':  'badge-protagoniste',
  'Love Interest': 'badge-love-interest',
  'Antagoniste':   'badge-antagoniste',
  'Secondaire':    'badge-secondaire',
};

function renderCharacters() {
  const id   = state.currentProjectId;
  const list = getProjectData(id, 'personnages');
  const grid = document.getElementById('personnages-grid');
  const empty = document.getElementById('no-personnages');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = list.map(c => {
    const name   = [c.prenom, c.nom].filter(Boolean).join(' ');
    const badge  = CHAR_BADGES[c.role] || 'badge-secondaire';
    const assoc = getProjectData(state.currentProjectId,'playlists').filter(pl=>
        (pl.associated||[]).some(a=>a.type==='personnages' && a.id===c.id)
      ).map(pl=>`<span class="tag-chip" onclick="navigateTo('playlists');setTimeout(()=>openPlaylistModal('${pl.id}'),200)">${esc(pl.nom)}</span>`).join(' ');
    const media = c.photo
      ? `<div class="item-card-media"><img src="${c.photo}" alt="photo"></div>`
      : `<div class="item-card-media placeholder">👤</div>`;
    return `
      <div class="item-card">
        ${media}
        <div class="item-card-header">
          <div class="item-card-title">${esc(name)}</div>
          <div class="item-card-actions">
            <button class="btn-icon" onclick="openCharacterModal('${c.id}')" title="Modifier">✏️</button>
            <button class="btn-icon" onclick="openVersionHistory('personnage','${c.id}',null)" title="Historique des versions">🕒</button>
            <button class="btn-icon" onclick="deleteCharacterConfirm('${c.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
        <span class="badge ${badge}">${esc(c.role)}</span>
        ${c.age ? `<div class="item-card-meta">Âge : ${esc(String(c.age))} ans</div>` : ''}
        ${c.notes ? `<div class="item-card-notes">${esc(c.notes)}</div>` : ''}
        ${assoc ? `<div class="item-card-meta"><small>Playlists : ${assoc}</small></div>` : ''}
      </div>`;
  }).join('');
}

function initCharacterBackstoryQuill() {
  const container = document.getElementById('char-backstory-editor');
  if (!container) return;
  if (window.charBackstoryQuill) return;
  window.charBackstoryQuill = new Quill(container, {
    theme: 'snow',
    modules: { toolbar: [['bold','italic','underline'], ['link'], [{ 'list': 'bullet' }, { 'list': 'ordered' }]] }
  });
}

function openCharacterModal(charId = null) {
  initCharacterBackstoryQuill();
  state.editingId = charId;
  document.getElementById('modal-character-title').textContent =
    charId ? 'Modifier le personnage' : 'Nouveau personnage';
  // Reset basic + new fields
  ['char-prenom','char-nom','char-notes','char-yeux','char-cheveux','char-taille','char-style','char-detail','char-trait-1','char-trait-2','char-trait-3','char-blessure','char-peur','char-desir','char-arc','char-backstory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('char-age').value  = '';
  document.getElementById('char-role').value = 'Protagoniste';
  // clear quill editor if exists
  if (window.charBackstoryQuill) {
    window.charBackstoryQuill.setContents([]);
  }
  // clear preview
  const cp = document.getElementById('char-photo-preview'); if (cp) cp.innerHTML = '';
  const cpr = document.getElementById('char-photo-remove'); if (cpr) cpr.style.display = 'none';
  const cpi = document.getElementById('char-photo'); if (cpi) { cpi.value = ''; delete cpi.dataset.dataurl; }

  if (charId) {
    const c = getProjectData(state.currentProjectId, 'personnages').find(x => x.id === charId);
    if (c) {
      document.getElementById('char-prenom').value = c.prenom || '';
      document.getElementById('char-nom').value    = c.nom    || '';
      document.getElementById('char-age').value    = c.age    || '';
      document.getElementById('char-role').value   = c.role   || 'Protagoniste';
      document.getElementById('char-notes').value  = c.notes  || '';
      document.getElementById('char-yeux').value = c.yeux || '';
      document.getElementById('char-cheveux').value = c.cheveux || '';
      document.getElementById('char-taille').value = c.taille || '';
      document.getElementById('char-style').value = c.style || '';
      document.getElementById('char-detail').value = c.detailMarquant || '';
      const traits = c.traits || [];
      document.getElementById('char-trait-1').value = traits[0] || '';
      document.getElementById('char-trait-2').value = traits[1] || '';
      document.getElementById('char-trait-3').value = traits[2] || '';
      document.getElementById('char-blessure').value = c.blessure || '';
      document.getElementById('char-peur').value = c.peur || '';
      document.getElementById('char-desir').value = c.desir || '';
      document.getElementById('char-arc').value = c.arc || '';
      // populate quill with rich HTML or fallback
      if (window.charBackstoryQuill) {
        window.charBackstoryQuill.root.innerHTML = c.backstoryHtml || c.backstory || '';
      }
      if (c.photo) {
        const container = document.getElementById('char-photo-preview');
        container.innerHTML = `<div class="item-card-media"><img src="${c.photo}" alt="photo"></div>`;
        document.getElementById('char-photo-remove').style.display = 'inline-block';
      }
    }
  }
  openModal('modal-character');
  setTimeout(() => document.getElementById('char-prenom').focus(), 80);
}

async function saveCharacter() {
  const prenom = document.getElementById('char-prenom').value.trim();
  if (!prenom) { showToast('Le prénom est requis', 'error'); return; }

  // collect fields including new character details
  const photoInput = document.getElementById('char-photo');
  let photoData = photoInput && photoInput.dataset && photoInput.dataset.dataurl ? photoInput.dataset.dataurl : null;
  // if a File object exists, compress it before saving (if needed)
  try {
    if (photoInput && photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      // compress only if larger than 500KB to save space
      if (file.size > 500 * 1024) {
        const compressed = await compressImageFile(file, 800, 600, 0.8);
        // ensure not exceeding 2MB after compression
        const size = Math.round((compressed.length - (compressed.indexOf(',') + 1)) * 3 / 4);
        if (size > 2 * 1024 * 1024) { showToast('Image trop volumineuse après compression', 'error'); return; }
        photoData = compressed;
      } else {
        // small file: read as dataURL
        const small = await compressImageFile(file, 800, 600, 0.92);
        photoData = small;
      }
    }
  } catch (err) {
    showToast('Erreur traitement image', 'error');
    return;
  }

  // gather backstory from quill if available
  let backstoryPlain = '';
  let backstoryHtml = '';
  if (window.charBackstoryQuill) {
    backstoryHtml = window.charBackstoryQuill.root.innerHTML;
    backstoryPlain = window.charBackstoryQuill.getText().trim();
  } else {
    backstoryPlain = document.getElementById('char-backstory') ? document.getElementById('char-backstory').value : '';
  }

  const data = {
    prenom,
    nom:   document.getElementById('char-nom').value.trim(),
    age:   document.getElementById('char-age').value || '',
    role:  document.getElementById('char-role').value,
    notes: document.getElementById('char-notes').value.trim(),
    yeux:  document.getElementById('char-yeux') ? document.getElementById('char-yeux').value.trim() : '',
    cheveux: document.getElementById('char-cheveux') ? document.getElementById('char-cheveux').value.trim() : '',
    taille: document.getElementById('char-taille') ? document.getElementById('char-taille').value.trim() : '',
    style: document.getElementById('char-style') ? document.getElementById('char-style').value.trim() : '',
    detailMarquant: document.getElementById('char-detail') ? document.getElementById('char-detail').value.trim() : '',
    traits: [
      document.getElementById('char-trait-1') ? document.getElementById('char-trait-1').value.trim() : '',
      document.getElementById('char-trait-2') ? document.getElementById('char-trait-2').value.trim() : '',
      document.getElementById('char-trait-3') ? document.getElementById('char-trait-3').value.trim() : ''
    ].filter(Boolean),
    blessure: document.getElementById('char-blessure') ? document.getElementById('char-blessure').value.trim() : '',
    peur: document.getElementById('char-peur') ? document.getElementById('char-peur').value.trim() : '',
    desir: document.getElementById('char-desir') ? document.getElementById('char-desir').value.trim() : '',
    arc: document.getElementById('char-arc') ? document.getElementById('char-arc').value.trim() : '',
    backstory: backstoryPlain,
    backstoryHtml: backstoryHtml
  };

  const id   = state.currentProjectId;
  let   list = getProjectData(id, 'personnages');
  // clear hidden textarea value after saving too
  if (window.charBackstoryQuill) {
    document.getElementById('char-backstory').value = backstoryPlain;
  }

  if (state.editingId) {
    const idx = list.findIndex(c => c.id === state.editingId);
    if (idx !== -1) {
      // preserve existing photo if no new one selected
      if (photoData) data.photo = photoData; else data.photo = list[idx].photo || '';
      list[idx] = { ...list[idx], ...data };
    }
  } else {
    if (photoData) data.photo = photoData; else data.photo = '';
    list.push({ id: uid(), ...data });
  }

  if (state.editingId && typeof snapshotVersion === 'function') {
    const prev = list.find(p => p.id === state.editingId);
    if (prev) snapshotVersion('personnage', state.editingId, prev);
  }
  saveProjectData(id, 'personnages', list);
  touchProject(id);
  closeModal('modal-character');
  renderCharacters();
  showToast(state.editingId ? 'Personnage modifié' : 'Personnage créé', 'success');
  state.editingId = null;
}

function deleteCharacterConfirm(charId) {
  const c = getProjectData(state.currentProjectId, 'personnages').find(x => x.id === charId);
  if (!c) return;
  const name = [c.prenom, c.nom].filter(Boolean).join(' ');
  showConfirm(`Supprimer "${name}" ?`, 'Cette action est irréversible.', () => {
    let list = getProjectData(state.currentProjectId, 'personnages').filter(x => x.id !== charId);
    saveProjectData(state.currentProjectId, 'personnages', list);
    // also remove any relations involving this character
    let rels = getProjectData(state.currentProjectId, 'relations') || [];
    rels = rels.filter(r => r.personA !== charId && r.personB !== charId);
    saveProjectData(state.currentProjectId, 'relations', rels);
    touchProject(state.currentProjectId);
    closeModal('modal-confirm');
    renderCharacters();
    // if currently viewing relations, update that too
    if (state.currentSection === 'relations') renderRelations();
    showToast('Personnage supprimé', 'success');
  });
}

// Image preview & helpers for characters/locations
function previewImageFile(inputEl, previewContainerId, removeBtnId) {
  const file = inputEl.files && inputEl.files[0];
  const container = document.getElementById(previewContainerId);
  const removeBtn = document.getElementById(removeBtnId);
  if (!file) { if (container) container.innerHTML = ''; if (removeBtn) removeBtn.style.display = 'none'; return; }
  if (!file.type.match('image.*')) { showToast('Format d\'image non supporté', 'error'); inputEl.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    if (container) container.innerHTML = `<div class="item-card-media"><img src="${e.target.result}" alt="photo"></div>`;
    if (removeBtn) removeBtn.style.display = 'inline-block';
    // store dataurl on input for save
    try { inputEl.dataset.dataurl = e.target.result; } catch (e) { /* ignore */ }
  };
  reader.readAsDataURL(file);
}

// Compress image file using canvas, returns dataURL (JPEG or original type)
function compressImageFile(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.match('image.*')) return reject(new Error('Invalid image'));
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // choose mimeType: prefer jpeg for smaller size unless original is png/webp
        let mime = 'image/jpeg';
        if (file.type === 'image/png') mime = 'image/png';
        if (file.type === 'image/webp') mime = 'image/webp';
        try {
          const dataURL = canvas.toDataURL(mime, quality);
          resolve(dataURL);
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

function removeCharacterPhoto() {
  const input = document.getElementById('char-photo');
  if (input) { input.value = ''; delete input.dataset.dataurl; }
  const container = document.getElementById('char-photo-preview'); if (container) container.innerHTML = '';
  const btn = document.getElementById('char-photo-remove'); if (btn) btn.style.display = 'none';
}

function removeLocationPhoto() {
  const input = document.getElementById('loc-photo');
  if (input) { input.value = ''; delete input.dataset.dataurl; }
  const container = document.getElementById('loc-photo-preview'); if (container) container.innerHTML = '';
  const btn = document.getElementById('loc-photo-remove'); if (btn) btn.style.display = 'none';
}

// ============================================================
// LOCATIONS
// ============================================================
const LOC_BADGES = {
  'Résidence':  'badge-residence',
  'Commerce':   'badge-commerce',
  'Extérieur':  'badge-exterieur',
  'Nature':     'badge-nature',
};

function renderLocations() {
  const id   = state.currentProjectId;
  const list = getProjectData(id, 'lieux');
  const grid = document.getElementById('lieux-grid');
  const empty = document.getElementById('no-lieux');

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = list.map(l => {
    const badge = LOC_BADGES[l.type] || 'badge-secondaire';
    const assoc = getProjectData(state.currentProjectId,'playlists').filter(pl=>
        (pl.associated||[]).some(a=>a.type==='lieux' && a.id===l.id)
      ).map(pl=>`<span class="tag-chip" onclick="navigateTo('playlists');setTimeout(()=>openPlaylistModal('${pl.id}'),200)">${esc(pl.nom)}</span>`).join(' ');
    const media = l.photo
      ? `<div class="item-card-media"><img src="${l.photo}" alt="photo"></div>`
      : `<div class="item-card-media placeholder">🏠</div>`;
    return `
      <div class="item-card">
        ${media}
        <div class="item-card-header">
          <div class="item-card-title">${esc(l.nom)}</div>
          <div class="item-card-actions">
            <button class="btn-icon" onclick="openLocationModal('${l.id}')" title="Modifier">✏️</button>
            <button class="btn-icon" onclick="deleteLocationConfirm('${l.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
        <span class="badge ${badge}">${esc(l.type)}</span>
        ${l.ville ? `<div class="item-card-meta">📍 ${esc(l.ville)}</div>` : ''}
        ${l.notes ? `<div class="item-card-notes">${esc(l.notes)}</div>` : ''}
        ${assoc ? `<div class="item-card-meta"><small>Playlists : ${assoc}</small></div>` : ''}
      </div>`;
  }).join('');
}

function openLocationModal(locId = null) {
  state.editingId = locId;
  document.getElementById('modal-location-title').textContent =
    locId ? 'Modifier le lieu' : 'Nouveau lieu';
  // reset fields including new ones
  ['loc-nom','loc-ville','loc-notes','loc-desc-visuelle','loc-ambiance','loc-odeurs','loc-sons','loc-temperature','loc-textures','loc-importance','loc-scenes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('loc-type').value = 'Résidence';
  // clear preview
  const lp = document.getElementById('loc-photo-preview'); if (lp) lp.innerHTML = '';
  const lpr = document.getElementById('loc-photo-remove'); if (lpr) lpr.style.display = 'none';
  const lpi = document.getElementById('loc-photo'); if (lpi) { lpi.value = ''; delete lpi.dataset.dataurl; }

  if (locId) {
    const l = getProjectData(state.currentProjectId, 'lieux').find(x => x.id === locId);
    if (l) {
      document.getElementById('loc-nom').value   = l.nom   || '';
      document.getElementById('loc-type').value  = l.type  || 'Résidence';
      document.getElementById('loc-ville').value = l.ville || '';
      document.getElementById('loc-notes').value = l.notes || '';
      document.getElementById('loc-desc-visuelle').value = l.description || '';
      document.getElementById('loc-ambiance').value = l.ambiance || '';
      document.getElementById('loc-odeurs').value = l.odeurs || '';
      document.getElementById('loc-sons').value = l.sons || '';
      document.getElementById('loc-temperature').value = l.temperature || '';
      document.getElementById('loc-textures').value = l.textures || '';
      document.getElementById('loc-importance').value = l.importance || '';
      document.getElementById('loc-scenes').value = l.scenes || '';
      if (l.photo) {
        const container = document.getElementById('loc-photo-preview');
        container.innerHTML = `<div class="item-card-media"><img src="${l.photo}" alt="photo"></div>`;
        document.getElementById('loc-photo-remove').style.display = 'inline-block';
      }
    }
  }
  openModal('modal-location');
  setTimeout(() => document.getElementById('loc-nom').focus(), 80);
}

async function saveLocation() {
  const nom = document.getElementById('loc-nom').value.trim();
  if (!nom) { showToast('Le nom du lieu est requis', 'error'); return; }
  const photoInput = document.getElementById('loc-photo');
  let photoData = photoInput && photoInput.dataset && photoInput.dataset.dataurl ? photoInput.dataset.dataurl : null;
  try {
    if (photoInput && photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      if (file.size > 500 * 1024) {
        const compressed = await compressImageFile(file, 800, 600, 0.8);
        const size = Math.round((compressed.length - (compressed.indexOf(',') + 1)) * 3 / 4);
        if (size > 2 * 1024 * 1024) { showToast('Image trop volumineuse après compression', 'error'); return; }
        photoData = compressed;
      } else {
        const small = await compressImageFile(file, 800, 600, 0.92);
        photoData = small;
      }
    }
  } catch (err) { showToast('Erreur traitement image', 'error'); return; }

  const data = {
    nom,
    type:  document.getElementById('loc-type').value,
    ville: document.getElementById('loc-ville').value.trim(),
    notes: document.getElementById('loc-notes').value.trim(),
    description: document.getElementById('loc-desc-visuelle') ? document.getElementById('loc-desc-visuelle').value.trim() : '',
    ambiance: document.getElementById('loc-ambiance') ? document.getElementById('loc-ambiance').value.trim() : '',
    odeurs: document.getElementById('loc-odeurs') ? document.getElementById('loc-odeurs').value.trim() : '',
    sons: document.getElementById('loc-sons') ? document.getElementById('loc-sons').value.trim() : '',
    temperature: document.getElementById('loc-temperature') ? document.getElementById('loc-temperature').value.trim() : '',
    textures: document.getElementById('loc-textures') ? document.getElementById('loc-textures').value.trim() : '',
    importance: document.getElementById('loc-importance') ? document.getElementById('loc-importance').value.trim() : '',
    scenes: document.getElementById('loc-scenes') ? document.getElementById('loc-scenes').value.trim() : ''
  };

  const id   = state.currentProjectId;
  let   list = getProjectData(id, 'lieux');

  if (state.editingId) {
    const idx = list.findIndex(l => l.id === state.editingId);
    if (idx !== -1) {
      if (photoData) data.photo = photoData; else data.photo = list[idx].photo || '';
      list[idx] = { ...list[idx], ...data };
    }
  } else {
    list.push({ id: uid(), ...data });
  }

  saveProjectData(id, 'lieux', list);
  touchProject(id);
  closeModal('modal-location');
  renderLocations();
  showToast(state.editingId ? 'Lieu modifié' : 'Lieu créé', 'success');
  state.editingId = null;
}

function deleteLocationConfirm(locId) {
  const l = getProjectData(state.currentProjectId, 'lieux').find(x => x.id === locId);
  if (!l) return;
  showConfirm(`Supprimer "${l.nom}" ?`, 'Cette action est irréversible.', () => {
    let list = getProjectData(state.currentProjectId, 'lieux').filter(x => x.id !== locId);
    saveProjectData(state.currentProjectId, 'lieux', list);
    touchProject(state.currentProjectId);
    closeModal('modal-confirm');
    renderLocations();
    showToast('Lieu supprimé', 'success');
  });
}

// ============================================================
// RELATIONS
// ============================================================
function renderRelations() {
  const id = state.currentProjectId;
  let list = getProjectData(id, 'relations') || [];
  const filter = document.getElementById('relations-filter')?.value;
  if (filter) {
    list = list.filter(r => r.type === filter);
  }
  const graphEl = document.getElementById('relations-graph');
  const listEl  = document.getElementById('relations-list');
  const noEl    = document.getElementById('no-relations');

  if (list.length === 0) {
    if (listEl) listEl.innerHTML = '';
    if (graphEl) graphEl.innerHTML = '';
    if (noEl) noEl.classList.remove('hidden');
    return;
  }
  if (noEl) noEl.classList.add('hidden');

  if (state.relationsView === 'graph') {
    if (listEl) listEl.style.display = 'none';
    if (graphEl) { graphEl.style.display = ''; renderRelationsGraph(list); }
  } else if (state.relationsView === 'matrix') {
    if (graphEl) graphEl.style.display = 'none';
    if (listEl) listEl.style.display = ''; renderRelationsMatrix(list);
  } else {
    if (graphEl) graphEl.style.display = 'none';
    if (listEl) { listEl.style.display = ''; renderRelationsList(list); }
  }
}

function renderRelationsList(list) {
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const el = document.getElementById('relations-list');
  if (!el) return;
  el.innerHTML = list.map(r => {
    const a = chars.find(c => c.id === r.personA);
    const b = chars.find(c => c.id === r.personB);
    const nameA = a ? [a.prenom, a.nom].filter(Boolean).join(' ') : '[?]';
    const nameB = b ? [b.prenom, b.nom].filter(Boolean).join(' ') : '[?]';
    return `
      <div class="relation-item" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--gray-200)">
        <div>
          <strong>${esc(nameA)} ↔ ${esc(nameB)}</strong>
          ${r.type ? `<span class="badge" style="margin-left:6px">${esc(r.type)}</span>` : ''}
        </div>
        <div class="item-card-actions">
          <button class="btn-icon" onclick="openRelationModal('${r.id}')" title="Modifier">✏️</button>
          <button class="btn-icon" onclick="deleteRelationConfirm('${r.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function renderRelationsGraph(list) {
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const nodes = chars.map(c => ({ id: c.id, label: [c.prenom, c.nom].filter(Boolean).join(' ') }));
  const edges = list.map(r => ({ from: r.personA, to: r.personB, label: r.type || '', arrows: '', color: { color: '#666' } }));
  const container = document.getElementById('relations-graph');
  if (!container) return;
  if (!window.vis) { container.innerHTML = '<p style="padding:16px;color:var(--gray-400)">Chargement du graphe…</p>'; return; }
  container.innerHTML = '';
  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  const options = { physics: { enabled: true }, nodes: { shape: 'dot', size: 20 } };
  new vis.Network(container, data, options);
}

function renderRelationsMatrix(list) {
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const el = document.getElementById('relations-list');
  if (!el || chars.length === 0) { if (el) el.innerHTML = '<em>Aucun personnage.</em>'; return; }

  // Build lookup: "idA|idB" -> relation
  const relMap = {};
  list.forEach(r => {
    relMap[r.personA + '|' + r.personB] = r;
    relMap[r.personB + '|' + r.personA] = r;
  });

  const TYPE_COLORS = {
    'Amour/Romance':    '#ec4899',
    'Amitié':           '#22c55e',
    'Famille':          '#f59e0b',
    'Conflit/Ennemis':  '#ef4444',
    'Professionnel':    '#6366f1',
    'Mentor/Élève':     '#06b6d4',
    'Autre':            '#94a3b8',
  };

  const getName = c => (c.prenom || '') + (c.nom ? ' ' + c.nom : '');

  // Header row
  const headerCells = chars.map(c =>
    `<th title="${esc(getName(c))}" style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;padding:4px 6px;writing-mode:vertical-rl;transform:rotate(180deg);height:80px">${esc(getName(c))}</th>`
  ).join('');

  const rows = chars.map(cA => {
    const cells = chars.map(cB => {
      if (cA.id === cB.id) return `<td style="background:var(--gray-100);"></td>`;
      const r = relMap[cA.id + '|' + cB.id];
      if (!r) return `<td style=""></td>`;
      const color = TYPE_COLORS[r.type] || TYPE_COLORS['Autre'];
      return `<td title="${esc(r.type)}" style="background:${color};opacity:0.75;cursor:pointer"
                  onclick="openRelationModal('${r.id}')"></td>`;
    }).join('');
    return `<tr>
      <th style="text-align:right;font-size:11px;white-space:nowrap;padding:4px 6px;font-weight:500">${esc(getName(cA))}</th>
      ${cells}
    </tr>`;
  }).join('');

  // Legend
  const legend = Object.entries(TYPE_COLORS).map(([type, color]) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:12px">
      <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px"></span>${esc(type)}
    </span>`
  ).join('');

  el.innerHTML = `
    <div style="overflow:auto;margin-bottom:16px">
      <table style="border-collapse:collapse;table-layout:fixed">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:8px;flex-wrap:wrap;display:flex">${legend}</div>`;
}

function openRelationModal(relId = null) {
  state.editingId = relId;
  document.getElementById('modal-relation-title').textContent = relId ? 'Modifier la relation' : 'Nouvelle relation';
  ['rel-description','rel-evolution','rel-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('rel-intensite').value = 3;
  document.getElementById('rel-statut').value = 'Actuelle';
  // populate character selects
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const options = chars.map(c => `<option value="${c.id}">${esc([c.prenom, c.nom].filter(Boolean).join(' '))}</option>`).join('');
  const selA = document.getElementById('rel-personA');
  const selB = document.getElementById('rel-personB');
  if (selA) selA.innerHTML = options;
  if (selB) selB.innerHTML = options;

  if (relId) {
    const r = getProjectData(state.currentProjectId, 'relations').find(x => x.id === relId);
    if (r) {
      if (selA) selA.value = r.personA;
      if (selB) selB.value = r.personB;
      document.getElementById('rel-type').value = r.type || '';
      document.getElementById('rel-intensite').value = r.intensite || 3;
      document.getElementById('rel-description').value = r.description || '';
      document.getElementById('rel-evolution').value = r.evolution || '';
      document.getElementById('rel-statut').value = r.statut || 'Actuelle';
      document.getElementById('rel-notes').value = r.notes || '';
    }
  }
  openModal('modal-relation');
}

function saveRelation() {
  const personA = document.getElementById('rel-personA').value;
  const personB = document.getElementById('rel-personB').value;
  if (!personA || !personB) { showToast('Les deux personnages sont requis', 'error'); return; }
  if (personA === personB) { showToast('Une relation doit impliquer deux personnages distincts', 'error'); return; }
  const data = {
    personA,
    personB,
    type: document.getElementById('rel-type').value,
    intensite: parseInt(document.getElementById('rel-intensite').value) || 1,
    description: document.getElementById('rel-description').value.trim(),
    evolution: document.getElementById('rel-evolution').value.trim(),
    statut: document.getElementById('rel-statut').value,
    notes: document.getElementById('rel-notes').value.trim()
  };
  const id = state.currentProjectId;
  let list = getProjectData(id, 'relations');
  if (state.editingId) {
    const idx = list.findIndex(r => r.id === state.editingId);
    if (idx !== -1) list[idx] = { ...list[idx], ...data };
  } else {
    list.push({ id: uid(), ...data });
  }
  saveProjectData(id, 'relations', list);
  touchProject(id);
  closeModal('modal-relation');
  renderRelations();
  showToast(state.editingId ? 'Relation modifiée' : 'Relation créée', 'success');
  state.editingId = null;
}

function deleteRelationConfirm(relId) {
  const r = getProjectData(state.currentProjectId, 'relations').find(x => x.id === relId);
  if (!r) return;
  showConfirm('Supprimer cette relation ?', 'Cette action est irréversible', () => {
    let list = getProjectData(state.currentProjectId, 'relations').filter(x => x.id !== relId);
    saveProjectData(state.currentProjectId, 'relations', list);
    touchProject(state.currentProjectId);
    renderRelations();
    closeModal('modal-confirm');
    showToast('Relation supprimée', 'success');
  });
}

// ============================================================
// CHAPTERS
// ============================================================
function renderChapters() {
  const id   = state.currentProjectId;
  let   list = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);
  const el   = document.getElementById('chapitres-list');
  const empty = document.getElementById('no-chapitres');

  if (list.length === 0) {
    el.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const STATUS_CLS = { 'Terminé': 'badge-termine', 'En cours': 'badge-en-cours', 'À réviser': 'badge-brouillon', 'Brouillon': 'badge-brouillon' };
  el.innerHTML = list.map(c => {
    const wc = c.contenu ? wordCount(c.contenu) : 0;
    const statusBadge = c.statut
      ? `<span class="badge ${STATUS_CLS[c.statut] || 'badge-brouillon'}" style="margin-bottom:0">${esc(c.statut)}</span>`
      : '';
    const wcBadge = wc > 0
      ? `<span style="font-size:12px;color:var(--gray-400)">${wc.toLocaleString('fr-FR')} mot${wc !== 1 ? 's' : ''}</span>`
      : '';
    const estimateBadge = c.wordEstimate && c.wordEstimate > 0
      ? `<span style="font-size:12px;color:var(--gray-400)">${c.wordEstimate.toLocaleString('fr-FR')} mots estimés</span>`
      : '';
    return `
    <div class="chapter-item">
      <div class="chapter-num">${c.numero}</div>
      <div class="chapter-body">
        <div class="chapter-title">${esc(c.titre)}</div>
        ${c.pov ? `<div class="chapter-meta" style="font-size:12px;color:var(--gray-500);margin-top:3px">POV : ${esc((getProjectData(state.currentProjectId,'personnages').find(p=>p.id===c.pov)||{}).prenom || '')}</div>` : ''}
        ${(statusBadge || wcBadge || estimateBadge) ? `<div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap">${statusBadge}${wcBadge}${estimateBadge}</div>` : ''}
        ${c.resume ? `<div class="chapter-notes" style="margin-top:3px"><em>${esc(c.resume)}</em></div>` : ''}
        ${c.notes ? `<div class="chapter-notes" style="margin-top:3px">${esc(c.notes)}</div>` : ''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="openChapterEditor('${c.id}')" style="flex-shrink:0">✍ Écrire</button>
      <div class="chapter-actions">
        <button class="btn-icon" onclick="openChapterModal('${c.id}')" title="Modifier">✏️</button>
        <button class="btn-icon" onclick="openConvertChapterModal('${c.id}')" title="Convertir en scènes">✂️</button>
        <button class="btn-icon" onclick="openContinuousView('${c.id}')" title="Vue continue">👁️</button>
        <button class="btn-icon" onclick="openVersionHistory('chapitre','${c.id}', null)" title="Historique">🕒</button>
        <button class="btn-icon" onclick="deleteChapterConfirm('${c.id}')" title="Supprimer">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function openChapterModal(chapId = null) {
  state.editingId = chapId;
  document.getElementById('modal-chapter-title').textContent =
    chapId ? 'Modifier le chapitre' : 'Nouveau chapitre';

  // reset fields
  document.getElementById('chap-numero').value = '';
  document.getElementById('chap-titre').value  = '';
  document.getElementById('chap-notes').value  = '';
  document.getElementById('chap-resume').value = '';
  document.getElementById('chap-word-estimate').value = '';
  document.getElementById('chap-pov').innerHTML = ''; // will populate below
  document.getElementById('chap-statut').value = 'Brouillon';

  // build POV options from characters
  const chars = getProjectData(state.currentProjectId, 'personnages');
  const povSel = document.getElementById('chap-pov');
  povSel.innerHTML = '<option value="">— Aucun —</option>' +
    chars.map(c => { const name=[c.prenom,c.nom].filter(Boolean).join(' '); return `<option value="${c.id}">${esc(name)}</option>`; }).join('');

  if (chapId) {
    const c = getProjectData(state.currentProjectId, 'chapitres').find(x => x.id === chapId);
    if (c) {
      document.getElementById('chap-numero').value = c.numero || '';
      document.getElementById('chap-titre').value  = c.titre  || '';
      document.getElementById('chap-notes').value  = c.notes  || '';
      document.getElementById('chap-resume').value = c.resume || '';
      document.getElementById('chap-word-estimate').value = c.wordEstimate || '';
      document.getElementById('chap-pov').value = c.pov || '';
      document.getElementById('chap-statut').value = c.statut || 'Brouillon';
      if (document.getElementById('chap-heure-debut')) document.getElementById('chap-heure-debut').value = c.heureDebut || '';
      if (document.getElementById('chap-heure-fin'))   document.getElementById('chap-heure-fin').value   = c.heureFin   || '';
      if (typeof updateChapterDuration === 'function') updateChapterDuration();
    }
  } else {
    // Auto-suggest next number
    const list   = getProjectData(state.currentProjectId, 'chapitres');
    const maxNum = list.reduce((m, c) => Math.max(m, c.numero || 0), 0);
    document.getElementById('chap-numero').value = maxNum + 1;
  }

  openModal('modal-chapter');
  setTimeout(() => document.getElementById('chap-titre').focus(), 80);
}

function saveChapter() {
  const numero = parseInt(document.getElementById('chap-numero').value, 10);
  const titre  = document.getElementById('chap-titre').value.trim();

  if (!numero || numero < 1) { showToast('Le numéro de chapitre est requis', 'error'); return; }
  if (!titre)                 { showToast('Le titre est requis', 'error'); return; }

  const data = {
    numero,
    titre,
    notes: document.getElementById('chap-notes').value.trim(),
    resume: document.getElementById('chap-resume') ? document.getElementById('chap-resume').value.trim() : '',
    wordEstimate: parseInt(document.getElementById('chap-word-estimate').value,10) || 0,
    pov: document.getElementById('chap-pov') ? document.getElementById('chap-pov').value : '',
    statut: document.getElementById('chap-statut') ? document.getElementById('chap-statut').value : '',
    heureDebut: document.getElementById('chap-heure-debut')?.value || '',
    heureFin:   document.getElementById('chap-heure-fin')?.value  || '',
  };

  const id   = state.currentProjectId;
  let   list = getProjectData(id, 'chapitres');

  if (state.editingId) {
    const idx = list.findIndex(c => c.id === state.editingId);
    if (idx !== -1) {
      if (typeof snapshotVersion === 'function') snapshotVersion('chapitre', state.editingId, list[idx]);
      list[idx] = { ...list[idx], ...data };
    }
  } else {
    list.push({ id: uid(), ...data });
  }

  saveProjectData(id, 'chapitres', list);
  touchProject(id);
  closeModal('modal-chapter');
  renderChapters();
  if (state.currentSection === 'manuscrit') renderManuscript();
  showToast(state.editingId ? 'Chapitre modifié' : 'Chapitre créé', 'success');
  state.editingId = null;
}

function deleteChapterConfirm(chapId) {
  const c = getProjectData(state.currentProjectId, 'chapitres').find(x => x.id === chapId);
  if (!c) return;
  showConfirm(
    `Supprimer le chapitre ${c.numero} ?`,
    `"${c.titre}" sera définitivement supprimé.`,
    () => {
      let list = getProjectData(state.currentProjectId, 'chapitres').filter(x => x.id !== chapId);
      saveProjectData(state.currentProjectId, 'chapitres', list);
      touchProject(state.currentProjectId);
      closeModal('modal-confirm');
      renderChapters();
      if (state.currentSection === 'manuscrit') renderManuscript();
      showToast('Chapitre supprimé', 'success');
    }
  );
}

// ============================================================
// SETTINGS
// ============================================================
function renderSettings() {
  const project = getProjects().find(p => p.id === state.currentProjectId);
  if (!project) return;
  document.getElementById('settings-project-name').value = project.name;
  document.getElementById('settings-project-desc').value = project.description || '';
  // appearance prefs
  const prefs = getProjectPrefs(state.currentProjectId) || {};
  // mode
  const mode = prefs.appearance || 'auto';
  const modeEl = document.querySelector(`input[name=\"appearance\"][value=\"${mode}\"]`);
  if (modeEl) modeEl.checked = true;
  // accent
  if (prefs.accent) document.getElementById('appearance-accent').value = prefs.accent;
  // density
  const density = prefs.density || 'comfortable';
  const denEl = document.querySelector(`input[name=\"density\"][value=\"${density}\"]`);
  if (denEl) denEl.checked = true;
  // font size
  const fs = prefs.fontSize || 'md';
  const fsEl = document.querySelector(`input[name=\"fontSize\"][value=\"${fs}\"]`);
  if (fsEl) fsEl.checked = true;
  // render accent presets
  const presets = ['#6366F1','#E11D48','#059669','#F59E0B','#10B981','#7C3AED','#EF4444'];
  const presetContainer = document.getElementById('accent-presets');
  if (presetContainer) {
    presetContainer.innerHTML = '';
    presets.forEach(c => {
      const b = document.createElement('button');
      b.className = 'btn-icon';
      b.style.background = c;
      b.title = c;
      b.onclick = () => { document.getElementById('appearance-accent').value = c; saveAppearanceSettings(); };
      presetContainer.appendChild(b);
    });
  }
}

function saveProjectSettings() {
  const name = document.getElementById('settings-project-name').value.trim();
  const desc = document.getElementById('settings-project-desc').value.trim();
  if (!name) { showToast('Le nom du projet est requis', 'error'); return; }

  const list  = getProjects();
  const idx   = list.findIndex(p => p.id === state.currentProjectId);
  if (idx !== -1) {
    list[idx].name        = name;
    list[idx].description = desc;
    list[idx].updatedAt   = new Date().toISOString();
    saveProjects(list);
  }

  document.getElementById('project-name-header').textContent = name;
  showToast('Paramètres enregistrés', 'success');
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
function exportProject() {
  const id      = state.currentProjectId;
  const project = getProjects().find(p => p.id === id);
  if (!project) return;

  const payload = {
    version:      '1.0',
    exportedAt:   new Date().toISOString(),
    project,
    personnages:  getProjectData(id, 'personnages'),
    lieux:        getProjectData(id, 'lieux'),
    relations:    getProjectData(id, 'relations'),
    chapitres:    getProjectData(id, 'chapitres'),
    scenes:       getProjectData(id, 'scenes'),
    playlists:    getProjectData(id, 'playlists'),
    events:       getProjectData(id, 'events'),
    notes:        getProjectData(id, 'notes'),
    customSections: JSON.parse(localStorage.getItem(`projet_${id}_customSections`) || '[]'),
    prefs:        getProjectPrefs(id),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `worldbuilder_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Projet exporté', 'success');
}

// export project as Markdown summary
function exportMarkdown() {
  const id = state.currentProjectId;
  const project = getProjects().find(p=>p.id===id);
  if (!project) return;

  const chars = getProjectData(id,'personnages');
  const lieux = getProjectData(id,'lieux');
  const chaps = getProjectData(id,'chapitres');
  const scenes = getProjectData(id,'scenes');
  const rels = getProjectData(id,'relations');
  const events = getProjectData(id,'events');

  let md = `# ${project.name}\n\n`;
  if (project.description) md += `${project.description}\n\n`;

  md += `## Personnages (${chars.length})\n\n`;
  chars.forEach(c=>{
    const name = [c.prenom,c.nom].filter(Boolean).join(' ') || c.id;
    md += `- **${name}**`;
    const meta = [];
    if (c.role) meta.push(c.role);
    if (c.age) meta.push(`Âge: ${c.age}`);
    if (meta.length) md += ` — ${meta.join(' • ')}`;
    md += `\n`;
    if (c.notes) md += `  \n  ${c.notes.split('\n').slice(0,3).join(' ')}\n`;
  });
  md += `\n`;

  md += `## Lieux (${lieux.length})\n\n`;
  lieux.forEach(l=>{
    md += `- **${l.nom||l.titre||l.id}**`;
    if (l.description) md += ` — ${l.description.split('\n').slice(0,2).join(' ')}`;
    md += `\n`;
  });
  md += `\n`;

  md += `## Chapitres (${chaps.length})\n\n`;
  chaps.forEach(ch=>{
    md += `- **${ch.titre||ch.nom||ch.id}**`;
    if (ch.resume) md += ` — ${ch.resume}`;
    else if (ch.contenu) md += ` — ${ch.contenu.replace(/\n+/g,' ').slice(0,120)}...`;
    md += `\n`;
  });
  md += `\n`;

  if (scenes && scenes.length) {
    md += `## Scènes (${scenes.length})\n\n`;
    scenes.forEach(s=>{
      md += `- **${s.titre||s.nom||s.id}**`;
      if (s.chapitre) md += ` — Chapitre: ${s.chapitre}`;
      if (s.contenu) md += `\n  ${s.contenu.replace(/\n+/g,' ').slice(0,120)}...\n`;
    });
    md += `\n`;
  }

  if (rels && rels.length) {
    md += `## Relations (${rels.length})\n\n`;
    rels.forEach(r=>{
      const a = getProjectData(id,'personnages').find(x=>x.id===r.personA);
      const b = getProjectData(id,'personnages').find(x=>x.id===r.personB);
      const an = a ? [a.prenom,a.nom].filter(Boolean).join(' ') : r.personA;
      const bn = b ? [b.prenom,b.nom].filter(Boolean).join(' ') : r.personB;
      md += `- ${an} ⇄ ${bn}` + (r.type ? ` — ${r.type}` : '') + `\n`;
    });
    md += `\n`;
  }

  if (events && events.length) {
    md += `## Timeline (${events.length})\n\n`;
    const sorted = [...events].sort((a,b)=>new Date(a.date)-new Date(b.date));
    sorted.forEach(e=>{
      md += `- **${e.titre||e.nom||e.id}**`;
      if (e.date) md += ` — ${e.date}`;
      if (e.desc) md += `\n  ${e.desc.replace(/\n+/g,' ').slice(0,140)}...`;
      md += `\n`;
    });
    md += `\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `worldbuilder_${project.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// export a collection as CSV
function exportCsv(type) {
  const id = state.currentProjectId;
  const project = getProjects().find(p=>p.id===id);
  if (!project) return;
  const data = getProjectData(id, type);
  if (!data || !data.length) { showToast('Aucune donnée à exporter', 'error'); return; }

  let headers = [];
  if (type === 'personnages') {
    headers = ['prenom','nom','age','role','yeux','cheveux','taille','notes'];
  } else {
    // collect keys from all objects
    const keySet = new Set();
    data.forEach(d=> Object.keys(d||{}).forEach(k=> keySet.add(k)));
    headers = Array.from(keySet);
  }

  const escCsv = v => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g,'""')}"`;
  };

  const rows = [headers.map(h=>escCsv(h)).join(',')];
  data.forEach(item => {
    const row = headers.map(h => escCsv(item[h]));
    rows.push(row.join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `worldbuilder_${project.name.replace(/\s+/g,'_')}_${type}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importProject(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.project || typeof data.project !== 'object') {
        showToast('Fichier invalide ou format inconnu', 'error');
        return;
      }

      const now      = new Date().toISOString();
      const newId    = uid();
      const newProj  = {
        id:          newId,
        name:        (data.project.name || 'Projet importé') + ' (copie)',
        description: data.project.description || '',
        createdAt:   now,
        updatedAt:   now,
      };

      const list = getProjects();
      list.push(newProj);
      saveProjects(list);

      if (Array.isArray(data.personnages)) saveProjectData(newId, 'personnages', data.personnages);
      if (Array.isArray(data.lieux))       saveProjectData(newId, 'lieux',       data.lieux);
      if (Array.isArray(data.relations))   saveProjectData(newId, 'relations',   data.relations);
      if (Array.isArray(data.chapitres))   saveProjectData(newId, 'chapitres',   data.chapitres);
      if (Array.isArray(data.scenes))      saveProjectData(newId, 'scenes',      data.scenes);
      if (Array.isArray(data.playlists))   saveProjectData(newId, 'playlists',   data.playlists);
      if (Array.isArray(data.events))      saveProjectData(newId, 'events',      data.events);
      if (Array.isArray(data.notes))       saveProjectData(newId, 'notes',       data.notes);
      if (Array.isArray(data.customSections)) localStorage.setItem(`projet_${newId}_customSections`, JSON.stringify(data.customSections));
      if (data.prefs && typeof data.prefs === 'object') saveProjectPrefs(newId, data.prefs);

      showToast(`Projet "${newProj.name}" importé`, 'success');
      openProject(newId);
    } catch {
      showToast('Erreur lors de la lecture du fichier', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ============================================================
// MANUSCRIPT / EXPORT HELPERS
// ============================================================

function getManuscript(projectId) {
  return JSON.parse(localStorage.getItem(`projet_${projectId}_manuscrit`) || '{}');
}
function saveManuscript(projectId, data) {
  localStorage.setItem(`projet_${projectId}_manuscrit`, JSON.stringify(data));
}
function initializeManuscript(projectId) {
  let m = getManuscript(projectId);
  if (!m || typeof m !== 'object' || !Array.isArray(m.parts)) {
    m = { prologue: '', parts: [], epilogue: '' };
    saveManuscript(projectId, m);
  }
  return m;
}

// Migration helper: add new fields with sensible defaults without overwriting existing data
function migrateProjectSchema(projectId) {
  if (!projectId) return;
  // personnages
  let pers = getProjectData(projectId, 'personnages') || [];
  let pChanged = false;
  pers = pers.map(p => {
    const np = Object.assign({
      photo: '', yeux: '', cheveux: '', taille: '', style: '', detailMarquant: '',
      traits: [], blessure: '', peur: '', desir: '', arc: '', backstory: '', backstoryHtml: ''
    }, p || {});
    if (!Array.isArray(np.traits)) np.traits = [];
    if (JSON.stringify(np) !== JSON.stringify(p)) pChanged = true;
    return np;
  });
  if (pChanged) saveProjectData(projectId, 'personnages', pers);

  // lieux
  let locs = getProjectData(projectId, 'lieux') || [];
  let lChanged = false;
  locs = locs.map(l => {
    const nl = Object.assign({
      photo: '', description: '', ambiance: '', odeurs: '', sons: '', temperature: '', textures: '', importance: '', scenes: ''
    }, l || {});
    if (JSON.stringify(nl) !== JSON.stringify(l)) lChanged = true;
    return nl;
  });
  if (lChanged) saveProjectData(projectId, 'lieux', locs);

  // chapitres: add résumé and wordEstimate defaults
  let ch = getProjectData(projectId, 'chapitres') || [];
  let cChanged = false;
  ch = ch.map(c => {
    const nc = Object.assign({ resume: '', wordEstimate: 0, pov: c && c.pov ? c.pov : '', statut: c && c.statut ? c.statut : '' }, c || {});
    if (JSON.stringify(nc) !== JSON.stringify(c)) cChanged = true;
    return nc;
  });
  if (cChanged) saveProjectData(projectId, 'chapitres', ch);

  // relations: ensure array exists and consistent structure
  let rels = getProjectData(projectId, 'relations') || [];
  let rChanged = false;
  rels = rels.map(r => {
    const nr = Object.assign({ personA:'', personB:'', type:'', intensite:3, description:'', evolution:'', statut:'Actuelle', notes:'' }, r || {});
    if (JSON.stringify(nr) !== JSON.stringify(r)) rChanged = true;
    return nr;
  });
  if (rChanged) saveProjectData(projectId, 'relations', rels);

  // events: add importance default and ensure fields exist
  let evs = getProjectData(projectId, 'events') || [];
  let eChanged = false;
  evs = evs.map(e => {
    const ne = Object.assign({ date:'', titre:'', desc:'', type:'Rencontre', importance:3, associated:[] }, e || {});
    if (!Array.isArray(ne.associated)) ne.associated = [];
    if (JSON.stringify(ne) !== JSON.stringify(e)) eChanged = true;
    return ne;
  });
  if (eChanged) saveProjectData(projectId, 'events', evs);

  // end migration helper
}

function renderManuscript() {
  const id = state.currentProjectId;
  if (!id) return;
  const m = initializeManuscript(id);
  const chapters = getProjectData(id, 'chapitres').sort((a, b) => a.numero - b.numero);

  // remove any references to deleted chapters
  m.parts.forEach(p => {
    p.chapitres = (p.chapitres||[]).filter(cid => chapters.some(c=>c.id===cid));
  });
  saveManuscript(id,m);

  // unassigned chapters list
  const assigned = new Set();
  m.parts.forEach(p => (p.chapitres || []).forEach(c => assigned.add(c)));
  const unassigned = chapters.filter(c => !assigned.has(c.id));

  const listEl = document.getElementById('manuscript-chapters-list');
  listEl.innerHTML = unassigned.map(c =>
    `<div class="chapter-item" draggable="true" ondragstart="onManuscriptDragStart(event,'${c.id}')">${esc('Ch. '+c.numero+' – '+c.titre)}</div>`
  ).join('') || '<em>Aucun chapitre disponible</em>';

  const structEl = document.getElementById('manuscript-structure');
  structEl.innerHTML = '';

  // prologue
  structEl.appendChild(createTextSection('prologue','Prologue', m.prologue, value => { m.prologue=value; saveManuscript(id,m); }));

  m.parts.forEach(part => {
    const partEl = document.createElement('div');
    partEl.className = 'manuscript-part';
    partEl.dataset.partId = part.id;
    partEl.innerHTML = `
      <div class="part-header">
        <input type="text" class="form-control part-title" value="${esc(part.titre)}"
               oninput="updatePartTitle('${part.id}', this.value)" placeholder="Titre de la partie…">
        <button class="btn btn-icon" title="Supprimer partie" onclick="removePart('${part.id}')">🗑️</button>
      </div>
      <div class="part-drop-zone" ondragover="onManuscriptDragOver(event)"
           ondragleave="onManuscriptDragLeave(event)"
           ondrop="onManuscriptDrop(event,'${part.id}')">
        ${ (part.chapitres||[]).map(cid => {
            const c = chapters.find(x=>x.id===cid);
            return c ? `<div class="chapter-item" draggable="true" 
                   ondragstart="onManuscriptDragStart(event,'${cid}')"
                   data-chapter-id="${cid}">${esc('Ch. '+c.numero+' – '+c.titre)}</div>` : '';
          }).join('') }
      </div>`;
    structEl.appendChild(partEl);
  });

  structEl.appendChild(createTextSection('epilogue','Épilogue', m.epilogue, value => { m.epilogue=value; saveManuscript(id,m); }));

  updateManuscriptStats();
}

function createTextSection(key,label,text,onChange) {
  const wrapper = document.createElement('div');
  wrapper.className='manuscript-text-section';
  wrapper.innerHTML = `<h3>${label}</h3>
      <textarea class="form-control" id="manuscript-${key}" rows="3">${esc(text)}</textarea>`;
  wrapper.querySelector('textarea').addEventListener('input', e => onChange(e.target.value));
  return wrapper;
}

function addManuscriptPart() {
  const id = state.currentProjectId;
  if (!id) return;
  const m = initializeManuscript(id);
  m.parts.push({ id: uid(), titre: '', chapitres: [] });
  saveManuscript(id, m);
  renderManuscript();
}

function removePart(partId) {
  const id = state.currentProjectId;
  const m = initializeManuscript(id);
  m.parts = m.parts.filter(p=>p.id!==partId);
  saveManuscript(id,m);
  renderManuscript();
}

function updatePartTitle(partId, value) {
  const id = state.currentProjectId;
  const m = initializeManuscript(id);
  const p = m.parts.find(x=>x.id===partId);
  if (p) { p.titre = value; saveManuscript(id,m); }
}

let _manuscriptDraggedChapter = null;
function onManuscriptDragStart(evt, chapId) {
  _manuscriptDraggedChapter = chapId;
  evt.dataTransfer.setData('text/plain', chapId);
  evt.dataTransfer.effectAllowed='move';
}
function onManuscriptDragOver(evt) {
  evt.preventDefault();
  evt.currentTarget.classList.add('drag-over');
}
function onManuscriptDragLeave(evt) {
  evt.currentTarget.classList.remove('drag-over');
}
function onManuscriptDrop(evt, partId) {
  evt.preventDefault();
  evt.currentTarget.classList.remove('drag-over');
  const chapId = _manuscriptDraggedChapter || evt.dataTransfer.getData('text/plain');
  if (!chapId) return;
  const id = state.currentProjectId;
  const m = initializeManuscript(id);
  m.parts.forEach(p=>{ p.chapitres = (p.chapitres||[]).filter(cid=>cid!==chapId); });
  if (partId) {
    const p = m.parts.find(x=>x.id===partId);
    if (p) { p.chapitres = p.chapitres||[]; p.chapitres.push(chapId); }
  }
  saveManuscript(id,m);
  renderManuscript();
  _manuscriptDraggedChapter = null;
}

function updateManuscriptStats() {
  const id = state.currentProjectId;
  const m = getManuscript(id);
  if (!m) return;
  let words=0, chapCount=0;
  const chapters = getProjectData(id,'chapitres');
  function countForChap(chap) {
      if (!chap) return;
      if (chap.scenesIds && chap.scenesIds.length) {
         const scenes = getProjectData(id,'scenes');
         chap.scenesIds.forEach(cid=>{
            const s = scenes.find(x=>x.id===cid);
            if (s && s.contenu) words += wordCount(s.contenu);
         });
      } else if (chap.contenu) words += wordCount(chap.contenu);
      chapCount++;
  }
  m.parts.forEach(p=> (p.chapitres||[]).forEach(cid=> {
      const c = chapters.find(x=>x.id===cid);
      countForChap(c);
  }));
  const avg = chapCount? Math.round(words/chapCount):0;
  const pages = Math.ceil(words/250);
  const statsEl = document.getElementById('manuscript-stats');
  if (statsEl) {
     statsEl.textContent = `Mots : ${words} – Chapitres : ${chapCount} – Moyenne : ${avg} – Pages : ${pages}`;
  }
}


// ============================================================
// BONUS FEATURES FUNCTIONS
// ============================================================

// ---------- Appearance / Dark mode ----------
function applyAppearance(prefs) {
  const mode = prefs && prefs.appearance ? prefs.appearance : 'auto';
  let dark = false;
  if (mode === 'dark') dark = true;
  else if (mode === 'auto') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark-mode', dark);
  // accent color
  if (prefs && prefs.accent) {
    document.documentElement.style.setProperty('--primary', prefs.accent);
    // also adjust primary-dark slightly if not present
    document.documentElement.style.setProperty('--primary-dark', prefs.accent);
  }
  // density (compact / comfortable / spacious)
  ['density-compact','density-comfortable','density-spacious'].forEach(c => document.body.classList.remove(c));
  const density = (prefs && prefs.density) || 'comfortable';
  document.body.classList.add(`density-${density}`);
  // font size
  document.body.classList.remove('font-sm','font-md','font-lg');
  const fs = (prefs && prefs.fontSize) || 'md';
  document.body.classList.add(`font-${fs}`);
}

function saveAppearanceSettings() {
  const id = state.currentProjectId;
  if (!id) return;
  const prefs = getProjectPrefs(id) || {};
  const mode = document.querySelector('input[name="appearance"]:checked')?.value || 'auto';
  const accent = document.getElementById('appearance-accent').value || prefs.accent || getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const density = document.querySelector('input[name="density"]:checked')?.value || 'comfortable';
  const fontSize = document.querySelector('input[name="fontSize"]:checked')?.value || 'md';
  prefs.appearance = mode; prefs.accent = accent; prefs.density = density; prefs.fontSize = fontSize;
  saveProjectPrefs(id, prefs);
  applyAppearance(prefs);
  showToast('Apparence enregistrée', 'success');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.currentProjectId) {
    const prefs = getProjectPrefs(state.currentProjectId);
    if (prefs.appearance === 'auto') applyAppearance(prefs);
  }
});

// ---------- Auto backup ----------
function updateBackupStatus() {
  const prefs = getProjectPrefs(state.currentProjectId) || {};
  const statusEl = document.getElementById('backup-status');
  if (!statusEl) return;
  if (prefs.lastBackup) {
    const days = Math.floor((Date.now() - new Date(prefs.lastBackup)) / (1000*60*60*24));
    statusEl.textContent = `Dernier backup : il y a ${days} jour${days>1?'s':''}`;
  } else {
    statusEl.textContent = 'Aucun backup effectué';
  }
}

function checkAutoBackup() {
  const prefs = getProjectPrefs(state.currentProjectId) || {};
  if (prefs.autoBackup) {
    const now = new Date();
    const last = prefs.lastBackup ? new Date(prefs.lastBackup) : null;
    if (!last || now - last > 7*24*60*60*1000) {
      exportProject();
      prefs.lastBackup = now.toISOString();
      saveProjectPrefs(state.currentProjectId, prefs);
      showToast('Backup automatique créé', 'success');
    }
  }
  updateBackupStatus();
}

// ---------- Dashboard enhancements ----------
// dashboard duplication removed: features consolidated earlier in file

// ---------- Playlists ----------
function renderPlaylists() {
  const id = state.currentProjectId;
  const list = getProjectData(id,'playlists');
  const grid = document.getElementById('playlists-grid');
  const empty = document.getElementById('no-playlists');
  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = list.map(pl => {
    const img = pl.image ? `<img src="${pl.image}" alt="couverture de la playlist">` : '';
    const tags = pl.tags && pl.tags.length ? `<div class="item-card-tags">${renderTags(pl.tags)}</div>` : '';
    const assocNames = (pl.associated||[]).map(a=>getAssociatedName(a)).filter(Boolean).join(', ');
    return `
      <div class="item-card playlist-card">
        ${img}
        <div class="item-card-header">
          <div class="item-card-title">${esc(pl.nom)}</div>
          <div class="item-card-actions">
            <button class="btn-icon" onclick="openPlaylistModal('${pl.id}')" title="Modifier">✏️</button>
            <button class="btn-icon" onclick="deletePlaylistConfirm('${pl.id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
        ${tags}
        ${assocNames ? `<div class="item-card-meta"><small>Liée à : ${esc(assocNames)}</small></div>` : ''}
        ${pl.notes ? `<div class="item-card-notes">${esc(pl.notes)}</div>` : ''}
        ${pl.url ? `<button class="btn btn-spotify btn-sm" onclick="openSpotify('${pl.url}')">▶️ Écouter sur Spotify</button>` : ''}
        ${pl.titres && pl.titres.length ? `<div class="pl-track-count"><small>🎵 ${pl.titres.length} titre${pl.titres.length > 1 ? 's' : ''}</small></div>` : ''}
      </div>`;
  }).join('');
}

function getAssociatedName(a) {
  if (!a || !a.type || !a.id) return '';
  const list = getProjectData(state.currentProjectId, a.type);
  const item = list.find(x=>x.id===a.id);
  if (!item) return '';
  if (a.type === 'personnages') return [item.prenom,item.nom].filter(Boolean).join(' ');
  if (a.type === 'lieux') return item.nom;
  if (a.type === 'chapitres') return item.titre;
  return '';
}

function openPlaylistModal(plId=null) {
  state.editingId = plId;
  document.getElementById('modal-playlist-title').textContent = plId ? 'Modifier la playlist' : 'Nouvelle playlist';
  ['pl-nom','pl-url','pl-tags','pl-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pl-associated').innerHTML = '';
  document.getElementById('pl-image').value = '';
  document.getElementById('pl-image-preview-container').innerHTML = '';
  const chars = getProjectData(state.currentProjectId,'personnages');
  const lieux = getProjectData(state.currentProjectId,'lieux');
  const chaps = getProjectData(state.currentProjectId,'chapitres');
  const sel = document.getElementById('pl-associated');
  if (chars.length) {
    sel.innerHTML += '<optgroup label="Personnages">' +
      chars.map(c=>`<option value="personnages:${c.id}">${esc([c.prenom,c.nom].filter(Boolean).join(' '))}</option>`).join('') + '</optgroup>';
  }
  if (lieux.length) {
    sel.innerHTML += '<optgroup label="Lieux">' +
      lieux.map(l=>`<option value="lieux:${l.id}">${esc(l.nom)}</option>`).join('') + '</optgroup>';
  }
  if (chaps.length) {
    sel.innerHTML += '<optgroup label="Chapitres">' +
      chaps.map(c=>`<option value="chapitres:${c.id}">Ch. ${c.numero} – ${esc(c.titre)}</option>`).join('') + '</optgroup>';
  }
  if (plId) {
    const pl = getProjectData(state.currentProjectId,'playlists').find(x=>x.id===plId);
    if (pl) {
      document.getElementById('pl-nom').value = pl.nom || '';
      document.getElementById('pl-url').value = pl.url || '';
      document.getElementById('pl-tags').value = (pl.tags||[]).join(', ');
      document.getElementById('pl-notes').value = pl.notes || '';
      if (pl.image) {
        const container = document.getElementById('pl-image-preview-container');
        container.innerHTML = `<img src="${pl.image}" alt="couverture de la playlist" style="max-width:100%;border-radius:4px">`;
      }
      // select associated
      (pl.associated||[]).forEach(a=>{
        const val = `${a.type}:${a.id}`;
        const opt = sel.querySelector(`option[value="${val}"]`);
        if (opt) opt.selected = true;
      });
    }
  }
  // preview when user selects new image
  const imgInput = document.getElementById('pl-image');
  imgInput.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('pl-image-preview-container').innerHTML = `<img src="${ev.target.result}" alt="aperçu de l'image" style="max-width:100%;border-radius:4px">`;
      };
      reader.readAsDataURL(file);
    }
  };
  openModal('modal-playlist');
}

function savePlaylist() {
  const nom = document.getElementById('pl-nom').value.trim();
  if (!nom) { showToast('Le nom est requis', 'error'); return; }
  const url = document.getElementById('pl-url').value.trim();
  const tags = parseTags(document.getElementById('pl-tags').value);
  const notes = document.getElementById('pl-notes').value.trim();
  const sel = document.getElementById('pl-associated');
  const associated = Array.from(sel.selectedOptions).map(o=>{
    const [type,id] = o.value.split(':'); return {type,id};
  });
  const file = document.getElementById('pl-image').files[0];
  const finalize = imageData => {
    const id = state.currentProjectId;
    const list = getProjectData(id,'playlists');
    let pl = state.editingId ? list.find(x=>x.id===state.editingId) : null;
    if (!pl) {
      pl = { id: uid(), createdAt: new Date().toISOString() };
      list.push(pl);
    }
    pl.nom = nom;
    pl.url = url;
    pl.tags = tags;
    pl.notes = notes;
    pl.associated = associated;
    if (imageData !== undefined) pl.image = imageData;
    pl.updatedAt = new Date().toISOString();
    saveProjectData(id,'playlists',list);
    touchProject(id);
    showToast('Playlist enregistrée', 'success');
    closeModal('modal-playlist');
    renderPlaylists();
    // update other pages in case associations changed
    if (state.currentSection === 'personnages') renderCharacters();
    if (state.currentSection === 'lieux') renderLocations();
  };
  if (file) {
    const reader = new FileReader();
    reader.onload = e => finalize(e.target.result);
    reader.readAsDataURL(file);
  } else {
    finalize();
  }
}

function deletePlaylistConfirm(id) {
  showConfirm('Supprimer la playlist ?', 'Cette action est irréversible.', () => deletePlaylist(id));
}
function deletePlaylist(id) {
  let list = getProjectData(state.currentProjectId,'playlists');
  list = list.filter(p=>p.id!==id);
  saveProjectData(state.currentProjectId,'playlists',list);
  touchProject(state.currentProjectId);
  renderPlaylists();
  showToast('Playlist supprimée', 'success');
}

// ---------- Timeline/events ----------
function renderTimeline() {
  const id = state.currentProjectId;
  let events = getProjectData(id,'events');
  const typeFilter = $('timeline-filter-type').value;
  const persFilter = $('timeline-filter-personnage').value.toLowerCase();
  const zoom = $('timeline-zoom').value;
  const hasPers = $('filter-has-personnage').checked;
  const hasLieu = $('filter-has-lieu').checked;
  const hasChap = $('filter-has-chapitre').checked;

  // apply filters
  if (typeFilter) events = events.filter(e=>e.type === typeFilter);
  if (persFilter) {
    events = events.filter(e=>{
      return (e.associated||[]).some(a=>{
        const name = getAssociatedName(a).toLowerCase();
        return name.includes(persFilter);
      });
    });
  }
  if (hasPers || hasLieu || hasChap) {
    events = events.filter(e=>{
      const types = (e.associated||[]).map(a=>a.type);
      if (hasPers && types.includes('personnages')) return true;
      if (hasLieu && types.includes('lieux')) return true;
      if (hasChap && types.includes('chapitres')) return true;
      return false;
    });
  }

  // sort by approximated date
  events.sort((a,b)=>{
    const da = parseDateForSort(a.date);
    const db = parseDateForSort(b.date);
    return da - db;
  });

  // cache for pagination
  window._timelineCache = events;
  window._timelineOffset = 0;
  const container = document.getElementById('timeline-list');
  container.innerHTML = '';
  appendTimelineChunk(zoom);
}

function appendTimelineChunk(zoom) {
  const container = document.getElementById('timeline-list');
  const cache = window._timelineCache || [];
  const start = window._timelineOffset || 0;
  const chunkSize = 20;
  if (start >= cache.length) return;
  const slice = cache.slice(start, start + chunkSize);
  const html = buildTimelineHtml(slice, zoom, start===0);
  container.insertAdjacentHTML('beforeend', html);
  window._timelineOffset = start + chunkSize;
}

// add scroll listener once
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('timeline-list');
  if (container) {
    container.addEventListener('scroll', () => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
        const zoom = document.getElementById('timeline-zoom').value;
        appendTimelineChunk(zoom);
      }
    });
  }
});

// improved date parser for fuzzy strings (with caching)
const _dateSortCache = {};
function parseDateForSort(str) {
  if (!str) return 0;
  if (_dateSortCache[str] !== undefined) return _dateSortCache[str];
  const seasons = {
    'printemps':3, 'été':6, 'automne':9, 'hiver':12
  };
  let ts = 0;
  let d = new Date(str.replace(/Été|été/,'June'));
  if (!isNaN(d)) ts = d.getTime();
  else {
    // try year-only
    const yMatch = str.match(/(\d{4})/);
    if (yMatch) {
      let year = parseInt(yMatch[1]);
      // season
      const sMatch = str.match(/(Printemps|Été|été|Automne|Hiver)/i);
      if (sMatch) {
        const key = sMatch[1].toLowerCase();
        const month = seasons[key] || 1;
        ts = new Date(year, month-1,1).getTime();
      } else {
        ts = new Date(year,0,1).getTime();
      }
    }
  }
  _dateSortCache[str] = ts;
  return ts;
}

function buildTimelineHtml(events, zoom, fresh=false) {
  if (!Array.isArray(events)) return '';
  if (zoom === 'jour') {
    // simple list
    return events.map(renderEventRow).join('');
  }
  let html = '';
  // track last group key for incremental appends
  if (fresh) window._timelineLastGroupKey = null;
  events.forEach(e => {
    let key = '';
    if (zoom === 'annee') {
      key = getEventYear(e) || 'Sans date';
    } else if (zoom === 'mois') {
      key = getEventMonth(e) || getEventYear(e) || 'Sans date';
    }
    if (key !== window._timelineLastGroupKey) {
      html += `<div class="timeline-group"><strong>${esc(key)}</strong></div>`;
      window._timelineLastGroupKey = key;
    }
    html += renderEventRow(e);
  });
  return html;
}

function getEventYear(ev) {
  if (!ev.date) return '';
  const m = ev.date.match(/(\d{4})/);
  return m ? m[1] : '';
}
function getEventMonth(ev) {
  if (!ev.date) return '';
  const d = new Date(ev.date);
  if (!isNaN(d)) return d.toLocaleString('fr-FR',{year:'numeric',month:'long'});
  const y = getEventYear(ev);
  const m = ev.date.match(/\b(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\b/i);
  return m ? `${m[0]} ${y}` : y;
}

function renderEventRow(e) {
  const iconMap = { Rencontre:'💫', Naissance:'🍼', Mort:'🕊️', Tournant:'⚡', Découverte:'🔍', Conflit:'⚔️', Résolution:'✅', Autre:'📍' };
  const icon = iconMap[e.type] || '📍';
  const assoc = (e.associated||[]).map(getAssociatedName).filter(Boolean).join(', ');
  const imp = e.importance ? ` <span class="event-importance">${'★'.repeat(e.importance)}</span>` : '';
  return `<div class="timeline-event" tabindex="0" onclick="openEventModal('${e.id}')" onkeydown="if(event.key==='Enter')openEventModal('${e.id}')">
      <div class="event-icon">${icon}</div>
      <div class="event-body">
        <div><strong>${esc(e.titre)}</strong>${imp} <span class="event-date">${esc(e.date||'')}</span></div>
        <div>${esc(e.desc||'')}</div>
        ${assoc? `<div><small>Lié à : ${esc(assoc)}</small></div>` : ''}
      </div>
      <div class="event-actions">
        <button class="btn-icon" onclick="event.stopPropagation();openEventModal('${e.id}')">✏️</button>
        <button class="btn-icon" onclick="event.stopPropagation();deleteEventConfirm('${e.id}')">🗑️</button>
      </div>
    </div>`;
}

function openEventModal(evId=null) {
  state.editingId = evId;
  document.getElementById('modal-event-title').textContent = evId ? 'Modifier l\'événement' : 'Nouvel événement';
  ['ev-date','ev-titre','ev-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ev-type').value='Rencontre';
  document.getElementById('ev-importance').value = 3;
  document.getElementById('ev-importance-value').textContent = '3';
  document.getElementById('ev-associated').innerHTML='';
  const chars = getProjectData(state.currentProjectId,'personnages');
  const lieux = getProjectData(state.currentProjectId,'lieux');
  const chaps = getProjectData(state.currentProjectId,'chapitres');
  const sel = document.getElementById('ev-associated');
  if (chars.length) sel.innerHTML += '<optgroup label="Personnages">' + chars.map(c=>`<option value="personnages:${c.id}">${esc([c.prenom,c.nom].filter(Boolean).join(' '))}</option>`).join('') + '</optgroup>';
  if (lieux.length) sel.innerHTML += '<optgroup label="Lieux">' + lieux.map(l=>`<option value="lieux:${l.id}">${esc(l.nom)}</option>`).join('') + '</optgroup>';
  if (chaps.length) sel.innerHTML += '<optgroup label="Chapitres">' + chaps.map(c=>`<option value="chapitres:${c.id}">Ch. ${c.numero} – ${esc(c.titre)}</option>`).join('') + '</optgroup>';
  if (evId) {
    const ev = getProjectData(state.currentProjectId,'events').find(x=>x.id===evId);
    if (ev) {
      document.getElementById('ev-date').value = ev.date || '';
      document.getElementById('ev-titre').value = ev.titre || '';
      document.getElementById('ev-desc').value = ev.desc || '';
      document.getElementById('ev-type').value = ev.type || 'Rencontre';
      document.getElementById('ev-importance').value = ev.importance || 3;
      document.getElementById('ev-importance-value').textContent = ev.importance || '3';
      (ev.associated||[]).forEach(a=>{
        const opt = sel.querySelector(`option[value="${a.type}:${a.id}"]`);
        if (opt) opt.selected = true;
      });
    }
  }
  openModal('modal-event');
}

function saveEvent() {
  const date = document.getElementById('ev-date').value;
  const titre = document.getElementById('ev-titre').value.trim();
  if (!titre) { showToast('Le titre est requis', 'error'); return; }
  const desc = document.getElementById('ev-desc').value.trim();
  const type = document.getElementById('ev-type').value;
  const importance = parseInt(document.getElementById('ev-importance').value,10) || 1;
  const sel = document.getElementById('ev-associated');
  const associated = Array.from(sel.selectedOptions).map(o=>{
    const [type,id] = o.value.split(':'); return {type,id};
  });
  const id = state.currentProjectId;
  const list = getProjectData(id,'events');
  let ev = state.editingId ? list.find(x=>x.id===state.editingId) : null;
  if (!ev) { ev = { id: uid(), createdAt: new Date().toISOString() }; list.push(ev); }
  ev.date = date; ev.titre = titre; ev.desc = desc; ev.type = type; ev.importance = importance;
  ev.associated = associated; ev.updatedAt = new Date().toISOString();
  saveProjectData(id,'events',list);
  touchProject(id);
  showToast('Événement enregistré','success');
  closeModal('modal-event');
  renderTimeline();
}

function deleteEventConfirm(id) {
  showConfirm('Supprimer l\'événement ?', '', () => deleteEvent(id));
}
function deleteEvent(id) {
  let list = getProjectData(state.currentProjectId,'events');
  list = list.filter(e=>e.id!==id);
  saveProjectData(state.currentProjectId,'events',list);
  touchProject(state.currentProjectId);
  renderTimeline();
  showToast('Événement supprimé','success');
}

// ---------- Notes ----------
function renderNotes() {
  const id = state.currentProjectId;
  let list = getProjectData(id,'notes');
  const q = $('notes-search').value.toLowerCase();
  list = list.filter(n=>{
    return n.titre.toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q) || (n.tags||[]).some(t=>t.toLowerCase().includes(q));
  });
  list.sort((a,b)=>{
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // chunking to avoid blocking UI when many notes
  window._notesCache = list;
  window._notesOffset = 0;
  const container = $('notes-list');
  container.innerHTML = '';
  appendNotesChunk();
}

function appendNotesChunk() {
  const container = $('notes-list');
  const cache = window._notesCache || [];
  const start = window._notesOffset || 0;
  const chunk = 30;
  if (start >= cache.length) return;
  const slice = cache.slice(start, start + chunk);
  const html = slice.map(n=>{
    const dueBadge = n.due ? `<small class="note-meta">📅 ${esc(n.due)}</small>` : '';
    const dueDate = n.due ? new Date(n.due) : null;
    const overdue = dueDate && new Date() > dueDate && (n.tasks && n.tasks.some(t=>!t.done) || !n.tasks);
    const overdueBadge = overdue ? `<small class="note-meta" style="color:#D32F2F">⏰ En retard</small>` : '';
    const tasksSummary = n.tasks && n.tasks.length ? `<div class="note-tasks-summary"><small>☐ ${n.tasks.filter(t=>!t.done).length} restante(s) / ${n.tasks.length}</small></div>` : '';
    return `<div class="note-item${n.pinned?' pinned':''}" tabindex="0" onclick="openNoteModal('${n.id}')" onkeydown="if(event.key==='Enter')openNoteModal('${n.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;gap:8px;align-items:center"><strong>${esc(n.titre)}</strong>${dueBadge}</div>
        <div class="note-actions">
          ${n.tasks && n.tasks.length ? `<button class="btn-icon" onclick="event.stopPropagation();openNoteModal('${n.id}')">📝</button>` : `<button class="btn-icon" onclick="event.stopPropagation();openNoteModal('${n.id}')">✏️</button>`}
          <button class="btn-icon" onclick="event.stopPropagation();deleteNoteConfirm('${n.id}')">🗑️</button>
        </div>
      </div>
      <div>${esc(n.content||'')}</div>
      ${tasksSummary}
      ${n.tags && n.tags.length? `<div class="note-tags">${renderTags(n.tags)}</div>`: ''}
    </div>`;
  }).join('');
  container.insertAdjacentHTML('beforeend', html);
  window._notesOffset = start + chunk;
  if (window._notesOffset < cache.length) {
    setTimeout(appendNotesChunk, 0);
  }
}

// assign debounced wrappers so inline handlers work
debouncedRenderNotes = debounce(renderNotes, 200);
debouncedRenderTimeline = debounce(renderTimeline, 200);
debouncedHomeSearch = debounce(renderHomeSearch, 200);

// stats update also debounced to avoid thrashing charts
let debouncedUpdateStats = debounce(updateStats, 300);

// ---------------- Reminders / Notifications ----------------
function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission !== 'denied') {
    return Notification.requestPermission().then(p => p === 'granted');
  }
  return Promise.resolve(false);
}

function checkDueTasksOnce() {
  const id = state.currentProjectId;
  if (!id) return;
  const notes = getProjectData(id,'notes');
  const now = new Date();
  notes.forEach(n=>{
    if (!n || !n.remind || !n.due) return;
    const due = new Date(n.due);
    // notify if due within next 60 minutes or overdue and not yet notified
    const diffMin = (due - now) / 60000;
    const alreadyNotified = n.__notifiedAt ? new Date(n.__notifiedAt) : null;
    if ((diffMin <= 60 && diffMin >= 0) || (diffMin < 0 && (!alreadyNotified || (now - alreadyNotified) > 60*60*1000))) {
      // trigger
      requestNotificationPermission().then(granted => {
        if (!granted) return;
        try {
          const title = n.titre || 'Rappel';
          const body = n.due ? `Échéance: ${n.due}` : '';
          const notif = new Notification(title, { body, tag: n.id });
          // mark as notified
          n.__notifiedAt = new Date().toISOString();
          saveProjectData(id,'notes', notes);
        } catch (err) {
          console.warn('Notification failed', err);
        }
      });
    }
  });
}

let _dueTimer = null;
function scheduleDueChecks(enable=true) {
  if (_dueTimer) { clearInterval(_dueTimer); _dueTimer = null; }
  if (!enable) return;
  // run every minute
  _dueTimer = setInterval(checkDueTasksOnce, 60*1000);
  // initial run
  checkDueTasksOnce();
}

// run checks when opening a project
const oldOpenProject = window.openProject;
if (typeof oldOpenProject === 'function') {
  window.openProject = function() { oldOpenProject.apply(this, arguments); scheduleDueChecks(true); };
} else {
  // fallback: schedule on load
  window.addEventListener('load', ()=> scheduleDueChecks(true));
}

function openNoteModal(nId=null) {
  state.editingId = nId;
  document.getElementById('modal-note-title').textContent = nId ? 'Modifier la note' : 'Nouvelle note';
  ['note-title','note-content','note-tags','note-due'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('note-pinned').checked = false;
  document.getElementById('note-remind').checked = false;
  // clear tasks area
  const tasksListEl = document.getElementById('note-tasks-list'); if (tasksListEl) tasksListEl.innerHTML = '';
  document.getElementById('note-new-task').value = '';
  // wire type change to show/hide tasks
  const typeSel = document.getElementById('note-type');
  const taskArea = document.getElementById('note-task-area');
  function updateTaskArea(){ if (typeSel.value === 'task') taskArea.classList.remove('hidden'); else taskArea.classList.add('hidden'); }
  typeSel.removeEventListener('change', updateTaskArea);
  typeSel.addEventListener('change', updateTaskArea);
  updateTaskArea();
  if (nId) {
    const n = getProjectData(state.currentProjectId,'notes').find(x=>x.id===nId);
    if (n) {
      document.getElementById('note-title').value = n.titre || '';
      document.getElementById('note-content').value = n.content || '';
      document.getElementById('note-tags').value = (n.tags||[]).join(', ');
      document.getElementById('note-pinned').checked = !!n.pinned;
      if (n.type) document.getElementById('note-type').value = n.type;
      if (n.due) document.getElementById('note-due').value = n.due;
      if (n.remind) document.getElementById('note-remind').checked = true;
      // render tasks
      if (n.tasks && n.tasks.length) {
        const tl = document.getElementById('note-tasks-list');
        tl.innerHTML = '';
        n.tasks.forEach(t=>{
          const div = document.createElement('div');
          div.className = 'note-task-item';
          div.innerHTML = `<label><input type="checkbox" ${t.done? 'checked':''} onchange="toggleNoteTask('${n.id}','${t.id}', this.checked)"> ${esc(t.text)}</label> <button class=\"btn-icon\" onclick=\"deleteNoteTask('${n.id}','${t.id}')\">🗑️</button>`;
          tl.appendChild(div);
        });
      }
    }
  }
  openModal('modal-note');
}

function saveNote() {
  const titre = document.getElementById('note-title').value.trim();
  if (!titre) { showToast('Le titre est requis', 'error'); return; }
  const content = document.getElementById('note-content').value.trim();
  const tags = parseTags(document.getElementById('note-tags').value);
  const pinned = document.getElementById('note-pinned').checked;
  const type = document.getElementById('note-type').value;
  const due = document.getElementById('note-due').value || null;
  const remind = document.getElementById('note-remind').checked;
  const id = state.currentProjectId;
  const list = getProjectData(id,'notes');
  let n = state.editingId ? list.find(x=>x.id===state.editingId) : null;
  if (!n) { n = { id: uid(), createdAt: new Date().toISOString() }; list.push(n); }
  n.titre = titre; n.content = content; n.tags = tags; n.pinned = pinned; n.updatedAt = new Date().toISOString();
  n.type = type; n.due = due; n.remind = remind;
  // collect tasks from DOM if task type
  if (type === 'task') {
    const tasks = [];
    const tl = document.getElementById('note-tasks-list');
    if (tl) {
      tl.querySelectorAll('.note-task-item').forEach(el=>{
        // parse data-task-id attribute if present
        const chk = el.querySelector('input[type=checkbox]');
        const btn = el.querySelector('button');
        const text = (el.textContent||'').trim();
        const tid = el.getAttribute('data-task-id') || uid();
        tasks.push({ id: tid, text: text.replace('🗑️','').trim(), done: !!(chk && chk.checked) });
      });
    }
    n.tasks = tasks;
  } else {
    delete n.tasks;
  }
  saveProjectData(id,'notes',list);
  touchProject(id);
  showToast('Note enregistrée','success');
  closeModal('modal-note');
  renderNotes();
}

function addNoteTaskInput() {
  const text = document.getElementById('note-new-task').value.trim();
  if (!text) return;
  const tl = document.getElementById('note-tasks-list');
  const id = uid();
  const div = document.createElement('div');
  div.className = 'note-task-item';
  div.setAttribute('data-task-id', id);
  div.innerHTML = `<label><input type="checkbox"> ${esc(text)}</label> <button class="btn-icon" onclick="this.parentElement.remove()">🗑️</button>`;
  tl.appendChild(div);
  document.getElementById('note-new-task').value = '';
}

function toggleNoteTask(noteId, taskId, done) {
  const list = getProjectData(state.currentProjectId,'notes');
  const n = list.find(x=>x.id===noteId);
  if (!n || !n.tasks) return;
  const t = n.tasks.find(x=>x.id===taskId);
  if (!t) return;
  t.done = !!done; t.updatedAt = new Date().toISOString();
  saveProjectData(state.currentProjectId,'notes',list);
  touchProject(state.currentProjectId);
  renderNotes();
}

function deleteNoteTask(noteId, taskId) {
  const list = getProjectData(state.currentProjectId,'notes');
  const n = list.find(x=>x.id===noteId);
  if (!n || !n.tasks) return;
  n.tasks = n.tasks.filter(t=>t.id!==taskId);
  saveProjectData(state.currentProjectId,'notes',list);
  renderNotes();
}

function deleteNoteConfirm(id) {
  showConfirm('Supprimer la note ?', '', () => deleteNote(id));
}
function deleteNote(id) {
  let list = getProjectData(state.currentProjectId,'notes');
  list = list.filter(n=>n.id!==id);
  saveProjectData(state.currentProjectId,'notes',list);
  touchProject(state.currentProjectId);
  renderNotes();
  showToast('Note supprimée','success');
}

// ---------- Global search ----------

function showAllSearch(type) {
  const q = document.getElementById('global-search').value;
  const all = performGlobalSearch(q)[type] || [];
  const container = document.getElementById('search-results');
  let html = `<div class="group-title">Tous les ${type}</div>`;
  all.forEach(item => {
    let text = item.nom || item.titre || item.name || '';
    html += `<div class="result-item">${esc(text)}</div>`;
  });
  container.innerHTML = html;
}


// ---------- Utilities for new features ----------
function openSpotify(url) {
  let id = '';
  const m = url.match(/playlist\/([A-Za-z0-9]+)/);
  if (m) id = m[1];
  if (id) {
    const uri = `spotify:playlist:${id}`;
    const a = document.createElement('a');
    a.href = uri;
    a.click();
    setTimeout(() => window.open(url, '_blank'), 500);
  } else {
    window.open(url, '_blank');
  }
}

// update render settings to include new prefs
function renderSettings() {
  const project = getProjects().find(p => p.id === state.currentProjectId);
  if (!project) return;
  document.getElementById('settings-project-name').value = project.name;
  document.getElementById('settings-project-desc').value = project.description || '';
  const prefs = getProjectPrefs(state.currentProjectId);
  // appearance radios
  if (prefs.appearance) {
    const el = document.querySelector(`input[name="appearance"][value="${prefs.appearance}"]`);
    if (el) el.checked = true;
  }
  document.querySelectorAll('input[name="appearance"]').forEach(r => {
    r.onchange = () => {
      const prefs = getProjectPrefs(state.currentProjectId);
      prefs.appearance = document.querySelector('input[name="appearance"]:checked').value;
      saveProjectPrefs(state.currentProjectId, prefs);
      applyAppearance(prefs);
    };
  });
  // backup
  document.getElementById('settings-auto-backup').checked = !!prefs.autoBackup;
  document.getElementById('settings-auto-backup').onchange = () => {
    const prefs = getProjectPrefs(state.currentProjectId);
    prefs.autoBackup = document.getElementById('settings-auto-backup').checked;
    saveProjectPrefs(state.currentProjectId, prefs);
    checkAutoBackup();
  };
  updateBackupStatus();
}

// override navigateTo to apply appearance and check backup
(function(){
  const orig = navigateTo;
  navigateTo = function(section) {
    orig(section);
    if (section==='parametres') renderSettings();
    const prefs = getProjectPrefs(state.currentProjectId);
    applyAppearance(prefs);
    checkAutoBackup();
  };
})();

// --------------------------------------------------

function previewManuscript() {
  const html = assembleManuscriptHtml({}, {separator:'###'});
  const w = window.open('','preview','width=800,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    // popup blocked: show in modal
    const modal = document.getElementById('modal-preview-chapter');
    modal.querySelector('#preview-chapter-content').innerHTML = html;
    openModal('modal-preview-chapter');
  }
}

function openExportModal() {
  document.getElementById('export-form').reset();
  openModal('modal-export-ebook');
}

function generateEbook() {
  const form = document.getElementById('export-form');
  const meta = {
     title: form['export-title'].value.trim(),
     author: form['export-author'].value.trim(),
     series: form['export-series'].value.trim(),
     seriesIndex: form['export-series-index'].value,
     genre: form['export-genre'].value.trim(),
     language: form['export-language'].value,
     isbn: form['export-isbn'].value.trim(),
     date: form['export-date'].value,
     description: form['export-description'].value.trim()
  };
  const opts = {
     format: form['export-format'].value,
     coverFile: form['export-cover'].files[0],
     toc: form['opt-toc'].checked,
     titlePage: form['opt-title-page'].checked,
     copyrightPage: form['opt-copyright-page'].checked,
     chapterNumbers: form['opt-chapter-numbers'].checked,
     font: form['opt-font'].value,
     fontSize: form['opt-font-size'].value,
     lineHeight: form['opt-line-height'].value,
     separator: '###'
  };
  if (opts.format==='epub') {
     assembleAndDownloadEpub(meta, opts);
  } else {
     const html = assembleManuscriptHtml(meta, opts);
     const w = window.open('','print','width=800,height=600');
     w.document.write(html);
     w.document.close();
     w.focus();
     w.print();
     showToast('Utilisez Calibre pour convertir l’EPUB en PDF si besoin', 'info');
  }
  closeModal('modal-export-ebook');
}

function assembleManuscriptHtml(meta, opts) {
  const id = state.currentProjectId;
  const m = initializeManuscript(id); // ensure default structure
  const chapters = getProjectData(id,'chapitres').sort((a,b)=>a.numero-b.numero);
  const scenes = getProjectData(id,'scenes');
  opts = opts || {};
  meta = meta || {};
  // build parts list including an anonymous group for unassigned chapters
  const assignedIds = new Set();
  m.parts.forEach(p => (p.chapitres||[]).forEach(cid => assignedIds.add(cid)));
  const unassigned = chapters.filter(c => !assignedIds.has(c.id));
  const parts = m.parts.slice();
  if (unassigned.length) {
    parts.push({ id: 'unassigned', titre: '', chapitres: unassigned.map(c=>c.id) });
  }
  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'+ (opts.font||'serif') +';line-height:'+ (opts.lineHeight||'1.5') +';font-size:'+ (opts.fontSize||'12') +'pt;}</style></head><body>';
  if (opts.titlePage && meta.title) {
     html += `<h1 style="text-align:center;margin-top:200px">${esc(meta.title)}</h1><p style="text-align:center;margin-top:20px">par<br>${esc(meta.author)}</p><div style="page-break-after:always"></div>`;
  }
  if (opts.copyrightPage) {
     html += `<p>Copyright © ${new Date().getFullYear()} ${esc(meta.author)}<br>Tous droits réservés.<br>${meta.isbn? 'ISBN: '+esc(meta.isbn):''}</p><div style="page-break-after:always"></div>`;
  }
  if (opts.toc) {
     html += '<h2>Table des matières</h2><ul>';
     let chapterIndex=1;
     parts.forEach(p=>{
         if (p.chapitres && p.chapitres.length) {
             html += `<li><strong>${esc(p.titre||'Partie')}</strong><ul>`;
             p.chapitres.forEach(cid=>{
                 const c = chapters.find(ch=>ch.id===cid);
                 if (c) {
                   html += `<li><a href="#chap${chapterIndex}">Ch. ${c.numero} – ${esc(c.titre)}</a></li>`;
                   chapterIndex++;
                 }
             });
             html += '</ul></li>';
         }
     });
     html += '</ul><div style="page-break-after:always"></div>';
  }
  parts.forEach(p=>{
      if (p.titre) html += `<h2>${esc(p.titre)}</h2>`;
      p.chapitres.forEach(cid=>{
         const c = chapters.find(ch=>ch.id===cid);
         if (!c) return;
         html += `<h3 id="chap${c.numero}">Chapitre ${opts.chapterNumbers? c.numero: ''} – ${esc(c.titre)}</h3>`;
         if (c.scenesIds && c.scenesIds.length) {
             c.scenesIds.forEach((sid,idx)=>{
                const s = scenes.find(sc=>sc.id===sid);
                if (s) {
                   html += `<p>${esc(s.contenu)}</p>`;
                   if (opts.separator && idx < c.scenesIds.length-1) html += `<p>${opts.separator}</p>`;
                }
             });
         } else if (c.contenu) {
             html += `<p>${esc(c.contenu)}</p>`;
         }
      });
  });
  if (m.epilogue) html += `<h2>Épilogue</h2><p>${esc(m.epilogue)}</p>`;
  html += '</body></html>';
  return html;
}

function assembleAndDownloadEpub(meta, opts) {
  const id = state.currentProjectId;
  const m = initializeManuscript(id);
  const chapters = getProjectData(id,'chapitres').sort((a,b)=>a.numero-b.numero);
  const scenes = getProjectData(id,'scenes');
  const zip = new JSZip();
  zip.file('mimetype','application/epub+zip',{compression:'STORE'});
  zip.folder('META-INF').file('container.xml',`<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  const oebps = zip.folder('OEBPS');
  const cssContent = `body{font-family:${opts.font},serif;line-height:${opts.lineHeight};font-size:${opts.fontSize}pt;}h1,h2,h3{page-break-after:avoid;}p{margin:0 0 1em;}`;
  oebps.file('styles.css',cssContent);
  let manifest=['<item id="styles" href="styles.css" media-type="text/css"/>'];
  let spine=[];
  let navPoints=[];
  let chapCounter=1;
  if (opts.titlePage) {
      const titleHtml=`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Title</title><link href="styles.css" rel="stylesheet"/></head><body><h1>${esc(meta.title)}</h1><p>par ${esc(meta.author)}</p></body></html>`;
      oebps.file('title.xhtml',titleHtml);
      manifest.push(`<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`);
      spine.push(`<itemref idref="title"/>`);
  }
  if (opts.copyrightPage) {
      const copyHtml=`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Copyright</title><link href="styles.css" rel="stylesheet"/></head><body><p>Copyright © ${new Date().getFullYear()} ${esc(meta.author)}<br/>Tous droits réservés.<br/>${meta.isbn? 'ISBN: '+esc(meta.isbn):''}</p></body></html>`;
      oebps.file('copyright.xhtml',copyHtml);
      manifest.push(`<item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>`);
      spine.push(`<itemref idref="copyright"/>`);
  }
  const tocLinks = [];
  const assignedIds = new Set();
  m.parts.forEach(p=> (p.chapitres||[]).forEach(cid=> assignedIds.add(cid)));
  const unassigned = chapters.filter(c=>!assignedIds.has(c.id));
  // create parts list same as above in epub function
  const parts = m.parts.slice();
  if (unassigned.length) parts.push({ id:'unassigned', titre:'', chapitres:unassigned.map(c=>c.id) });
  parts.forEach(p=>{
      p.chapitres.forEach(cid=>{
         const c = chapters.find(ch=>ch.id===cid);
         if (!c) return;
         let content='';
         if (c.scenesIds && c.scenesIds.length) {
             c.scenesIds.forEach((sid,si)=>{
                const s = scenes.find(sc=>sc.id===sid);
                if (s) {
                   content += `<p>${esc(s.contenu)}</p>`;
                   if (opts.separator && si< c.scenesIds.length-1) content += `<p>${opts.separator}</p>`;
                }
             });
         } else if (c.contenu) {
             content += `<p>${esc(c.contenu)}</p>`;
         }
         const filename=`chapter${chapCounter}.xhtml`;
         const chapHtml=`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(c.titre)}</title><link href="styles.css" rel="stylesheet"/></head><body><h3>Chapitre ${opts.chapterNumbers? c.numero: ''} – ${esc(c.titre)}</h3>${content}</body></html>`;
         oebps.file(filename,chapHtml);
         manifest.push(`<item id="chap${chapCounter}" href="${filename}" media-type="application/xhtml+xml"/>`);
         spine.push(`<itemref idref="chap${chapCounter}"/>`);
         navPoints.push(`<navPoint id="navPoint-${chapCounter}" playOrder="${chapCounter}"><navLabel><text>Chapitre ${c.numero} – ${esc(c.titre)}</text></navLabel><content src="${filename}"/></navPoint>`);
         tocLinks.push(`<li><a href="${filename}">Chapitre ${c.numero} – ${esc(c.titre)}</a></li>`);
         chapCounter++;
      });
  });
  if (opts.toc) {
      const ncx=`<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${meta.isbn || 'urn:uuid:'+uid()}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head><docTitle><text>${esc(meta.title)}</text></docTitle><navMap>${navPoints.join('')}</navMap></ncx>`;
      oebps.file('toc.ncx', ncx);
      manifest.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);
      // also html table of contents
      const tocHtml=`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Table des matières</title><link href="styles.css" rel="stylesheet"/></head><body><h1>Table des matières</h1><nav><ol>${tocLinks.join('')}</ol></nav></body></html>`;
      oebps.file('toc.xhtml', tocHtml);
      manifest.push(`<item id="tocx" href="toc.xhtml" media-type="application/xhtml+xml"/>`);
  }
  const packageXml=`<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(meta.title)}</dc:title><dc:language>${meta.language||'fr'}</dc:language><dc:identifier id="BookId">${meta.isbn||'urn:uuid:'+uid()}</dc:identifier><dc:creator>${esc(meta.author)}</dc:creator><dc:date>${meta.date||new Date().toISOString().split('T')[0]}</dc:date></metadata><manifest>${manifest.join('')}</manifest><spine toc="ncx">${spine.join('')}</spine></package>`;
  oebps.file('content.opf', packageXml);
  if (opts.coverFile) {
      const reader = new FileReader();
      reader.onload = e => {
          const data = e.target.result.split(',')[1];
          oebps.file('cover.jpg', data, {base64:true});
          manifest.push(`<item id="cover" href="cover.jpg" media-type="image/jpeg"/>`);
          zip.generateAsync({type:'blob'}).then(blob=>downloadBlob(blob,`${meta.title||'book'}.epub`));
      };
      reader.readAsDataURL(opts.coverFile);
  } else {
      zip.generateAsync({type:'blob'}).then(blob=>downloadBlob(blob,`${meta.title||'book'}.epub`));
  }
}

function downloadBlob(blob,filename) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// override navigateTo to render manuscript
(function(){
  const originalNavigate = navigateTo;
  navigateTo = function(section) {
    originalNavigate(section);
    if (section === 'manuscrit') renderManuscript();
  };
})();

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

function showConfirm(title, message, callback) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  state.confirmCallback = callback;
  openModal('modal-confirm');
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Confirm button
  document.getElementById('confirm-btn').addEventListener('click', () => {
    if (state.confirmCallback) {
      state.confirmCallback();
      state.confirmCallback = null;
    }
  });

  // Close modals when clicking overlay background
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', e => {
    const container = document.getElementById('dropdown-container');
    if (container && !container.contains(e.target)) {
      document.getElementById('project-dropdown').classList.add('hidden');
    }
  });

  // Escape key closes modals + dropdown
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
      m.classList.add('hidden');
      document.body.style.overflow = '';
    });
    document.getElementById('project-dropdown')?.classList.add('hidden');
    showSearchResults(null);
  });

  // Enter key submits focused modal form
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    const modal = document.querySelector('.modal-overlay:not(.hidden)');
    if (!modal) return;
    const id = modal.id;
    if (id === 'modal-new-project') createProject();
    else if (id === 'modal-character') saveCharacter();
    else if (id === 'modal-location')  saveLocation();
    else if (id === 'modal-chapter')   saveChapter();
  });

  // ensure project creation buttons work even if clicked early
  document.querySelectorAll('.btn-new-project').forEach(btn => btn.addEventListener('click', openNewProjectModal));

  // Global search input
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        const res = performGlobalSearch(e.target.value);
        showSearchResults(res);
      }, 300);
    });
  }
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const inp = document.getElementById('global-search');
      if (inp) inp.focus();
    }
  });

  // ── Advanced keyboard shortcuts ──────────────────────────
  document.addEventListener('keydown', e => {
    // Only fire when project page is visible and no modal open
    if (document.getElementById('project-page')?.classList.contains('hidden')) return;
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (!state.currentProjectId) return;
    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+N → new character
    if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault(); openCharacterModal(); return;
    }
    // Ctrl+Shift+N → new location
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault(); openLocationModal(); return;
    }
    // Ctrl+Shift+S → new scene
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') {
      if (document.getElementById('chapter-editor-page')?.classList.contains('hidden') &&
          document.getElementById('scene-editor-page')?.classList.contains('hidden')) {
        e.preventDefault(); openLocalSceneModal(); return;
      }
    }
    // Ctrl+E → go to export (manuscrit)
    if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault(); navigateTo('manuscrit'); return;
    }
    // Ctrl+G → relations graph
    if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      navigateTo('relations');
      state.relationsView = 'graph';
      setTimeout(renderRelations, 50);
      return;
    }
    // Ctrl+T → timeline
    if (ctrl && !e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault(); navigateTo('timeline'); return;
    }
    // Ctrl+1..9 → navigate sections
    const sectionMap = {
      '1': 'dashboard', '2': 'personnages', '3': 'lieux',
      '4': 'chapitres', '5': 'scenes',     '6': 'manuscrit',
      '7': 'playlists', '8': 'relations',  '9': 'timeline',
    };
    if (ctrl && sectionMap[e.key]) {
      e.preventDefault();
      navigateTo(sectionMap[e.key]);
      return;
    }
  });
  document.addEventListener('click', e => {
    const container = document.getElementById('global-search-container');
    if (container && !container.contains(e.target)) {
      showSearchResults(null);
    }
  });

  // relations view toggles & filtering
  const relGraphBtn = document.getElementById('relations-toggle-graph');
  const relListBtn  = document.getElementById('relations-toggle-list');
  const relMatrixBtn= document.getElementById('relations-toggle-matrix');
  const relFilter   = document.getElementById('relations-filter');
  if (relGraphBtn && relListBtn && relMatrixBtn) {
    relGraphBtn.addEventListener('click', () => { state.relationsView = 'graph'; renderRelations(); });
    relListBtn.addEventListener('click', () => { state.relationsView = 'list'; renderRelations(); });
    relMatrixBtn.addEventListener('click', () => { state.relationsView = 'matrix'; renderRelations(); });
  }
  if (relFilter) relFilter.addEventListener('change', renderRelations);

  // apply appearance even before project selected (auto by default)
  applyAppearance(getProjectPrefs(state.currentProjectId));
  // Start on home page
  showHomePage();
});

// ============================================================
// CUSTOM SECTIONS SYSTEM
// ============================================================

const CS_FIELD_TYPES = [
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

const CS_ICONS = ['📁','🔮','⚔️','💭','🔐','📦','🌟','💎','🎭','🗝️','📜','🌍','🎵','🐉','🧙','🏰','⚗️','🌸','🎨','📚','🔬','🧩','🎯','💡','🔑'];

function getCustomSections() {
  const id = state.currentProjectId;
  if (!id) return [];
  return JSON.parse(localStorage.getItem(`projet_${id}_customSections`) || '[]');
}
function saveCustomSections(list) {
  localStorage.setItem(`projet_${state.currentProjectId}_customSections`, JSON.stringify(list));
}

// ---- Sidebar ----
function renderCustomSectionsSidebar() {
  const container = document.getElementById('custom-sections-nav');
  if (!container) return;
  const sections = getCustomSections();
  let html = '';
  if (sections.length > 0) {
    html += '<div class="sidebar-separator"><span>Mes sections</span></div>';
    html += sections.map(s => `
      <button class="nav-item" data-section="custom_${s.id}" onclick="navigateTo('custom_${s.id}')">
        <span class="nav-icon">${esc(s.icone)}</span>
        <span class="nav-label">${esc(s.nom)}</span>
      </button>`).join('');
  }
  html += `<div class="sidebar-separator"></div>
    <div class="section-add-wrapper">
      <button class="nav-item nav-create-section" onclick="toggleSectionAddMenu(event)">
        <span class="nav-icon">➕</span>
        <span class="nav-label">Ajouter section</span>
      </button>
      <div id="section-add-menu" class="section-add-menu hidden">
        <button class="section-add-option" onclick="closeSectionAddMenu(); openCustomSectionModal()">
          <span class="section-add-option-icon">✏️</span>
          <div class="section-add-option-text">
            <strong>Créer de zéro</strong>
            <span>Créer une section personnalisée</span>
          </div>
        </button>
        <button class="section-add-option" onclick="closeSectionAddMenu(); openImportSectionModal()">
          <span class="section-add-option-icon">📚</span>
          <div class="section-add-option-text">
            <strong>Importer de la bibliothèque</strong>
            <span>Choisir parmi les sections pré-créées</span>
          </div>
        </button>
      </div>
    </div>`;
  container.innerHTML = html;
}

// ---- Section Add Menu ----
function toggleSectionAddMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('section-add-menu');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  closeSectionAddMenu();
  if (isHidden) {
    menu.classList.remove('hidden');
    setTimeout(() => {
      document.addEventListener('click', _closeSectionAddMenuOnClick, { once: true });
    }, 0);
  }
}
function closeSectionAddMenu() {
  const menu = document.getElementById('section-add-menu');
  if (menu) menu.classList.add('hidden');
  document.removeEventListener('click', _closeSectionAddMenuOnClick);
}
function _closeSectionAddMenuOnClick(e) {
  const menu = document.getElementById('section-add-menu');
  if (menu && !menu.contains(e.target)) closeSectionAddMenu();
}

// ---- Navigate to custom section ----
function navigateToCustomSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  let sectionEl = document.getElementById(`section-custom_${sectionId}`);
  if (!sectionEl) {
    sectionEl = document.createElement('section');
    sectionEl.id = `section-custom_${sectionId}`;
    sectionEl.className = 'content-section';
    document.querySelector('.main-content').appendChild(sectionEl);
  }
  sectionEl.classList.remove('hidden');
  renderCustomSectionPage(sectionId);
}

// ---- Render section page ----
function renderCustomSectionPage(sectionId) {
  const s = getCustomSections().find(x => x.id === sectionId);
  const el = document.getElementById(`section-custom_${sectionId}`);
  if (!s || !el) return;
  const singularName = s.nom.replace(/s$/i, '').trim();
  el.innerHTML = `
    <div class="section-header">
      <h2>${esc(s.icone)} ${esc(s.nom)}</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="openCustomSectionModal('${s.id}')" title="Configurer la section">⚙️ Configurer</button>
        <button class="btn btn-primary" onclick="openCustomItemModal(null,'${s.id}')">+ ${esc(singularName)}</button>
      </div>
    </div>
    <div id="custom-section-content-${s.id}"></div>`;
  renderCustomSectionItems(s);
}

function renderCustomSectionItems(s) {
  const container = document.getElementById(`custom-section-content-${s.id}`);
  if (!container) return;
  if (!s.items || s.items.length === 0) {
    container.innerHTML = `<div class="no-items">
      <div class="no-icon">${esc(s.icone)}</div>
      <p>Aucun élément dans "${esc(s.nom)}".</p>
      <button class="btn btn-primary" style="margin-top:12px" onclick="openCustomItemModal(null,'${s.id}')">+ Créer un élément</button>
    </div>`;
    return;
  }
  if (s.typeAffichage === 'liste') renderCSList(s, container);
  else if (s.typeAffichage === 'tableau') renderCSTable(s, container);
  else renderCSCards(s, container);
}

function csFieldDisplay(field, value) {
  if (value === null || value === undefined || value === '') return '';
  switch (field.type) {
    case 'checkbox': return value ? '✅' : '❌';
    case 'rating': { const n = parseInt(value)||0; return '⭐'.repeat(n)+'☆'.repeat(5-n); }
    case 'color':  return `<span style="display:inline-block;width:12px;height:12px;background:${esc(value)};border-radius:2px;border:1px solid #ccc;vertical-align:middle"></span> ${esc(value)}`;
    case 'image':  return value ? `<img src="${value}" style="max-width:56px;max-height:40px;border-radius:3px;vertical-align:middle">` : '';
    case 'link_personnage': { const c = getProjectData(state.currentProjectId,'personnages').find(x=>x.id===value); return c ? esc([c.prenom,c.nom].filter(Boolean).join(' ')) : ''; }
    case 'link_lieu':      { const l = getProjectData(state.currentProjectId,'lieux').find(x=>x.id===value); return l ? esc(l.nom) : ''; }
    case 'link_chapitre':  { const ch = getProjectData(state.currentProjectId,'chapitres').find(x=>x.id===value); return ch ? esc(`Ch. ${ch.numero} – ${ch.titre}`) : ''; }
    case 'tags':   return Array.isArray(value) ? value.map(t=>`<span class="tag-chip">${esc(t)}</span>`).join(' ') : esc(String(value));
    default: return esc(String(value));
  }
}

function renderCSCards(s, container) {
  const titleF = s.champs.find(f => f.obligatoire && f.type==='text') || s.champs[0];
  const imgF   = s.champs.find(f => f.type==='image');
  container.innerHTML = `<div class="cards-grid">${s.items.map(item => {
    const titleVal = titleF ? esc(item[titleF.id]||'') : '';
    const imgVal   = imgF ? item[imgF.id] : null;
    const media    = imgVal
      ? `<div class="item-card-media"><img src="${imgVal}" alt="image"></div>`
      : `<div class="item-card-media placeholder">${esc(s.icone)}</div>`;
    const extras   = s.champs.filter(f=>f!==titleF&&f.type!=='image').slice(0,3).map(f=>{
      const v = csFieldDisplay(f, item[f.id]);
      return v ? `<div class="item-card-meta"><small><strong>${esc(f.nom)}:</strong> ${v}</small></div>` : '';
    }).join('');
    return `<div class="item-card">
      ${media}
      <div class="item-card-header">
        <div class="item-card-title">${titleVal}</div>
        <div class="item-card-actions">
          <button class="btn-icon" onclick="openCustomItemModal('${item.id}','${s.id}')" title="Modifier">✏️</button>
          <button class="btn-icon" onclick="deleteCustomItemConfirm('${item.id}','${s.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>${extras}
    </div>`;
  }).join('')}</div>`;
}

function renderCSList(s, container) {
  const titleF = s.champs.find(f=>f.obligatoire&&f.type==='text')||s.champs[0];
  container.innerHTML = `<div class="chapters-list">${s.items.map(item => {
    const titleVal = titleF ? esc(item[titleF.id]||'') : item.id;
    const subs = s.champs.filter(f=>f!==titleF).slice(0,2).map(f=>{
      const v = csFieldDisplay(f, item[f.id]);
      return v ? `<div class="chapter-meta">${esc(f.nom)}: ${v}</div>` : '';
    }).join('');
    return `<div class="chapter-item">
      <div class="chapter-body"><div class="chapter-title">${titleVal}</div>${subs}</div>
      <div class="chapter-actions">
        <button class="btn-icon" onclick="openCustomItemModal('${item.id}','${s.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteCustomItemConfirm('${item.id}','${s.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderCSTable(s, container) {
  const headers = s.champs.map(f=>`<th>${esc(f.nom)}</th>`).join('');
  const rows = s.items.map(item => {
    const cells = s.champs.map(f=>`<td>${csFieldDisplay(f,item[f.id])}</td>`).join('');
    return `<tr>${cells}<td style="white-space:nowrap">
      <button class="btn-icon" onclick="openCustomItemModal('${item.id}','${s.id}')">✏️</button>
      <button class="btn-icon" onclick="deleteCustomItemConfirm('${item.id}','${s.id}')">🗑️</button>
    </td></tr>`;
  }).join('');
  container.innerHTML = `<div style="overflow-x:auto"><table class="cs-table">
    <thead><tr>${headers}<th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ---- Section Modal (builder) ----
let _csSectionChamps = [];

function openCustomSectionModal(sectionId = null) {
  const MAX = 20;
  if (!sectionId && getCustomSections().length >= MAX) {
    showToast(`Maximum ${MAX} sections custom atteint`, 'error'); return;
  }
  state.editingId = sectionId;
  _csSectionChamps = [];
  document.getElementById('modal-cs-title').textContent = sectionId ? 'Modifier la section' : 'Nouvelle section';
  document.getElementById('cs-nom').value = '';
  document.getElementById('cs-icone').value = CS_ICONS[0];
  document.getElementById('cs-affichage').value = 'cards';
  document.getElementById('cs-delete-btn').style.display = sectionId ? 'inline-block' : 'none';

  // Populate icon grid
  const grid = document.getElementById('cs-icon-grid');
  if (grid) {
    grid.innerHTML = CS_ICONS.map(ic =>
      `<button type="button" class="cs-icon-btn" onclick="document.getElementById('cs-icone').value='${ic}'">${ic}</button>`
    ).join('');
  }

  if (sectionId) {
    const s = getCustomSections().find(x => x.id === sectionId);
    if (s) {
      document.getElementById('cs-nom').value = s.nom;
      document.getElementById('cs-icone').value = s.icone;
      document.getElementById('cs-affichage').value = s.typeAffichage || 'cards';
      _csSectionChamps = (s.champs || []).map(f => ({...f}));
    }
  }
  renderCSFieldBuilder();
  openModal('modal-custom-section');
  setTimeout(() => document.getElementById('cs-nom').focus(), 80);
}

function renderCSFieldBuilder() {
  const container = document.getElementById('cs-champs-list');
  if (!container) return;
  if (_csSectionChamps.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-400);font-size:13px;margin:8px 0">Aucun champ. Cliquez sur "+ Ajouter un champ".</p>';
    return;
  }
  const typeOptions = CS_FIELD_TYPES.map(t=>`<option value="${t.value}">${t.label}</option>`).join('');
  container.innerHTML = _csSectionChamps.map((f, idx) => `
    <div class="cs-field-row">
      <span class="cs-field-drag">⠿</span>
      <input type="text" class="form-control cs-field-nom" value="${esc(f.nom)}" placeholder="Nom du champ"
             oninput="_csSectionChamps[${idx}].nom=this.value">
      <select class="form-control cs-field-type" onchange="_csSectionChamps[${idx}].type=this.value;renderCSFieldBuilder()">
        ${CS_FIELD_TYPES.map(t=>`<option value="${t.value}" ${f.type===t.value?'selected':''}>${t.label}</option>`).join('')}
      </select>
      <label class="cs-field-req"><input type="checkbox" ${f.obligatoire?'checked':''}
             onchange="_csSectionChamps[${idx}].obligatoire=this.checked"> Requis</label>
      ${f.type==='select'?`<input type="text" class="form-control" style="min-width:150px" placeholder="Option1, Option2..."
             value="${esc((f.options||[]).join(', '))}"
             oninput="_csSectionChamps[${idx}].options=this.value.split(',').map(x=>x.trim()).filter(Boolean)">`:'' }
      <button class="btn-icon" onclick="_csSectionChamps.splice(${idx},1);renderCSFieldBuilder()" title="Supprimer">🗑️</button>
    </div>`).join('');
}

function csAddField() {
  if (_csSectionChamps.length >= 50) { showToast('Maximum 50 champs par section', 'error'); return; }
  _csSectionChamps.push({ id: uid(), nom: '', type: 'text', obligatoire: false, options: [] });
  renderCSFieldBuilder();
}

function saveCustomSection() {
  const nom = document.getElementById('cs-nom').value.trim();
  if (!nom) { showToast('Le nom est requis', 'error'); return; }
  for (const f of _csSectionChamps) {
    if (!f.nom.trim()) { showToast('Tous les champs doivent avoir un nom', 'error'); return; }
  }
  const icone = document.getElementById('cs-icone').value.trim() || '📁';
  const typeAffichage = document.getElementById('cs-affichage').value;
  const sections = getCustomSections();
  if (state.editingId) {
    const idx = sections.findIndex(x => x.id === state.editingId);
    if (idx !== -1) {
      sections[idx] = { ...sections[idx], nom, icone, typeAffichage, champs: _csSectionChamps };
    }
  } else {
    sections.push({ id: uid(), nom, icone, typeAffichage, champs: _csSectionChamps, items: [] });
  }
  saveCustomSections(sections);
  touchProject(state.currentProjectId);
  closeModal('modal-custom-section');
  renderCustomSectionsSidebar();
  showToast(state.editingId ? 'Section modifiée' : 'Section créée', 'success');
  if (!state.editingId) {
    const newS = sections[sections.length - 1];
    setTimeout(() => navigateTo(`custom_${newS.id}`), 100);
  } else {
    renderCustomSectionPage(state.editingId);
  }
  state.editingId = null;
}

function deleteCustomSectionConfirmFromModal() {
  const sId = state.editingId;
  const s = getCustomSections().find(x => x.id === sId);
  if (!s) return;
  showConfirm(`Supprimer "${s.nom}" ?`, 'Tous les éléments seront perdus.', () => {
    const updated = getCustomSections().filter(x => x.id !== sId);
    saveCustomSections(updated);
    touchProject(state.currentProjectId);
    closeModal('modal-confirm');
    closeModal('modal-custom-section');
    renderCustomSectionsSidebar();
    navigateTo('dashboard');
    showToast('Section supprimée', 'success');
  });
}

// ---- Item Modal ----
let _csItemImages = {};

function openCustomItemModal(itemId, sectionId) {
  const s = getCustomSections().find(x => x.id === sectionId);
  if (!s) return;
  state.editingId      = itemId;
  state.editingCsId    = sectionId;
  _csItemImages        = {};
  document.getElementById('modal-ci-title').textContent = itemId ? `Modifier — ${s.nom}` : `Nouveau — ${s.nom}`;
  const existing = itemId ? (s.items||[]).find(x=>x.id===itemId) : null;
  const formEl   = document.getElementById('ci-form-body');
  formEl.innerHTML = s.champs.map(f => buildCustomItemField(f, existing ? existing[f.id] : undefined)).join('');
  // pre-fill image store for existing images
  s.champs.filter(f=>f.type==='image').forEach(f => {
    if (existing && existing[f.id]) _csItemImages[f.id] = existing[f.id];
  });
  openModal('modal-custom-item');
  setTimeout(() => { const first = formEl.querySelector('input,textarea,select'); if (first) first.focus(); }, 80);
}

function buildCustomItemField(f, val) {
  if (val === undefined) val = '';
  const req = f.obligatoire ? ' <span style="color:var(--danger)">*</span>' : '';
  const label = `<label for="ci-${f.id}">${esc(f.nom)}${req}</label>`;
  let input = '';
  switch (f.type) {
    case 'text':
      input = `<input type="text" id="ci-${f.id}" class="form-control" value="${esc(val||'')}">`;
      break;
    case 'textarea':
      input = `<textarea id="ci-${f.id}" class="form-control" rows="3">${esc(val||'')}</textarea>`;
      break;
    case 'number':
      input = `<input type="number" id="ci-${f.id}" class="form-control" value="${esc(String(val||''))}">`;
      break;
    case 'date':
      input = `<input type="date" id="ci-${f.id}" class="form-control" value="${esc(val||'')}">`;
      break;
    case 'color':
      input = `<input type="color" id="ci-${f.id}" class="form-control" style="height:36px;padding:2px 4px" value="${esc(val||'#6366f1')}">`;
      break;
    case 'image':
      input = `<div id="ci-img-prev-${f.id}" style="margin-bottom:6px">
        ${val ? `<img src="${val}" style="max-width:100%;max-height:100px;border-radius:4px">` : ''}
      </div>
      <input type="file" id="ci-${f.id}" accept="image/*" onchange="csItemImagePick('${f.id}',this)">
      ${val ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="csItemImageClear('${f.id}')">Supprimer</button>` : ''}`;
      break;
    case 'checkbox':
      return `<div class="form-group"><label style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="ci-${f.id}" ${val?'checked':''}> ${esc(f.nom)}
      </label></div>`;
    case 'rating': {
      const n = parseInt(val)||0;
      input = `<div class="cs-rating" id="ci-${f.id}" data-value="${n}">
        ${[1,2,3,4,5].map(i=>`<span class="cs-star${i<=n?' active':''}" onclick="csSetRating('ci-${f.id}',${i})">★</span>`).join('')}
      </div>`;
      break;
    }
    case 'select': {
      const opts = (f.options||[]).map(o=>`<option value="${esc(o)}" ${val===o?'selected':''}>${esc(o)}</option>`).join('');
      input = `<select id="ci-${f.id}" class="form-control"><option value="">— Choisir —</option>${opts}</select>`;
      break;
    }
    case 'tags': {
      const tagsStr = Array.isArray(val) ? val.join(', ') : (val||'');
      input = `<input type="text" id="ci-${f.id}" class="form-control" value="${esc(tagsStr)}" placeholder="tag1, tag2">`;
      break;
    }
    case 'link_personnage': {
      const chars = getProjectData(state.currentProjectId,'personnages');
      const opts  = chars.map(c=>`<option value="${c.id}" ${val===c.id?'selected':''}>${esc([c.prenom,c.nom].filter(Boolean).join(' '))}</option>`).join('');
      input = `<select id="ci-${f.id}" class="form-control"><option value="">— Aucun —</option>${opts}</select>`;
      break;
    }
    case 'link_lieu': {
      const lieux = getProjectData(state.currentProjectId,'lieux');
      const opts  = lieux.map(l=>`<option value="${l.id}" ${val===l.id?'selected':''}>${esc(l.nom)}</option>`).join('');
      input = `<select id="ci-${f.id}" class="form-control"><option value="">— Aucun —</option>${opts}</select>`;
      break;
    }
    case 'link_chapitre': {
      const chaps = getProjectData(state.currentProjectId,'chapitres');
      const opts  = chaps.map(c=>`<option value="${c.id}" ${val===c.id?'selected':''}>${esc(`Ch. ${c.numero} – ${c.titre}`)}</option>`).join('');
      input = `<select id="ci-${f.id}" class="form-control"><option value="">— Aucun —</option>${opts}</select>`;
      break;
    }
    default:
      input = `<input type="text" id="ci-${f.id}" class="form-control" value="${esc(val||'')}">`;
  }
  return `<div class="form-group">${label}${input}</div>`;
}

function csItemImagePick(fieldId, inputEl) {
  const file = inputEl.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById(`ci-img-prev-${fieldId}`);
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:100px;border-radius:4px">`;
    _csItemImages[fieldId] = e.target.result;
  };
  reader.readAsDataURL(file);
}
function csItemImageClear(fieldId) {
  delete _csItemImages[fieldId];
  const prev = document.getElementById(`ci-img-prev-${fieldId}`);
  if (prev) prev.innerHTML = '';
  const inp = document.getElementById(`ci-${fieldId}`);
  if (inp) inp.value = '';
}
function csSetRating(containerId, val) {
  const el = document.getElementById(containerId); if (!el) return;
  el.dataset.value = val;
  el.querySelectorAll('.cs-star').forEach((s,i) => s.classList.toggle('active', i < val));
}

function saveCustomItem() {
  const sectionId = state.editingCsId;
  const sections  = getCustomSections();
  const sIdx      = sections.findIndex(x => x.id === sectionId);
  if (sIdx === -1) return;
  const s     = sections[sIdx];
  const data  = {};
  for (const f of s.champs) {
    if (f.type === 'image') {
      data[f.id] = _csItemImages[f.id] || '';
    } else if (f.type === 'checkbox') {
      const el = document.getElementById(`ci-${f.id}`);
      data[f.id] = el ? el.checked : false;
    } else if (f.type === 'rating') {
      const el = document.getElementById(`ci-${f.id}`);
      data[f.id] = el ? parseInt(el.dataset.value)||0 : 0;
    } else if (f.type === 'tags') {
      const el = document.getElementById(`ci-${f.id}`);
      data[f.id] = el ? parseTags(el.value) : [];
    } else {
      const el = document.getElementById(`ci-${f.id}`);
      data[f.id] = el ? el.value.trim() : '';
    }
    if (f.obligatoire) {
      const v = data[f.id];
      const empty = v===''||v===null||v===undefined||(Array.isArray(v)&&v.length===0)||v===0;
      if (f.type==='checkbox'&&!empty) continue;
      if (empty && f.type!=='checkbox') { showToast(`Le champ "${f.nom}" est requis`, 'error'); return; }
    }
  }
  if (!s.items) s.items = [];
  if (state.editingId) {
    const iIdx = s.items.findIndex(x => x.id === state.editingId);
    if (iIdx !== -1) s.items[iIdx] = { ...s.items[iIdx], ...data };
  } else {
    s.items.push({ id: uid(), ...data });
  }
  sections[sIdx] = s;
  saveCustomSections(sections);
  touchProject(state.currentProjectId);
  closeModal('modal-custom-item');
  renderCustomSectionPage(sectionId);
  showToast(state.editingId ? 'Élément modifié' : 'Élément créé', 'success');
  state.editingId = null;
  state.editingCsId = null;
}

function deleteCustomItemConfirm(itemId, sectionId) {
  showConfirm('Supprimer cet élément ?', 'Cette action est irréversible.', () => {
    const sections = getCustomSections();
    const sIdx = sections.findIndex(x => x.id === sectionId);
    if (sIdx === -1) return;
    sections[sIdx].items = (sections[sIdx].items||[]).filter(x => x.id !== itemId);
    saveCustomSections(sections);
    touchProject(state.currentProjectId);
    closeModal('modal-confirm');
    renderCustomSectionPage(sectionId);
    showToast('Élément supprimé', 'success');
  });
}

// Patch navigateTo to intercept custom_* sections
(function() {
  const prev = navigateTo;
  navigateTo = function(section) {
    if (typeof section === 'string' && section.startsWith('custom_')) {
      const sId = section.slice(7);
      state.currentSection = section;
      document.querySelectorAll('.nav-item').forEach(el =>
        el.classList.toggle('active', el.dataset.section === section)
      );
      navigateToCustomSection(sId);
      if (window.innerWidth <= 768) closeSidebarMobile();
    } else {
      prev(section);
    }
  };
})();

// ============================================================
// PLAYLIST TRACKS
// ============================================================
let _plTracks = [];

function plAddTrack(titre = '', artiste = '') {
  _plTracks.push({ id: uid(), titre, artiste });
  renderPlTracksList();
}
function plRemoveTrack(trackId) {
  _plTracks = _plTracks.filter(t => t.id !== trackId);
  renderPlTracksList();
}
function renderPlTracksList() {
  const container = document.getElementById('pl-tracks-list');
  if (!container) return;
  container.innerHTML = _plTracks.map(t => `
    <div class="pl-track-row" data-id="${t.id}">
      <input type="text" class="form-control" placeholder="Titre" value="${esc(t.titre)}"
             oninput="plUpdateTrack('${t.id}','titre',this.value)">
      <input type="text" class="form-control" placeholder="Artiste" value="${esc(t.artiste)}"
             oninput="plUpdateTrack('${t.id}','artiste',this.value)">
      <button class="btn-icon" onclick="plRemoveTrack('${t.id}')" title="Supprimer">🗑️</button>
    </div>`).join('');
}
function plUpdateTrack(trackId, field, value) {
  const t = _plTracks.find(x => x.id === trackId);
  if (t) t[field] = value;
}

// Patch openPlaylistModal to handle tracks
const _origOpenPlaylistModal = openPlaylistModal;
openPlaylistModal = function(plId = null) {
  _plTracks = [];
  _origOpenPlaylistModal(plId);
  if (plId) {
    const pl = getProjectData(state.currentProjectId, 'playlists').find(x => x.id === plId);
    if (pl && Array.isArray(pl.titres)) {
      _plTracks = pl.titres.map(t => ({ id: uid(), ...t }));
    }
  }
  renderPlTracksList();
};

// Single wrapper: read DOM → store tracks → call original savePlaylist
const _origSavePlaylist = savePlaylist;
savePlaylist = function() {
  // 1. Flush DOM inputs into _plTracks
  _plTracks.forEach(t => {
    const row = document.querySelector(`.pl-track-row[data-id="${t.id}"]`);
    if (row) {
      const inputs = row.querySelectorAll('input');
      if (inputs[0]) t.titre   = inputs[0].value.trim();
      if (inputs[1]) t.artiste = inputs[1].value.trim();
    }
  });
  // 2. Store cleaned tracks for the saveProjectData override below
  state._pendingTracks = _plTracks
    .map(t => ({ titre: t.titre || '', artiste: t.artiste || '' }))
    .filter(t => t.titre || t.artiste);
  // 3. Delegate to original
  _origSavePlaylist();
};

// Also need to inject tracks into the playlist object after save.
// Override saveProjectData to intercept playlists saves with pending tracks
const _origSaveProjectData = saveProjectData;
saveProjectData = function(projectId, type, data) {
  if (type === 'playlists' && state._pendingTracks !== undefined) {
    // attach tracks to the last modified playlist (current editing)
    const tracks = state._pendingTracks;
    state._pendingTracks = undefined;
    // The data array already has the updated playlist; find it and attach tracks
    const editId = state.editingId; // may be null if new
    // Actually, at this point state.editingId has been reset by savePlaylist
    // So we find the most recently updated one
    const sorted = [...data].sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0));
    if (sorted.length > 0) sorted[0].titres = tracks;
  }
  _origSaveProjectData(projectId, type, data);
};


// ============================================================
// PROMPT 4: ADVANCED FEATURES
// ============================================================



// ========== EXPORTING PROJECT (patched) ==========
(function() {
  const _origExportProject = exportProject;
  exportProject = function() {
    const id = state.currentProjectId;
    const project = getProjects().find(p => p.id === id);
    if (!project) return;
    
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project,
      personnages: getProjectData(id, 'personnages'),
      lieux: getProjectData(id, 'lieux'),
      relations: getProjectData(id, 'relations'),
      chapitres: getProjectData(id, 'chapitres'),
      scenes: getProjectData(id, 'scenes'),
      playlists: getProjectData(id, 'playlists'),
      events: getProjectData(id, 'events'),
      notes: getProjectData(id, 'notes'),
      customSections: JSON.parse(localStorage.getItem(`projet_${id}_customSections`) || '[]'),
      prefs: getProjectPrefs(id)
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worldbuilder_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Projet exporté', 'success');
  };
})();

// ========== IMPORTING PROJECT (patched) ==========
(function() {
  const _origImportProject = importProject;
  importProject = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.project || typeof data.project !== 'object') {
          showToast('Fichier invalide ou format inconnu', 'error');
          return;
        }
        
        const now = new Date().toISOString();
        const newId = uid();
        const newProj = {
          id: newId,
          name: (data.project.name || 'Projet importé') + ' (copie)',
          description: data.project.description || '',
          createdAt: now,
          updatedAt: now
        };
        
        const list = getProjects();
        list.push(newProj);
        saveProjects(list);
        
        if (Array.isArray(data.personnages)) saveProjectData(newId, 'personnages', data.personnages);
        if (Array.isArray(data.lieux)) saveProjectData(newId, 'lieux', data.lieux);
        if (Array.isArray(data.relations)) saveProjectData(newId, 'relations', data.relations);
        if (Array.isArray(data.chapitres)) saveProjectData(newId, 'chapitres', data.chapitres);
        if (Array.isArray(data.scenes)) saveProjectData(newId, 'scenes', data.scenes);
        if (Array.isArray(data.playlists)) saveProjectData(newId, 'playlists', data.playlists);
        if (Array.isArray(data.events)) saveProjectData(newId, 'events', data.events);
        if (Array.isArray(data.notes)) saveProjectData(newId, 'notes', data.notes);
        if (Array.isArray(data.customSections)) localStorage.setItem(`projet_${newId}_customSections`, JSON.stringify(data.customSections));
        if (data.prefs && typeof data.prefs === 'object') saveProjectPrefs(newId, data.prefs);
        
        showToast(`Projet "${newProj.name}" importé`, 'success');
        openProject(newId);
      } catch (err) {
        showToast('Erreur lors de la lecture du fichier: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
})();

// ============================================================
// ADVANCED BACKUP (IndexedDB, 4-history, age notification)
// ============================================================
const _backupDB = { db: null };

function _openBackupDB() {
  return new Promise((resolve, reject) => {
    if (_backupDB.db) { resolve(_backupDB.db); return; }
    const req = indexedDB.open('worldbuilder_backups', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('backups')) {
        const store = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
        store.createIndex('projectId', 'projectId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = e => { _backupDB.db = e.target.result; resolve(_backupDB.db); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function createAdvancedBackup(projectId) {
  if (!projectId) return;
  try {
    const db = await _openBackupDB();
    const project = getProjects().find(p => p.id === projectId);
    const payload = {
      projectId,
      projectName: project?.name || 'Projet',
      timestamp:   Date.now(),
      data:        _exportProjectData(projectId),
    };
    const tx    = db.transaction('backups', 'readwrite');
    const store = tx.objectStore('backups');
    store.add(payload);

    // Keep only latest 4 backups per project
    const idx   = store.index('projectId');
    const req   = idx.getAll(projectId);
    req.onsuccess = () => {
      const all = req.result.sort((a, b) => b.timestamp - a.timestamp);
      all.slice(4).forEach(old => store.delete(old.id));
    };

    // Update lastBackup in prefs
    const prefs = getProjectPrefs(projectId);
    prefs.lastBackup = new Date().toISOString();
    saveProjectPrefs(projectId, prefs);
    showToast('Backup créé', 'success');
  } catch (err) {
    showToast('Backup échoué : ' + err.message, 'error');
  }
}

async function listBackups(projectId) {
  try {
    const db    = await _openBackupDB();
    const tx    = db.transaction('backups', 'readonly');
    const store = tx.objectStore('backups');
    const idx   = store.index('projectId');
    return new Promise(resolve => {
      const req = idx.getAll(projectId);
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
      req.onerror   = () => resolve([]);
    });
  } catch { return []; }
}

async function restoreBackup(backupId) {
  try {
    const db  = await _openBackupDB();
    const tx  = db.transaction('backups', 'readonly');
    const req = tx.objectStore('backups').get(backupId);
    req.onsuccess = () => {
      const b = req.result;
      if (!b) { showToast('Backup introuvable', 'error'); return; }
      showConfirm(`Restaurer le backup du ${new Date(b.timestamp).toLocaleString('fr')} ?`, () => {
        _importProjectData(b.projectId, b.data);
        showToast('Backup restauré', 'success');
        if (state.currentProjectId === b.projectId) navigateTo(state.currentSection);
      });
    };
  } catch (err) { showToast('Erreur restauration : ' + err.message, 'error'); }
}

async function openBackupManager() {
  if (!state.currentProjectId) return;
  const backups = await listBackups(state.currentProjectId);
  const prefs   = getProjectPrefs(state.currentProjectId);

  // Age notification
  let ageHtml = '';
  if (prefs.lastBackup) {
    const days = Math.floor((Date.now() - new Date(prefs.lastBackup).getTime()) / 86400000);
    if (days >= 7) ageHtml = `<div class="backup-warning">⚠️ Dernier backup il y a ${days} jours</div>`;
  } else {
    ageHtml = `<div class="backup-warning">⚠️ Aucun backup créé</div>`;
  }

  const listHtml = backups.length
    ? backups.map(b => `
        <div class="backup-item">
          <div>
            <strong>${new Date(b.timestamp).toLocaleString('fr')}</strong>
            <span class="backup-size">${Math.round(JSON.stringify(b.data).length / 1024)} KB</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="restoreBackup(${b.id})">Restaurer</button>
        </div>`).join('')
    : '<p style="color:var(--gray-400);font-size:13px">Aucun backup disponible.</p>';

  document.getElementById('backup-manager-content').innerHTML = ageHtml + listHtml;
  openModal('modal-backup-manager');
}

function _exportProjectData(projectId) {
  const types = ['personnages','lieux','chapitres','scenes','relations','playlists','events','notes','manuscrit'];
  const data = {};
  types.forEach(t => { data[t] = getProjectData(projectId, t); });
  data.prefs = getProjectPrefs(projectId);
  return data;
}

function _importProjectData(projectId, data) {
  if (!data) return;
  const types = ['personnages','lieux','chapitres','scenes','relations','playlists','events','notes','manuscrit'];
  types.forEach(t => { if (Array.isArray(data[t])) saveProjectData(projectId, t, data[t]); });
  if (data.prefs) saveProjectPrefs(projectId, data.prefs);
}

// Check backup age on project open
function checkBackupAge(projectId) {
  const prefs = getProjectPrefs(projectId);
  if (!prefs.lastBackup) return;
  const days = Math.floor((Date.now() - new Date(prefs.lastBackup).getTime()) / 86400000);
  if (days >= 7) {
    setTimeout(() => showToast(`💾 Backup il y a ${days} jours — pensez à sauvegarder !`), 2000);
  }
}

// ============================================================
// SEASONAL THEMES
// ============================================================
const SEASONAL_PALETTES = {
  printemps: { primary: '#E91E8C', dark: '#C2185B', light: '#FCE4EC', name: 'Printemps 🌸' },
  ete:       { primary: '#FF8C00', dark: '#E65100', light: '#FFF3E0', name: 'Été ☀️' },
  automne:   { primary: '#8B4513', dark: '#6D2C0A', light: '#FBE9E7', name: 'Automne 🍂' },
  hiver:     { primary: '#1565C0', dark: '#0D47A1', light: '#E3F2FD', name: 'Hiver ❄️' },
};

function detectDominantSeason(projectId) {
  const events = getProjectData(projectId, 'events');
  if (!events.length) return null;
  const months = { printemps: 0, ete: 0, automne: 0, hiver: 0 };
  events.forEach(ev => {
    if (!ev.date) return;
    const m = new Date(ev.date).getMonth(); // 0-11
    if (m >= 2 && m <= 4)  months.printemps++;
    else if (m >= 5 && m <= 7) months.ete++;
    else if (m >= 8 && m <= 10) months.automne++;
    else months.hiver++;
  });
  return Object.entries(months).sort((a, b) => b[1] - a[1])[0][0];
}

function applySeasonalTheme(season) {
  const palette = SEASONAL_PALETTES[season];
  if (!palette) { removeSeasonalTheme(); return; }
  const root = document.documentElement;
  root.style.setProperty('--primary',       palette.primary);
  root.style.setProperty('--primary-dark',  palette.dark);
  root.style.setProperty('--primary-light', palette.light);
  root.style.setProperty('--primary-text',  palette.dark);
  document.body.dataset.season = season;
}

function removeSeasonalTheme() {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-dark');
  root.style.removeProperty('--primary-light');
  root.style.removeProperty('--primary-text');
  delete document.body.dataset.season;
}

function toggleSeasonalTheme(on, manual = null) {
  const id = state.currentProjectId;
  if (!id) return;
  const prefs = getProjectPrefs(id);
  prefs.seasonalTheme = on;
  if (on && manual) prefs.seasonalOverride = manual;
  else if (!on) delete prefs.seasonalOverride;
  saveProjectPrefs(id, prefs);

  if (on) {
    const season = manual || detectDominantSeason(id);
    if (season) applySeasonalTheme(season);
  } else {
    removeSeasonalTheme();
    // Restore accent from prefs
    if (prefs.appearance?.accent) document.documentElement.style.setProperty('--primary', prefs.appearance.accent);
  }
  showToast(on ? `Thème saisonnier activé` : 'Thème saisonnier désactivé');
}

function initSeasonalTheme(projectId) {
  const prefs = getProjectPrefs(projectId);
  if (prefs.seasonalTheme) {
    const season = prefs.seasonalOverride || detectDominantSeason(projectId);
    if (season) applySeasonalTheme(season);
  }
}
