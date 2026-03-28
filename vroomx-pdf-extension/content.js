/**
 * VroomX TMS — PDF Import Extension
 * Content Script for Central Dispatch pages
 *
 * Injects an "Import to VroomX" button into Central Dispatch's
 * PDF viewer toolbar — matching the Ship.Cars button placement.
 *
 * Only runs on app.centraldispatch.com / centraldispatch.com pages.
 */

(function () {
  'use strict';

  // Guard against double injection
  if (window.__vroomxInjected) return;
  window.__vroomxInjected = true;

  // ─── Constants ───────────────────────────────────────────────────────────────

  const BUTTON_ID = 'vroomx-import-btn';
  const RETRY_INTERVAL = 500;  // ms between toolbar search retries
  const MAX_RETRIES = 30;      // 15 seconds max wait

  // ─── State ───────────────────────────────────────────────────────────────────

  let isImporting = false;
  let retryCount = 0;

  // ─── PING handler for background.js ──────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') sendResponse({ pong: true });
  });

  // ─── Create the Import Button ────────────────────────────────────────────────

  function createImportButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.innerHTML = '&#x26A1; Import to VroomX';

    Object.assign(btn.style, {
      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '700',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.35)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.15s ease',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
      marginLeft: '8px',
      verticalAlign: 'middle',
      height: '28px',
    });

    btn.addEventListener('mouseenter', () => {
      if (!isImporting) {
        btn.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.45)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (!isImporting) {
        btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        btn.style.transform = 'none';
        btn.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.35)';
      }
    });

    btn.addEventListener('click', handleImport);

    return btn;
  }

  // ─── Create Floating Button (fallback) ───────────────────────────────────────

  function createFloatingButton() {
    const btn = createImportButton();

    Object.assign(btn.style, {
      position: 'fixed',
      top: '12px',
      right: '16px',
      zIndex: '999999',
      padding: '10px 18px',
      fontSize: '14px',
      height: 'auto',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
    });

    return btn;
  }

  // ─── Import Handler ──────────────────────────────────────────────────────────

  async function handleImport(e) {
    e.preventDefault();
    e.stopPropagation();

    if (isImporting) return;
    isImporting = true;

    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:vroomx-spin 0.7s linear infinite"></span> Extracting...';
      btn.style.opacity = '0.85';
      btn.style.cursor = 'wait';
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'IMPORT_PDF' });

      if (!response || !response.success) {
        const code = response?.code;
        if (code === 'AUTH_REQUIRED') {
          showNotification('Please log in to VroomX TMS first.', 'error');
        } else {
          showNotification(response?.error || 'Import failed.', 'error');
        }
        return;
      }

      const count = response.orderCount || 0;
      showNotification(
        `Extracted ${count} order${count !== 1 ? 's' : ''}! Review tab opened.`,
        'success'
      );
    } catch (err) {
      console.error('[VroomX] Import error:', err);
      showNotification(err.message || 'Import failed.', 'error');
    } finally {
      isImporting = false;
      if (btn) {
        btn.innerHTML = '&#x26A1; Import to VroomX';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }
  }

  // ─── Notification Toast ──────────────────────────────────────────────────────

  function showNotification(message, type) {
    // Remove any existing notification
    const existing = document.getElementById('vroomx-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'vroomx-notification';

    const isError = type === 'error';
    const borderColor = isError ? '#ef4444' : '#22c55e';
    const icon = isError ? '\u2717' : '\u2713';
    const iconColor = borderColor;

    Object.assign(toast.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '1000000',
      background: '#1e293b',
      border: `1px solid ${borderColor}`,
      borderRadius: '10px',
      padding: '12px 16px',
      color: '#e2e8f0',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: '13px',
      lineHeight: '1.4',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      maxWidth: '340px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      animation: 'vroomx-slide-in 0.25s ease-out',
    });

    toast.innerHTML = `<span style="color:${iconColor};font-size:16px;flex-shrink:0">${icon}</span>` +
      `<span style="flex:1">${escapeHtml(message)}</span>` +
      `<button style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;padding:0;line-height:1" id="vroomx-close-toast">&times;</button>`;

    document.body.appendChild(toast);

    const closeBtn = document.getElementById('vroomx-close-toast');
    if (closeBtn) closeBtn.addEventListener('click', () => toast.remove());

    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Inject Keyframes ────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('vroomx-styles')) return;
    const style = document.createElement('style');
    style.id = 'vroomx-styles';
    style.textContent = `
      @keyframes vroomx-spin { to { transform: rotate(360deg); } }
      @keyframes vroomx-slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ─── Find and inject into toolbar ────────────────────────────────────────────

  function tryInjectIntoToolbar() {
    // Already injected?
    if (document.getElementById(BUTTON_ID)) return true;

    // Strategy 1: Look for PDF.js toolbar
    // PDF.js uses #toolbarContainer or #toolbarViewer
    const pdfJsToolbar =
      document.getElementById('toolbarViewer') ||
      document.getElementById('toolbarContainer') ||
      document.getElementById('toolbar');

    if (pdfJsToolbar) {
      // Find the right side of the toolbar to inject our button
      const rightSection =
        pdfJsToolbar.querySelector('#toolbarViewerRight') ||
        pdfJsToolbar.querySelector('.toolbar-right') ||
        pdfJsToolbar.querySelector('[class*="right"]');

      if (rightSection) {
        rightSection.prepend(createImportButton());
        console.log('[VroomX] Button injected into PDF.js toolbar (right section)');
        return true;
      }

      // No right section found — just append to toolbar
      const btn = createImportButton();
      btn.style.marginLeft = '12px';
      pdfJsToolbar.appendChild(btn);
      console.log('[VroomX] Button injected into PDF.js toolbar (appended)');
      return true;
    }

    // Strategy 2: Look for any toolbar-like element
    // Central Dispatch might use custom classes
    const selectors = [
      // Common toolbar selectors
      '[class*="toolbar"]',
      '[class*="Toolbar"]',
      '[class*="pdf-toolbar"]',
      '[class*="viewer-toolbar"]',
      '[class*="header-bar"]',
      '[class*="action-bar"]',
      // Look for the bar with zoom controls (visible in screenshot)
      '[class*="zoom"]',
    ];

    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const el of candidates) {
        // Must be visible and reasonably sized (toolbar-like)
        const rect = el.getBoundingClientRect();
        if (rect.height > 20 && rect.height < 80 && rect.width > 200) {
          el.appendChild(createImportButton());
          console.log(`[VroomX] Button injected via selector: ${selector}`);
          return true;
        }
      }
    }

    // Strategy 3: Look for the specific CD dispatch sheet toolbar
    // CD shows page nav + zoom + tools in a bar at the top
    const headerBars = document.querySelectorAll('header, nav, [role="toolbar"], [role="banner"]');
    for (const bar of headerBars) {
      const rect = bar.getBoundingClientRect();
      if (rect.height > 20 && rect.height < 80 && rect.top < 60) {
        bar.appendChild(createImportButton());
        console.log('[VroomX] Button injected into header/nav bar');
        return true;
      }
    }

    return false;
  }

  // ─── Init with retries ──────────────────────────────────────────────────────

  function init() {
    injectStyles();

    // Try to inject into toolbar
    if (tryInjectIntoToolbar()) return;

    // Retry with interval — page might still be loading
    const interval = setInterval(() => {
      retryCount++;

      if (tryInjectIntoToolbar()) {
        clearInterval(interval);
        return;
      }

      if (retryCount >= MAX_RETRIES) {
        clearInterval(interval);
        // Fallback: floating button
        console.log('[VroomX] Toolbar not found after retries — using floating button');
        document.body.appendChild(createFloatingButton());
      }
    }, RETRY_INTERVAL);

    // Also watch for DOM changes (SPA navigation, dynamic loading)
    const observer = new MutationObserver(() => {
      if (document.getElementById(BUTTON_ID)) return; // Already there
      if (tryInjectIntoToolbar()) {
        observer.disconnect();
        clearInterval(interval);
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Disconnect observer after 30 seconds to save resources
    setTimeout(() => observer.disconnect(), 30000);
  }

  // ─── Start ───────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
