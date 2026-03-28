/**
 * VroomX TMS – PDF Import Extension
 * Popup script — primary import trigger
 */

'use strict';

// ─── DOM refs ────────────────────────────────────────────────────────────────

const importHero = document.getElementById('import-hero');
const importIcon = document.getElementById('import-icon');
const importTitle = document.getElementById('import-title');
const importDesc = document.getElementById('import-desc');
const importBtn = document.getElementById('import-btn');
const importStatus = document.getElementById('import-status');

const statusDot = document.getElementById('status-dot');
const statusTitleEl = document.getElementById('status-title');
const statusSubtitleEl = document.getElementById('status-subtitle');
const importCountRow = document.getElementById('import-count-row');
const importCountEl = document.getElementById('import-count');

const connectBtn = document.getElementById('connect-btn');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const vroomxUrlInput = document.getElementById('vroomx-url');
const saveBtn = document.getElementById('save-btn');
const disconnectBtn = document.getElementById('disconnect-btn');

// ─── State ───────────────────────────────────────────────────────────────────

let vroomxUrl = 'http://localhost:3000';
let currentTabId = null;
let isAuthenticated = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendMessage(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload: payload || {} }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: 'No response' });
      }
    });
  });
}

// ─── PDF Tab Detection ───────────────────────────────────────────────────────

async function detectCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return resolve();
      const tab = tabs[0];
      currentTabId = tab.id;
      resolve();
    });
  });
}

function updateImportHero() {
  // Always show the import button — let the user decide when to import
  importHero.classList.remove('no-pdf');
  importIcon.innerHTML = '&#x1F4E5;';
  importTitle.textContent = 'Import Dispatch Sheet';
  importDesc.textContent = 'Open a dispatch sheet PDF, then click below to extract orders using AI.';
  importBtn.disabled = !isAuthenticated || !currentTabId;
  importBtn.textContent = isAuthenticated
    ? 'Import to VroomX'
    : 'Sign in to VroomX first';
}

// ─── Auth Check ──────────────────────────────────────────────────────────────

async function checkAuth() {
  statusDot.className = 'status-dot loading';
  statusTitleEl.textContent = 'Checking...';
  statusSubtitleEl.textContent = '';

  const response = await sendMessage('GET_AUTH_STATUS');

  if (response.authenticated && response.user) {
    isAuthenticated = true;
    statusDot.className = 'status-dot connected';
    statusTitleEl.textContent = 'Connected';
    statusSubtitleEl.textContent = response.user.email || '';
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';

    // Import count
    chrome.storage.local.get({ vroomx_import_count: 0 }, (items) => {
      importCountRow.style.display = 'block';
      importCountEl.textContent = (items.vroomx_import_count || 0).toLocaleString();
    });
  } else {
    isAuthenticated = false;
    statusDot.className = 'status-dot disconnected';
    statusTitleEl.textContent = 'Not connected';
    statusSubtitleEl.textContent = '';
    connectBtn.style.display = 'block';
    connectBtn.href = `${vroomxUrl}/login`;
    disconnectBtn.style.display = 'none';
    importCountRow.style.display = 'none';
  }

  updateImportHero();
}

// ─── Import Handler ──────────────────────────────────────────────────────────

function setImportStatus(msg, type) {
  importStatus.style.display = msg ? 'block' : 'none';
  importStatus.className = 'import-status ' + (type || '');
  importStatus.textContent = msg;
}

async function handleImport() {
  if (importBtn.disabled) return;

  importBtn.disabled = true;
  importBtn.textContent = 'Extracting orders...';
  setImportStatus('Sending PDF to VroomX for AI extraction...', 'loading');

  try {
    const response = await sendMessage('IMPORT_PDF_FROM_TAB', { tabId: currentTabId });

    if (!response || !response.success) {
      if (response?.code === 'AUTH_REQUIRED') {
        setImportStatus('Please sign in to VroomX first.', 'error');
        connectBtn.style.display = 'block';
      } else {
        setImportStatus(response?.error || 'Import failed.', 'error');
      }
      return;
    }

    const count = response.orderCount || 0;
    setImportStatus(
      `Extracted ${count} order${count !== 1 ? 's' : ''}! Review tab opened.`,
      'success'
    );
    importBtn.textContent = 'Imported!';

    // Update count
    chrome.storage.local.get({ vroomx_import_count: 0 }, (items) => {
      importCountEl.textContent = (items.vroomx_import_count || 0).toLocaleString();
    });
  } catch (err) {
    setImportStatus(err.message || 'Import failed.', 'error');
  } finally {
    setTimeout(() => {
      importBtn.disabled = false;
      importBtn.textContent = 'Import to VroomX';
    }, 3000);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

function initSettings() {
  settingsToggle.addEventListener('click', () => {
    const open = settingsPanel.classList.toggle('visible');
    settingsToggle.classList.toggle('open', open);
  });

  saveBtn.addEventListener('click', async () => {
    const val = vroomxUrlInput.value.trim().replace(/\/$/, '');
    if (!val) return;
    try { new URL(val); } catch { return; }

    await chrome.storage.sync.set({ vroomxUrl: val });
    vroomxUrl = val;

    saveBtn.textContent = 'Saved!';
    saveBtn.classList.add('saved');
    setTimeout(() => {
      saveBtn.textContent = 'Save';
      saveBtn.classList.remove('saved');
    }, 1800);

    checkAuth();
  });

  disconnectBtn.addEventListener('click', async () => {
    await sendMessage('CLEAR_AUTH');
    checkAuth();
  });
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  // Load saved URL
  const stored = await new Promise((r) =>
    chrome.storage.sync.get({ vroomxUrl: 'http://localhost:3000' }, r)
  );
  vroomxUrl = stored.vroomxUrl || 'http://localhost:3000';
  vroomxUrlInput.value = vroomxUrl;

  initSettings();
  importBtn.addEventListener('click', handleImport);

  await detectCurrentTab();
  await checkAuth();
}

document.addEventListener('DOMContentLoaded', init);
