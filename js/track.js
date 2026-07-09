
import { getOrder, getOrderTimeline, getOrderEta, ApiError } from './api.js';

const STAGES = ['PENDING', 'PREPARING', 'READY', 'DELIVERED'];
const STAGE_LABELS = {
  PENDING: 'Order placed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
};

const POLL_INTERVAL_MS = 5000;

const params = new URLSearchParams(location.search);
const orderId = Number(params.get('orderId'));

const el = {
  pageBanner: document.getElementById('pageBanner'),
  orderIdLabel: document.getElementById('orderIdLabel'),
  etaCountdown: document.getElementById('etaCountdown'),
  timeline: document.getElementById('timeline'),
  orderDetails: document.getElementById('orderDetails'),
};

let pollHandle = null;
let countdownHandle = null;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function money(n) {
  return Number(n || 0).toFixed(3);
}

function showPageError(message, onRetry) {
  el.pageBanner.innerHTML = `
    <div class="banner banner--error">
      <span>${escapeHtml(message)}</span>
      <button type="button" id="retryBtn">Retry</button>
    </div>`;
  document.getElementById('retryBtn').addEventListener('click', onRetry);
}

function clearPageError() {
  el.pageBanner.innerHTML = '';
}

function readStatus(order) {
  return order.status || order.orderStatus || 'PENDING';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// -----------------------------------------------------------------
// Initial guard: no orderId in the URL
// -----------------------------------------------------------------
if (!orderId) {
  el.etaCountdown.textContent = '—';
  showPageError('No order id was given. Open this page as track.html?orderId=123.', () => location.reload());
} else {
  el.orderIdLabel.textContent = `Order #${orderId}`;
  boot();
}

async function boot() {
  await refreshAll();
  pollHandle = setInterval(refreshAll, POLL_INTERVAL_MS);

  // don't hammer the API while the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(pollHandle);
    } else {
      refreshAll();
      pollHandle = setInterval(refreshAll, POLL_INTERVAL_MS);
    }
  });
}

// -----------------------------------------------------------------
// Poll: order + timeline + eta together each tick
// -----------------------------------------------------------------
async function refreshAll() {
  try {
    const [order, timeline, eta] = await Promise.all([
      getOrder(orderId),
      getOrderTimeline(orderId).catch(() => []), // timeline is supplementary — don't block the page on it
      getOrderEta(orderId).catch(() => null),
    ]);

    clearPageError();
    renderOrderDetails(order);
    renderTimeline(readStatus(order), timeline);
    renderCountdown(readStatus(order), eta);

    if (readStatus(order) === 'DELIVERED' || readStatus(order) === 'CANCELLED') {
      clearInterval(pollHandle);
    }
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Could not load this order. Please try again.';
    showPageError(message, refreshAll);
  }
}

// -----------------------------------------------------------------
// Timeline
// -----------------------------------------------------------------
function renderTimeline(status, timeline) {
  if (status === 'CANCELLED') {
    el.timeline.innerHTML = `
      <div class="timeline__node is-cancelled" style="flex:1">
        <div class="timeline__dot"></div>
        <div class="timeline__label">Cancelled</div>
      </div>`;
    return;
  }

  const currentIndex = STAGES.indexOf(status);
  const timestamps = {};
  (timeline || []).forEach((entry) => {
    const key = entry.status || entry.stage;
    const ts = entry.timestamp || entry.changedAt || entry.occurredAt;
    if (key) timestamps[key] = ts;
  });

  el.timeline.innerHTML = STAGES.map((stage, i) => {
    let state = 'is-pending';
    if (i < currentIndex) state = 'is-completed';
    else if (i === currentIndex) state = 'is-current';

    return `
      <div class="timeline__node ${state}">
        <div class="timeline__dot"></div>
        <div class="timeline__label">${STAGE_LABELS[stage]}</div>
        <div class="timeline__time">${formatTime(timestamps[stage])}</div>
      </div>`;
  }).join('');
}

// -----------------------------------------------------------------
// ETA countdown
// -----------------------------------------------------------------
function readEtaSeconds(eta) {
  if (!eta) return null;
  if (typeof eta.etaSeconds === 'number') return eta.etaSeconds;
  if (typeof eta.etaMinutes === 'number') return eta.etaMinutes * 60;
  if (eta.estimatedDeliveryTime) {
    const diffMs = new Date(eta.estimatedDeliveryTime).getTime() - Date.now();
    return diffMs > 0 ? Math.round(diffMs / 1000) : 0;
  }
  return null;
}

function renderCountdown(status, eta) {
  clearInterval(countdownHandle);

  if (status === 'CANCELLED') {
    el.etaCountdown.textContent = 'Order cancelled';
    el.etaCountdown.className = 'eta-card__countdown eta-card__countdown--cancelled';
    return;
  }

  if (status === 'DELIVERED') {
    el.etaCountdown.textContent = 'Delivered ✓';
    el.etaCountdown.className = 'eta-card__countdown eta-card__countdown--done';
    return;
  }

  let secondsLeft = readEtaSeconds(eta);
  el.etaCountdown.className = 'eta-card__countdown';

  if (secondsLeft == null) {
    el.etaCountdown.textContent = 'Calculating…';
    return;
  }

  tickCountdown(secondsLeft);
  countdownHandle = setInterval(() => {
    secondsLeft -= 1;
    tickCountdown(secondsLeft);
    if (secondsLeft <= 0) clearInterval(countdownHandle);
  }, 1000);
}

function tickCountdown(secondsLeft) {
  if (secondsLeft <= 0) {
    el.etaCountdown.textContent = 'Any minute now';
    return;
  }
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  el.etaCountdown.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

// -----------------------------------------------------------------
// Order details panel
// -----------------------------------------------------------------
function renderOrderDetails(order) {

const items = order.orderItems || [];

let html = "";

items.forEach(item => {

html += `

<div class="order-details__row">

<span>

${escapeHtml(item.menuItem.name)}
× ${item.quantity}

</span>

<span>

${money(item.totalPrice)} OMR

</span>

</div>

`;

});

html += `

<div class="order-details__row">

<span><strong>Total</strong></span>

<span><strong>${money(order.totalAmount)} OMR</strong></span>

</div>

<div class="order-details__row">

<span>Status</span>

<span class="badge">

${escapeHtml(order.status)}

</span>

</div>

`;

el.orderDetails.innerHTML = html;

}


document.getElementById("restaurantName").textContent =
order.restaurant?.name || "Restaurant";

document.getElementById("orderIdLabel").textContent =
order.orderCode || `Order #${order.id}`;
