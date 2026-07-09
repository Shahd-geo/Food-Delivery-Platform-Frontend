
import {
  getRestaurants,
  getRestaurantsByCuisine,
  searchRestaurantsByName,
  ApiError,
} from './api.js';

// Cuisine chips shown in the filter row. 'All' always resets the list.
// Extend this list to match whatever cuisines your seed data actually has.
const CUISINES = ['All', 'Arabic', 'Italian', 'Indian', 'Fast Food', 'Desserts', 'Healthy'];

// -----------------------------------------------------------------
// DOM refs
// -----------------------------------------------------------------
const el = {
  searchInput: document.getElementById('searchInput'),
  chipRow: document.getElementById('chipRow'),
  grid: document.getElementById('restaurantGrid'),
  pageBanner: document.getElementById('pageBanner'),
};

// -----------------------------------------------------------------
// State
// -----------------------------------------------------------------
let activeCuisine = 'All';
let searchTerm = '';
let searchDebounceHandle = null;
let requestToken = 0; // guards against out-of-order async responses

// -----------------------------------------------------------------
// Rendering helpers (loading / ready / empty / error)
// -----------------------------------------------------------------
function renderSkeletons() {
  el.grid.innerHTML = Array.from({ length: 6 })
    .map(
      () => `
      <div class="card restaurant-card">
        <div class="skeleton" style="height:120px;margin:calc(var(--space-4)*-1) calc(var(--space-4)*-1) var(--space-3)"></div>
        <div class="skeleton skeleton--line" style="width:70%"></div>
        <div class="skeleton skeleton--line" style="width:40%"></div>
        <div class="skeleton skeleton--line" style="width:90%"></div>
      </div>`
    )
    .join('');
}

function renderEmpty(message) {
  el.grid.innerHTML = `
    <div class="empty" style="grid-column:1/-1">
      <div class="empty__icon">🔍</div>
      <p>${escapeHtml(message)}</p>
    </div>`;
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function money(n) {
  return Number(n || 0).toFixed(3);
}

// -----------------------------------------------------------------
// Chip row
// -----------------------------------------------------------------
function renderChips() {
  el.chipRow.innerHTML = CUISINES.map(
    (c) => `
    <button type="button" class="filter-chip ${c === activeCuisine ? 'filter-chip--active' : ''}" data-cuisine="${escapeHtml(c)}">
      ${escapeHtml(c)}
    </button>`
  ).join('');

  el.chipRow.querySelectorAll('[data-cuisine]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCuisine = btn.dataset.cuisine;
      renderChips();
      loadRestaurants();
    });
  });
}

// -----------------------------------------------------------------
// Load + render restaurant grid
// -----------------------------------------------------------------
async function loadRestaurants() {
  const myToken = ++requestToken;
  clearPageError();
  renderSkeletons();

  try {
    let data;
    if (searchTerm.trim()) {
      data = await searchRestaurantsByName(searchTerm.trim());
    } else if (activeCuisine !== 'All') {
      data = await getRestaurantsByCuisine(activeCuisine);
    } else {
      data = await getRestaurants();
    }

    // a newer request has since started — drop this stale response
    if (myToken !== requestToken) return;

    renderGrid(data || []);
  } catch (err) {
    if (myToken !== requestToken) return;
    el.grid.innerHTML = '';
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    showPageError(message, loadRestaurants);
  }
}

function renderGrid(restaurants) {
  if (!restaurants.length) {
    renderEmpty(
      searchTerm.trim()
        ? 'No restaurants match your search.'
        : 'No restaurants available right now.'
    );
    return;
  }

  el.grid.innerHTML = restaurants.map(restaurantCardHtml).join('');
}

function restaurantCardHtml(r) {
  const rating = r.averageRating; // may be absent from the DTO — hide if null
  const paused = r.acceptingOrders === false;

  return `
    <article class="card restaurant-card">
      <div class="restaurant-card__thumb" aria-hidden="true">
        <span class="badge restaurant-card__badge ${paused ? 'badge--muted' : 'badge--success'}">
          ${paused ? 'Paused' : 'Open'}
        </span>
      </div>
      <div class="restaurant-card__top">
        <h2 class="restaurant-card__title">${escapeHtml(r.name)}</h2>
        ${
          rating != null
            ? `<span class="restaurant-card__rating">⭐ ${Number(rating).toFixed(1)}</span>`
            : ''
        }
      </div>

      <div class="chip">${escapeHtml(r.cuisineType || 'Cuisine')}</div>

      <div class="restaurant-card__row">
        <span>Delivery fee</span>
        <strong>${r.deliveryFee != null ? money(r.deliveryFee) + ' OMR' : '—'}</strong>
      </div>
      <div class="restaurant-card__row">
        <span>Min order</span>
        <strong>${r.minOrderAmount != null ? money(r.minOrderAmount) + ' OMR' : '—'}</strong>
      </div>

      <a
        href="${paused ? '#' : `menu.html?restaurantId=${r.id}`}"
        class="btn ${paused ? 'btn--muted' : 'btn--brand'}"
        ${paused ? 'aria-disabled="true" tabindex="-1" style="pointer-events:none"' : ''}
      >
        ${paused ? 'Paused' : 'View Menu'}
      </a>
    </article>`;
}

// -----------------------------------------------------------------
// Search box — debounced ~300ms, then re-query the API
// -----------------------------------------------------------------
el.searchInput.addEventListener('input', () => {
  searchTerm = el.searchInput.value;
  clearTimeout(searchDebounceHandle);
  searchDebounceHandle = setTimeout(loadRestaurants, 300);
});

// -----------------------------------------------------------------
// Boot
// -----------------------------------------------------------------
renderChips();
loadRestaurants();
