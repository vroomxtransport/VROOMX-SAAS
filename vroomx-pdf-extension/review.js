/**
 * VroomX TMS – PDF Import Extension
 * Review page script
 *
 * Loads pending orders from chrome.storage.session, renders editable cards,
 * validates, and submits via CONFIRM_IMPORT to background.js.
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_TYPES = ['COD', 'COP', 'CHECK', 'BILL', 'SPLIT'];
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;
const MAX_YEAR = 2028;

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Array<Object>} */
let orders = [];
let isImporting = false;
let vroomxUrl = 'http://localhost:3000';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const pageBody = document.getElementById('page-body');
const importFooter = document.getElementById('import-footer');
const orderCountBadge = document.getElementById('order-count-badge');
const footerOrderCount = document.getElementById('footer-order-count');
const importBtn = document.getElementById('import-btn');
const importBtnLabel = document.getElementById('import-btn-label');
const cancelBtn = document.getElementById('cancel-btn');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: 'No response' });
      }
    });
  });
}

function escape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '$—';
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getField(order, key, fallback = '') {
  return order[key] !== undefined && order[key] !== null ? order[key] : fallback;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a single order object.
 * Returns an array of error strings.
 */
function validateOrder(order) {
  const errors = [];

  const year = parseInt(order.year, 10);
  if (!order.year || isNaN(year) || year < MIN_YEAR || year > MAX_YEAR) {
    errors.push(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }

  if (!order.make || String(order.make).trim() === '') {
    errors.push('Make is required.');
  }

  if (!order.model || String(order.model).trim() === '') {
    errors.push('Model is required.');
  }

  if (!order.pickupCity || String(order.pickupCity).trim() === '') {
    errors.push('Pickup city is required.');
  }

  if (!order.pickupState || String(order.pickupState).trim().length !== 2) {
    errors.push('Pickup state must be a 2-character code.');
  }

  if (!order.deliveryCity || String(order.deliveryCity).trim() === '') {
    errors.push('Delivery city is required.');
  }

  if (!order.deliveryState || String(order.deliveryState).trim().length !== 2) {
    errors.push('Delivery state must be a 2-character code.');
  }

  const revenue = parseFloat(order.revenue);
  if (isNaN(revenue) || revenue < 0) {
    errors.push('Revenue must be 0 or greater.');
  }

  return errors;
}

/**
 * Collect live form values from a card's DOM back into the order object.
 */
function syncOrderFromDOM(index) {
  const card = document.querySelector(`[data-order-index="${index}"]`);
  if (!card) return;

  const getVal = (name) => {
    const el = card.querySelector(`[data-field="${name}"]`);
    return el ? el.value : '';
  };

  orders[index] = {
    ...orders[index],
    year: getVal('year'),
    make: getVal('make'),
    model: getVal('model'),
    vin: getVal('vin'),
    vehicleType: getVal('vehicleType'),
    color: getVal('color'),
    pickupLocation: getVal('pickupLocation'),
    pickupCity: getVal('pickupCity'),
    pickupState: getVal('pickupState').toUpperCase(),
    pickupZip: getVal('pickupZip'),
    pickupContactName: getVal('pickupContactName'),
    pickupContactPhone: getVal('pickupContactPhone'),
    pickupDate: getVal('pickupDate'),
    deliveryLocation: getVal('deliveryLocation'),
    deliveryCity: getVal('deliveryCity'),
    deliveryState: getVal('deliveryState').toUpperCase(),
    deliveryZip: getVal('deliveryZip'),
    deliveryContactName: getVal('deliveryContactName'),
    deliveryContactPhone: getVal('deliveryContactPhone'),
    deliveryDate: getVal('deliveryDate'),
    revenue: getVal('revenue'),
    carrierPay: getVal('carrierPay'),
    brokerFee: getVal('brokerFee'),
    paymentType: getVal('paymentType'),
  };
}

function updateOrderSummary(index) {
  const order = orders[index];
  const card = document.querySelector(`[data-order-index="${index}"]`);
  if (!card) return;

  const summaryEl = card.querySelector('.order-summary');
  const badgeEl = card.querySelector('.validation-badge');

  const year = order.year || '—';
  const make = order.make || 'Unknown';
  const model = order.model || 'Model';
  const pickupCity = order.pickupCity || '?';
  const pickupState = order.pickupState || '?';
  const deliveryCity = order.deliveryCity || '?';
  const deliveryState = order.deliveryState || '?';
  const revenue = formatMoney(order.revenue);

  summaryEl.innerHTML = `<strong>${year} ${escape(make)} ${escape(model)}</strong> &mdash; <em>${escape(pickupCity)}, ${escape(pickupState)} &rarr; ${escape(deliveryCity)}, ${escape(deliveryState)}</em> &mdash; ${revenue}`;

  const errors = validateOrder(order);
  if (errors.length === 0) {
    badgeEl.className = 'validation-badge valid';
    badgeEl.textContent = '✓ Valid';
    card.classList.remove('has-errors');
  } else {
    badgeEl.className = 'validation-badge invalid';
    badgeEl.textContent = `✗ ${errors.length} error${errors.length !== 1 ? 's' : ''}`;
    card.classList.add('has-errors');
  }
}

function updateGlobalCounts() {
  const count = orders.length;
  orderCountBadge.textContent = count;
  footerOrderCount.textContent = `${count} order${count !== 1 ? 's' : ''}`;
  importBtnLabel.textContent = `Import ${count} Order${count !== 1 ? 's' : ''}`;
}

// ─── Card Builder ─────────────────────────────────────────────────────────────

function buildField({ label, name, type = 'text', required = false, extraClass = '', placeholder = '' }) {
  const inputType = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text';
  const inputClass = `field-input${extraClass ? ' ' + extraClass : ''}`;
  return `
    <div class="form-field">
      <label class="field-label">${label}${required ? ' *' : ''}</label>
      <input
        type="${inputType}"
        class="${inputClass}"
        data-field="${name}"
        placeholder="${placeholder}"
        ${required ? 'required' : ''}
        ${type === 'number' ? 'min="0" step="0.01"' : ''}
      />
      ${required ? `<span class="field-error">Required</span>` : ''}
    </div>
  `;
}

function buildSelectField({ label, name, options }) {
  const optionsHtml = options.map((o) => `<option value="${o}">${o}</option>`).join('');
  return `
    <div class="form-field">
      <label class="field-label">${label}</label>
      <select class="field-input" data-field="${name}">
        ${optionsHtml}
      </select>
    </div>
  `;
}

function buildOrderCard(order, index) {
  const errors = validateOrder(order);
  const hasErrors = errors.length > 0;

  const year = order.year || '—';
  const make = order.make || 'Unknown';
  const model = order.model || 'Model';
  const pickupCity = order.pickupCity || '?';
  const pickupState = order.pickupState || '?';
  const deliveryCity = order.deliveryCity || '?';
  const deliveryState = order.deliveryState || '?';
  const revenue = formatMoney(order.revenue);

  const summaryHtml = `<strong>${year} ${escape(make)} ${escape(model)}</strong> &mdash; <em>${escape(pickupCity)}, ${escape(pickupState)} &rarr; ${escape(deliveryCity)}, ${escape(deliveryState)}</em> &mdash; ${revenue}`;

  const badgeClass = hasErrors ? 'invalid' : 'valid';
  const badgeText = hasErrors ? `✗ ${errors.length} error${errors.length !== 1 ? 's' : ''}` : '✓ Valid';

  return `
    <div class="order-card${hasErrors ? ' has-errors' : ''}" data-order-index="${index}">
      <div class="order-card-header">
        <span class="order-number">#${index + 1}</span>
        <span class="order-summary">${summaryHtml}</span>
        <span class="validation-badge ${badgeClass}">${badgeText}</span>
        <span class="chevron-icon">▲</span>
      </div>

      <div class="order-form">
        <!-- Vehicle -->
        <div class="form-section">
          <h3 class="form-section-title">🚗 Vehicle</h3>
          <div class="form-grid">
            ${buildField({ label: 'Year', name: 'year', type: 'number', required: true, placeholder: '2024' })}
            ${buildField({ label: 'Make', name: 'make', required: true, placeholder: 'Ford' })}
            ${buildField({ label: 'Model', name: 'model', required: true, placeholder: 'F-150' })}
            ${buildField({ label: 'Color', name: 'color', placeholder: 'White' })}
            ${buildField({ label: 'Type', name: 'vehicleType', placeholder: 'Truck' })}
            ${buildField({ label: 'VIN', name: 'vin', extraClass: 'vin-input', placeholder: '1FTFW1ET...' })}
          </div>
        </div>

        <!-- Pickup -->
        <div class="form-section">
          <h3 class="form-section-title">📦 Pickup</h3>
          <div class="form-grid">
            ${buildField({ label: 'Location / Dealer', name: 'pickupLocation', placeholder: 'ABC Auction' })}
            ${buildField({ label: 'City', name: 'pickupCity', required: true, placeholder: 'Atlanta' })}
            ${buildField({ label: 'State', name: 'pickupState', required: true, placeholder: 'GA' })}
            ${buildField({ label: 'ZIP', name: 'pickupZip', placeholder: '30301' })}
            ${buildField({ label: 'Contact Name', name: 'pickupContactName', placeholder: 'John Smith' })}
            ${buildField({ label: 'Contact Phone', name: 'pickupContactPhone', placeholder: '555-000-1234' })}
            ${buildField({ label: 'Date', name: 'pickupDate', type: 'date' })}
          </div>
        </div>

        <!-- Delivery -->
        <div class="form-section">
          <h3 class="form-section-title">📍 Delivery</h3>
          <div class="form-grid">
            ${buildField({ label: 'Location / Dealer', name: 'deliveryLocation', placeholder: 'XYZ Dealership' })}
            ${buildField({ label: 'City', name: 'deliveryCity', required: true, placeholder: 'Miami' })}
            ${buildField({ label: 'State', name: 'deliveryState', required: true, placeholder: 'FL' })}
            ${buildField({ label: 'ZIP', name: 'deliveryZip', placeholder: '33101' })}
            ${buildField({ label: 'Contact Name', name: 'deliveryContactName', placeholder: 'Jane Doe' })}
            ${buildField({ label: 'Contact Phone', name: 'deliveryContactPhone', placeholder: '555-000-5678' })}
            ${buildField({ label: 'Date', name: 'deliveryDate', type: 'date' })}
          </div>
        </div>

        <!-- Pricing -->
        <div class="form-section">
          <h3 class="form-section-title">💰 Pricing</h3>
          <div class="form-grid">
            ${buildField({ label: 'Revenue ($)', name: 'revenue', type: 'number', required: true, placeholder: '0.00' })}
            ${buildField({ label: 'Carrier Pay ($)', name: 'carrierPay', type: 'number', placeholder: '0.00' })}
            ${buildField({ label: 'Broker Fee ($)', name: 'brokerFee', type: 'number', placeholder: '0.00' })}
            ${buildSelectField({ label: 'Payment Type', name: 'paymentType', options: PAYMENT_TYPES })}
          </div>
        </div>

        <!-- Error message area for import errors -->
        <div class="order-error-msg" id="order-error-${index}"></div>

        <!-- Remove -->
        <div class="order-remove-btn">
          <button class="btn-remove" data-remove-index="${index}">Remove Order</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Populate form values ─────────────────────────────────────────────────────

function populateCardValues(card, order) {
  const fields = [
    'year', 'make', 'model', 'vin', 'vehicleType', 'color',
    'pickupLocation', 'pickupCity', 'pickupState', 'pickupZip',
    'pickupContactName', 'pickupContactPhone', 'pickupDate',
    'deliveryLocation', 'deliveryCity', 'deliveryState', 'deliveryZip',
    'deliveryContactName', 'deliveryContactPhone', 'deliveryDate',
    'revenue', 'carrierPay', 'brokerFee', 'paymentType',
  ];

  for (const field of fields) {
    const el = card.querySelector(`[data-field="${field}"]`);
    if (!el) continue;
    const val = order[field];
    if (val !== undefined && val !== null) {
      el.value = String(val);
    }
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderOrders() {
  if (orders.length === 0) {
    pageBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <h2>No orders to review</h2>
        <p>No order data was found. Please try importing the PDF again.</p>
      </div>
    `;
    importFooter.style.display = 'none';
    return;
  }

  const html = orders.map((order, i) => buildOrderCard(order, i)).join('');
  pageBody.innerHTML = html;

  // Populate values into inputs
  orders.forEach((order, i) => {
    const card = document.querySelector(`[data-order-index="${i}"]`);
    if (card) populateCardValues(card, order);
  });

  // Attach event listeners
  attachCardListeners();

  importFooter.style.display = 'flex';
  updateGlobalCounts();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function attachCardListeners() {
  // Toggle expand/collapse on header click
  document.querySelectorAll('.order-card-header').forEach((header) => {
    header.addEventListener('click', () => {
      const card = header.closest('.order-card');
      card.classList.toggle('expanded');
    });
  });

  // Live update summary on any input change
  document.querySelectorAll('.order-form input, .order-form select').forEach((input) => {
    input.addEventListener('change', () => {
      const card = input.closest('[data-order-index]');
      if (!card) return;
      const index = parseInt(card.dataset.orderIndex, 10);
      syncOrderFromDOM(index);
      updateOrderSummary(index);

      // Remove error styling on fix
      if (input.classList.contains('error')) {
        const errors = validateOrder(orders[index]);
        if (errors.length === 0) input.classList.remove('error');
      }
    });

    // Real-time input feedback for required fields
    input.addEventListener('blur', () => {
      if (input.hasAttribute('required') && !input.value.trim()) {
        input.classList.add('error');
      } else {
        input.classList.remove('error');
      }
    });
  });

  // Remove order buttons
  document.querySelectorAll('[data-remove-index]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.removeIndex, 10);
      handleRemoveOrder(index);
    });
  });
}

function handleRemoveOrder(index) {
  const order = orders[index];
  const label = `${order.year || '?'} ${order.make || 'Unknown'} ${order.model || ''}`.trim();

  const confirmed = window.confirm(`Remove order: "${label}"?\n\nThis action cannot be undone.`);
  if (!confirmed) return;

  orders.splice(index, 1);
  renderOrders();
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function handleImport() {
  if (isImporting || orders.length === 0) return;

  // Sync all cards before validating
  orders.forEach((_, i) => syncOrderFromDOM(i));

  // Validate all orders
  let allValid = true;
  orders.forEach((order, i) => {
    const errors = validateOrder(order);
    if (errors.length > 0) {
      allValid = false;
      // Expand invalid card and highlight required fields
      const card = document.querySelector(`[data-order-index="${i}"]`);
      if (card) {
        card.classList.add('expanded');

        // Highlight empty required inputs
        card.querySelectorAll('input[required]').forEach((inp) => {
          if (!inp.value.trim()) inp.classList.add('error');
        });

        // Show year range error specifically
        const yearInput = card.querySelector('[data-field="year"]');
        if (yearInput) {
          const yr = parseInt(yearInput.value, 10);
          if (isNaN(yr) || yr < MIN_YEAR || yr > MAX_YEAR) {
            yearInput.classList.add('error');
          }
        }
      }
    }
  });

  if (!allValid) {
    // Scroll to first error card
    const firstError = document.querySelector('.order-card.has-errors');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Start import
  isImporting = true;
  importBtn.disabled = true;
  importBtnLabel.innerHTML = '<span class="spinner"></span> Importing...';

  // Clear previous per-order errors
  document.querySelectorAll('.order-error-msg').forEach((el) => {
    el.classList.remove('visible');
    el.textContent = '';
  });

  const response = await sendMessage('CONFIRM_IMPORT', { orders });

  isImporting = false;
  importBtn.disabled = false;

  if (response.success && !response.error) {
    // Build success UI
    const count = orders.length;
    const resultHtml = `
      <div class="result-banner success">
        <div class="result-icon">🎉</div>
        <h2 class="result-title">Successfully imported ${count} order${count !== 1 ? 's' : ''}!</h2>
        <p class="result-subtitle">
          Your orders are now in VroomX TMS and ready to dispatch.
        </p>
        <a href="${vroomxUrl}/dashboard/orders" target="_blank" class="result-link">
          View Orders in VroomX →
        </a>
      </div>
    `;
    pageBody.innerHTML = resultHtml;
    importFooter.style.display = 'none';
  } else {
    // Handle errors — may include per-order errors from the API
    importBtnLabel.textContent = `Import ${orders.length} Order${orders.length !== 1 ? 's' : ''}`;

    const errorPayload = response.orderErrors;
    if (errorPayload && typeof errorPayload === 'object') {
      // Per-order errors: { [orderIndex]: errorMessage }
      Object.entries(errorPayload).forEach(([idxStr, msg]) => {
        const idx = parseInt(idxStr, 10);
        const errEl = document.getElementById(`order-error-${idx}`);
        if (errEl) {
          errEl.textContent = `Import error: ${msg}`;
          errEl.classList.add('visible');
          // Expand the card
          const card = document.querySelector(`[data-order-index="${idx}"]`);
          if (card) card.classList.add('expanded');
        }
      });

      // Scroll to first errored card
      const firstErrorCard = document.querySelector('.order-card.expanded');
      if (firstErrorCard) firstErrorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Generic error — show at top
      const errorBanner = document.createElement('div');
      errorBanner.className = 'result-banner error';
      errorBanner.innerHTML = `
        <div class="result-icon">⚠️</div>
        <h2 class="result-title">Import failed</h2>
        <p class="result-subtitle">${response.error || 'An unexpected error occurred. Please try again.'}</p>
      `;
      pageBody.insertBefore(errorBanner, pageBody.firstChild);
      pageBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

function handleCancel() {
  if (isImporting) return;

  if (orders.length > 0) {
    const confirmed = window.confirm('Cancel import? All extracted data will be lost.');
    if (!confirmed) return;
  }

  // Clear session storage and close tab
  chrome.storage.session.remove('pendingOrders', () => {
    window.close();
  });
}

// ─── Load VroomX URL ──────────────────────────────────────────────────────────

async function loadVroomXUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ vroomxUrl: 'http://localhost:3000' }, (items) => {
      vroomxUrl = items.vroomxUrl || 'http://localhost:3000';
      resolve(vroomxUrl);
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadVroomXUrl();

  // Load pending orders from session storage
  chrome.storage.session.get('pendingOrders', (data) => {
    const pending = data.pendingOrders;

    if (!pending || !Array.isArray(pending) || pending.length === 0) {
      pageBody.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <h2>No orders to review</h2>
          <p>
            No pending order data was found.<br />
            Please navigate to a dispatch sheet PDF and click <strong>"Import to VroomX"</strong>.
          </p>
        </div>
      `;
      importFooter.style.display = 'none';
      orderCountBadge.textContent = '0';
      return;
    }

    orders = pending;
    renderOrders();
  });

  // Footer actions
  importBtn.addEventListener('click', handleImport);
  cancelBtn.addEventListener('click', handleCancel);
}

document.addEventListener('DOMContentLoaded', init);
