/**
 * VroomX TMS - PDF Import Extension
 * Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * - Auth token retrieval and caching
 * - PDF fetch + forwarding to VroomX API
 * - Confirm import coordination
 * - Review tab management
 * - PDF tab badge management
 */

'use strict';

// M11: load build-time config from config.js. importScripts is the
// MV3 service-worker equivalent of <script src> for non-module workers.
// All deployment identifiers live in config.js so a different environment
// (staging/dev) can be targeted by editing one file.
importScripts('config.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_PROJECT_REF = VROOMX_CONFIG.SUPABASE_PROJECT_REF;
const DEFAULT_VROOMX_URL = VROOMX_CONFIG.DEFAULT_VROOMX_URL;
const SESSION_TOKEN_KEY = VROOMX_CONFIG.SESSION_TOKEN_KEY;
const SESSION_USER_KEY = VROOMX_CONFIG.SESSION_USER_KEY;
const STORAGE_IMPORT_COUNT_KEY = VROOMX_CONFIG.STORAGE_IMPORT_COUNT_KEY;
const PENDING_ORDERS_KEY = VROOMX_CONFIG.PENDING_ORDERS_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the configured VroomX base URL (no trailing slash).
 */
async function getVroomXUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ vroomxUrl: DEFAULT_VROOMX_URL }, (items) => {
      resolve((items.vroomxUrl || DEFAULT_VROOMX_URL).replace(/\/$/, ''));
    });
  });
}

/**
 * Attempt to parse a Supabase auth cookie value.
 * Cookie values are JSON strings: { access_token, refresh_token, user, ... }
 */
function parseSupabaseCookie(rawValue) {
  try {
    // Cookie value may be URL-encoded
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Retrieve the auth token.
 * Strategy:
 *   1. Check chrome.storage.session for a cached token.
 *   2. Read the Supabase sb-* cookie from the VroomX domain.
 *   3. Fall back to GET /api/extension/auth with credentials.
 *
 * Returns { token, user } or throws.
 */
async function getAuthToken() {
  const vroomxUrl = await getVroomXUrl();

  // 1. Check session cache first
  const sessionData = await new Promise((resolve) => {
    chrome.storage.session.get([SESSION_TOKEN_KEY, SESSION_USER_KEY], resolve);
  });

  if (sessionData[SESSION_TOKEN_KEY]) {
    return {
      token: sessionData[SESSION_TOKEN_KEY],
      user: sessionData[SESSION_USER_KEY] || null,
    };
  }

  // 2. Try reading the Supabase cookie from the VroomX domain
  const urlObj = new URL(vroomxUrl);
  const domain = urlObj.hostname;

  const cookies = await new Promise((resolve) => {
    chrome.cookies.getAll({ domain }, resolve);
  });

  // Supabase auth cookies are named sb-<project-ref>-auth-token or sb-<ref>-auth-token.0 etc.
  const supabaseCookies = cookies.filter(
    (c) =>
      c.name.startsWith(`sb-${SUPABASE_PROJECT_REF}-auth-token`) ||
      c.name.startsWith('sb-') && c.name.includes('auth-token')
  );

  if (supabaseCookies.length > 0) {
    // Prefer the base cookie (no numeric suffix)
    const baseCookie =
      supabaseCookies.find((c) => !c.name.match(/\.\d+$/)) ||
      supabaseCookies[0];

    const parsed = parseSupabaseCookie(baseCookie.value);

    if (parsed && parsed.access_token) {
      const user = parsed.user
        ? { email: parsed.user.email, tenantId: parsed.user.user_metadata?.tenant_id || null }
        : null;

      // Cache in session storage
      await chrome.storage.session.set({
        [SESSION_TOKEN_KEY]: parsed.access_token,
        [SESSION_USER_KEY]: user,
      });

      return { token: parsed.access_token, user };
    }
  }

  // 3. Fall back to the extension auth endpoint
  const response = await fetch(`${vroomxUrl}/api/extension/auth`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('AUTH_REQUIRED');
  }

  const data = await response.json();

  // Auth endpoint returns { authenticated, accessToken, user }
  const accessToken = data.accessToken || data.token;
  if (!data.authenticated || !accessToken) {
    throw new Error('AUTH_REQUIRED');
  }

  const user = data.user
    ? { email: data.user.email, tenantId: data.user.tenantId || null }
    : null;

  await chrome.storage.session.set({
    [SESSION_TOKEN_KEY]: accessToken,
    [SESSION_USER_KEY]: user,
  });

  return { token: accessToken, user };
}

/**
 * Clear cached session tokens (called on auth errors).
 */
async function clearCachedToken() {
  await chrome.storage.session.remove([SESSION_TOKEN_KEY, SESSION_USER_KEY]);
}

/**
 * Increment the local import count counter.
 */
async function incrementImportCount(count) {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_IMPORT_COUNT_KEY]: 0 }, resolve);
  });
  await chrome.storage.local.set({
    [STORAGE_IMPORT_COUNT_KEY]: data[STORAGE_IMPORT_COUNT_KEY] + count,
  });
}

// ─── Message Handlers ─────────────────────────────────────────────────────────

/**
 * Handle GET_AUTH_STATUS
 * Returns { authenticated, user }
 */
async function handleGetAuthStatus() {
  try {
    const { token, user } = await getAuthToken();
    return { authenticated: !!token, user };
  } catch {
    return { authenticated: false, user: null };
  }
}

/**
 * Handle IMPORT_PDF
 * 1. Auth check
 * 2. Fetch the PDF binary from the tab's URL
 * 3. POST to /api/extension/import-pdf
 * 4. Return extracted orders
 */
/**
 * Try to find the actual PDF URL from a Central Dispatch web viewer page.
 * Injects a script to look for <embed>, <iframe>, or <object> with a PDF source.
 */
async function findEmbeddedPdfUrl(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Look for embedded PDF elements
        const embed = document.querySelector('embed[type="application/pdf"]');
        if (embed && embed.src) return embed.src;

        const iframe = document.querySelector('iframe[src*=".pdf"]');
        if (iframe) return iframe.src;

        const object = document.querySelector('object[type="application/pdf"]');
        if (object && object.data) return object.data;

        // Look for any iframe or embed with a src
        const anyEmbed = document.querySelector('embed[src]');
        if (anyEmbed && anyEmbed.src) return anyEmbed.src;

        const anyIframe = document.querySelector('iframe[src]');
        if (anyIframe && anyIframe.src) return anyIframe.src;

        // Check for blob URLs used by PDF.js-style viewers
        const canvas = document.querySelector('canvas');
        if (canvas) return null; // PDF.js renders to canvas, no direct URL

        return null;
      },
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

async function handleImportPdf(sender) {
  const tabUrl = sender.tab?.url;
  const tabId = sender.tab?.id;
  if (!tabUrl) {
    throw new Error('No URL available from current tab.');
  }

  let token;
  let user;
  try {
    ({ token, user } = await getAuthToken());
  } catch {
    const err = new Error('Please log in to VroomX TMS first.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  const vroomxUrl = await getVroomXUrl();

  // Determine the actual PDF URL to fetch
  let pdfUrl = tabUrl;
  const isCentralDispatch = tabUrl.toLowerCase().includes('centraldispatch.com');

  if (isCentralDispatch && tabId) {
    // Central Dispatch uses a web-based PDF viewer — try to find the embedded PDF
    const embeddedUrl = await findEmbeddedPdfUrl(tabId);
    if (embeddedUrl) {
      pdfUrl = embeddedUrl;
    }
    // If no embedded URL found, try fetching the page URL directly —
    // some CD pages serve the PDF directly at the page URL
  }

  // Fetch the PDF binary
  let pdfBlob;
  try {
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    const contentType = pdfResponse.headers.get('content-type') || '';

    // If we got HTML instead of a PDF, the URL was the viewer page, not the PDF itself
    if (contentType.includes('text/html') && isCentralDispatch) {
      // Try to use the page as-is — our AI parser can handle dispatch sheet images/screenshots too
      // But first, try printing the page to PDF via the tab
      throw new Error(
        'Could not find the PDF file on this page. Try opening the dispatch sheet PDF directly (use "Save As" or the download button on the page, then open the saved PDF).'
      );
    }

    pdfBlob = await pdfResponse.blob();
  } catch (fetchErr) {
    throw new Error(fetchErr.message || `Could not retrieve PDF file.`);
  }

  // Build FormData and POST to VroomX
  const formData = new FormData();
  const filename = pdfUrl.split('/').pop()?.split('?')[0] || 'dispatch.pdf';
  formData.append('file', pdfBlob, filename);
  formData.append('sourceUrl', tabUrl);

  const importResponse = await fetch(`${vroomxUrl}/api/extension/import-pdf`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (importResponse.status === 401) {
    await clearCachedToken();
    const err = new Error('Session expired. Please log in to VroomX TMS again.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  if (!importResponse.ok) {
    const errorBody = await importResponse.json().catch(() => ({}));
    throw new Error(errorBody.error || `Import failed (${importResponse.status})`);
  }

  const result = await importResponse.json();

  if (!result.orders || !Array.isArray(result.orders)) {
    throw new Error('Unexpected response from VroomX API — no orders returned.');
  }

  return { orders: result.orders, user };
}

/**
 * Handle CONFIRM_IMPORT
 * POST the reviewed orders to /api/extension/confirm
 */
async function handleConfirmImport(orders) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('No orders provided for import.');
  }

  let token;
  try {
    ({ token } = await getAuthToken());
  } catch {
    const err = new Error('Please log in to VroomX TMS first.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  const vroomxUrl = await getVroomXUrl();

  const confirmResponse = await fetch(`${vroomxUrl}/api/extension/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orders }),
  });

  if (confirmResponse.status === 401) {
    await clearCachedToken();
    const err = new Error('Session expired. Please log in to VroomX TMS again.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }

  if (!confirmResponse.ok) {
    const errorBody = await confirmResponse.json().catch(() => ({}));
    throw new Error(errorBody.error || `Confirm failed (${confirmResponse.status})`);
  }

  const result = await confirmResponse.json();

  // Track import count locally
  await incrementImportCount(orders.length);

  return result;
}

/**
 * Handle OPEN_REVIEW
 * Stash orders in session storage then open the review tab.
 */
async function handleOpenReview(orders) {
  await chrome.storage.session.set({ [PENDING_ORDERS_KEY]: orders });

  const reviewUrl = chrome.runtime.getURL('review.html');
  const tab = await chrome.tabs.create({ url: reviewUrl, active: true });

  return { tabId: tab.id };
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  const handleAsync = async () => {
    switch (type) {
      case 'GET_AUTH_STATUS':
        return await handleGetAuthStatus();

      case 'IMPORT_PDF': {
        const result = await handleImportPdf(sender);
        // After successful extraction, open the review tab
        await handleOpenReview(result.orders);
        return { success: true, orderCount: result.orders.length };
      }

      case 'IMPORT_PDF_FROM_TAB': {
        // Called from popup — use the provided tabId to get the URL
        const tabId = payload?.tabId;
        if (!tabId) throw new Error('No tab ID provided.');
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url) throw new Error('Could not read tab URL.');
        const fakeImportResult = await handleImportPdf({ tab });
        await handleOpenReview(fakeImportResult.orders);
        return { success: true, orderCount: fakeImportResult.orders.length };
      }

      case 'CONFIRM_IMPORT':
        return await handleConfirmImport(payload?.orders);

      case 'OPEN_REVIEW':
        return await handleOpenReview(payload?.orders);

      case 'CLEAR_AUTH':
        await clearCachedToken();
        return { success: true };

      default:
        return { error: `Unknown message type: ${type}` };
    }
  };

  handleAsync()
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((err) => {
      console.error('[VroomX Extension]', type, err);
      sendResponse({
        success: false,
        error: err.message || 'An unexpected error occurred.',
        code: err.code || 'UNKNOWN',
      });
    });

  // Keep message channel open for async response
  return true;
});

// ─── Tab Monitoring — PDF Badge ──────────────────────────────────────────────

/**
 * Detect if a tab contains a dispatch sheet or PDF.
 * Matches:
 *  - Direct .pdf URLs
 *  - Central Dispatch dispatch sheet viewer (web-based PDF viewer, no .pdf in URL)
 *  - Pages with "Dispatch Sheet" in the title
 */
function isDispatchOrPdf(url, title) {
  if (!url) return false;
  const lower = url.toLowerCase();
  const stripped = lower.split('?')[0].split('#')[0];

  // Direct PDF file URLs
  if (stripped.endsWith('.pdf')) return true;
  if (lower.includes('.pdf?')) return true;

  // Central Dispatch dispatch sheet viewer
  if (lower.includes('centraldispatch.com')) return true;

  // Title-based detection
  const lowerTitle = (title || '').toLowerCase();
  if (lowerTitle.includes('.pdf')) return true;
  if (lowerTitle.includes('dispatch sheet')) return true;

  return false;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  if (isDispatchOrPdf(tab.url, tab.title)) {
    chrome.action.setBadgeText({ text: 'PDF', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
    chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

// ─── Context Menu ────────────────────────────────────────────────────────────

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'vroomx-import',
      title: 'Import to VroomX',
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'vroomx-import' || !tab) return;

  try {
    const result = await handleImportPdf({ tab });
    await handleOpenReview(result.orders);
  } catch (err) {
    console.error('[VroomX Extension] Context menu import error:', err);
  }
});

// ─── Install / Startup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  // Set up context menu on every install/update
  setupContextMenu();

  if (details.reason === 'install') {
    chrome.storage.sync.set({ vroomxUrl: DEFAULT_VROOMX_URL });
    chrome.storage.local.set({ [STORAGE_IMPORT_COUNT_KEY]: 0 });
    console.log('[VroomX Extension] Installed successfully.');
  }
});
