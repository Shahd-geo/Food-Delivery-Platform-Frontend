
import {
  getRestaurant,
  getMenu,
  getCombos,
  createOrder,
  addOrderItem,
  confirmOrder,
  ApiError,
} from './api.js';


const DEMO_CUSTOMER_ID = 1;

const params = new URLSearchParams(location.search);
const restaurantId = Number(params.get('restaurantId')) || 1;

const el = {
  restaurantName: document.getElementById('restaurantName'),
  restaurantMeta: document.getElementById('restaurantMeta'),
  combosSection: document.getElementById('combosSection'),
  comboStrip: document.getElementById('comboStrip'),
  menuList: document.getElementById('menuList'),
  cartLines: document.getElementById('cartLines'),
  cartCount: document.getElementById('cartCount'),
  subtotal: document.getElementById('subtotal'),
  deliveryFee: document.getElementById('deliveryFee'),
  total: document.getElementById('total'),
  minOrderNote: document.getElementById('minOrderNote'),
  placeOrderBtn: document.getElementById('placeOrderBtn'),
  pageBanner: document.getElementById('pageBanner'),
  cartFab: document.getElementById('cartFab'),
  cartFabCount: document.getElementById('cartFabCount'),
  cartDrawerOverlay: document.getElementById('cartDrawerOverlay'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  // mobile drawer mirrors of the desktop cart panel
  cartLinesMobile: document.getElementById('cartLinesMobile'),
  subtotalMobile: document.getElementById('subtotalMobile'),
  deliveryFeeMobile: document.getElementById('deliveryFeeMobile'),
  totalMobile: document.getElementById('totalMobile'),
  minOrderNoteMobile: document.getElementById('minOrderNoteMobile'),
  placeOrderBtnMobile: document.getElementById('placeOrderBtnMobile'),
};


let restaurant = null;       // RestaurantResponseDTO
let menuItems = [];          // MenuItemResponseDTO[]
let combos = [];             // ComboResponseDTO[]

// cart line shape: { menuItemId, name, unitPrice, qty, isCombo }
let cart = [];

let placingOrder = false;

function renderSkeletons(container, count, height = 72) {
  container.innerHTML = Array.from({ length: count })
    .map(() => `<div class="card skeleton" style="height:${height}px"></div>`)
    .join('');
}

function renderEmpty(container, message) {
  container.innerHTML = `
    <div class="empty">
      <div class="empty__icon">🍽️</div>
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


async function loadRestaurant() {
  el.restaurantName.textContent = 'Loading…';
  el.restaurantMeta.innerHTML = `<span class="skeleton skeleton--line" style="width:160px;display:inline-block"></span>`;

  try {
    restaurant = await getRestaurant(restaurantId);
    renderRestaurantHead();
  } catch (err) {
    el.restaurantName.textContent = 'Restaurant unavailable';
    el.restaurantMeta.textContent = '';
    handleLoadError(err, loadRestaurant);
  }
}

function renderRestaurantHead() {
  el.restaurantName.textContent = restaurant.name;

  const parts = [];
  if (restaurant.cuisineType) {
    parts.push(`<span class="badge badge--muted">${escapeHtml(restaurant.cuisineType)}</span>`);
  }
  parts.push(
    restaurant.acceptingOrders
      ? `<span class="badge badge--success">Open</span>`
      : `<span class="badge badge--danger">Paused</span>`
  );
  if (restaurant.openingTime && restaurant.closingTime) {
    parts.push(`<span>${restaurant.openingTime.slice(0, 5)}–${restaurant.closingTime.slice(0, 5)}</span>`);
  }
  el.restaurantMeta.innerHTML = parts.join(' · ');
}

// -----------------------------------------------------------------
// Load: combos strip
// -----------------------------------------------------------------
async function loadCombos() {
  renderSkeletons(el.comboStrip, 2, 88);

  try {
    combos = await getCombos(restaurantId);
    renderCombos();
  } catch (err) {
    // Combos are a bonus strip — a failure here shouldn't block the
    // whole page, so show an inline error banner in that section only.
    el.comboStrip.innerHTML = `
      <div class="banner banner--error" style="grid-column:1/-1">
        <span>Couldn't load combos.</span>
        <button type="button" id="retryCombos">Retry</button>
      </div>`;
    document.getElementById('retryCombos').addEventListener('click', loadCombos);
  }
}

function renderCombos() {
  if (!combos.length) {
    el.combosSection.style.display = 'none';
    return;
  }
  el.combosSection.style.display = '';

  el.comboStrip.innerHTML = combos
    .filter((c) => c.isAvailable)
    .map((combo) => {
      const qty = cartQtyForCombo(combo.id);
      return `
      <div class="card combo-card">
        <div class="combo-card__thumb" aria-hidden="true"></div>
        <div class="combo-card__body">
          <p class="combo-card__name">${escapeHtml(combo.comboName)}</p>
          <p class="combo-card__desc">${escapeHtml(combo.description || '')}</p>
          <span class="combo-card__price">${money(combo.totalPrice)} <span class="unit">OMR</span></span>
        </div>
        ${
          qty > 0
            ? stepperHtml(`combo-${combo.id}`, qty)
            : `<button type="button" class="btn btn--ghost" data-add-combo="${combo.id}">+ Add</button>`
        }
      </div>`;
    })
    .join('');

  el.comboStrip.querySelectorAll('[data-add-combo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const combo = combos.find((c) => c.id === Number(btn.dataset.addCombo));
      addToCart({
        menuItemId: combo.id,
        name: combo.comboName,
        unitPrice: combo.totalPrice,
        isCombo: true,
      });
    });
  });

  wireSteppers(el.comboStrip);
}

function cartQtyForCombo(comboId) {
  const line = cart.find((l) => l.isCombo && l.menuItemId === comboId);
  return line ? line.qty : 0;
}

// -----------------------------------------------------------------
// Load: menu items
// -----------------------------------------------------------------
async function loadMenu() {
  renderSkeletons(el.menuList, 5, 72);

  try {
    menuItems = await getMenu(restaurantId);
    renderMenu();
    clearPageError();
  } catch (err) {
    el.menuList.innerHTML = '';
    handleLoadError(err, loadMenu);
  }
}

function handleLoadError(err, retryFn) {
  const message =
    err instanceof ApiError
      ? err.message
      : 'Something went wrong. Please try again.';
  showPageError(message, retryFn);
}

function renderMenu() {
  if (!menuItems.length) {
    renderEmpty(el.menuList, 'No menu items yet for this restaurant.');
    return;
  }

  el.menuList.innerHTML = menuItems
    .map((item) => {
      const qty = cartQtyForItem(item.id);
      const unavailable = item.isAvailable === false;

      return `
      <div class="card menu-row ${unavailable ? 'menu-row--unavailable' : ''}">
        <div class="menu-row__thumb" aria-hidden="true"></div>
        <div class="menu-row__body">
          <p class="menu-row__name">
            ${escapeHtml(item.name)}
            ${item.isVegetarian ? '<span class="leaf" title="Vegetarian">●</span>' : ''}
          </p>
          <p class="menu-row__meta">
            ${item.calories ? `${item.calories} kcal` : ''}
            ${unavailable ? '· Out of stock' : ''}
          </p>
        </div>
        <span class="menu-row__price ${unavailable ? 'menu-row__price--strike' : ''}">
          ${money(item.price)}
        </span>
        ${
          unavailable
            ? `<button type="button" class="btn btn--ghost" disabled>Out of stock</button>`
            : qty > 0
            ? stepperHtml(`item-${item.id}`, qty)
            : `<button type="button" class="btn btn--primary" data-add-item="${item.id}">+ Add</button>`
        }
      </div>`;
    })
    .join('');

  el.menuList.querySelectorAll('[data-add-item]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = menuItems.find((m) => m.id === Number(btn.dataset.addItem));
      addToCart({
        menuItemId: item.id,
        name: item.name,
        unitPrice: item.price,
        isCombo: false,
      });
    });
  });

  wireSteppers(el.menuList);
}

function cartQtyForItem(menuItemId) {
  const line = cart.find((l) => !l.isCombo && l.menuItemId === menuItemId);
  return line ? line.qty : 0;
}

// -----------------------------------------------------------------
// Stepper markup + wiring (shared by combo cards and menu rows)
// -----------------------------------------------------------------
function stepperHtml(key, qty) {
  return `
    <div class="stepper" data-stepper="${key}">
      <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
      <span class="stepper__qty">${qty}</span>
      <button type="button" data-step="1" aria-label="Increase quantity">+</button>
    </div>`;
}

function wireSteppers(scope) {
  scope.querySelectorAll('[data-stepper]').forEach((stepperEl) => {
    const [type, idStr] = stepperEl.dataset.stepper.split('-');
    const id = Number(idStr);
    const isCombo = type === 'combo';

    stepperEl.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        changeQty(id, isCombo, Number(btn.dataset.step));
      });
    });
  });
}

function addToCart({ menuItemId, name, unitPrice, isCombo }) {
  const existing = cart.find((l) => l.isCombo === isCombo && l.menuItemId === menuItemId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ menuItemId, name, unitPrice, qty: 1, isCombo });
  }
  onCartChanged();
}

function changeQty(menuItemId, isCombo, delta) {
  const line = cart.find((l) => l.isCombo === isCombo && l.menuItemId === menuItemId);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) {
    cart = cart.filter((l) => l !== line);
  }
  onCartChanged();
}

// re-render only what depends on the cart, keeps interactions snappy
function onCartChanged() {
  renderMenu();
  renderCombos();
  renderCart();
}

// -----------------------------------------------------------------
// Cart panel (right column / mobile drawer)
// -----------------------------------------------------------------
function renderCart() {
  const totalQty = cart.reduce((sum, l) => sum + l.qty, 0);
  el.cartCount.textContent = totalQty;
  if (el.cartFabCount) el.cartFabCount.textContent = totalQty;

  const linesHtml = !cart.length
    ? '' // empty state rendered per-target below
    : cart
        .map(
          (line) => `
        <div class="cart-line">
          <div>
            <p class="cart-line__name">${escapeHtml(line.name)}</p>
            <p class="cart-line__unit">${money(line.unitPrice)} OMR each · ×${line.qty}</p>
          </div>
          <span class="cart-line__amount">${money(line.unitPrice * line.qty)}</span>
        </div>`
        )
        .join('');

  [el.cartLines, el.cartLinesMobile].forEach((target) => {
    if (!target) return;
    if (!cart.length) {
      renderEmpty(target, 'Your cart is empty — add something tasty.');
    } else {
      target.innerHTML = linesHtml;
    }
  });

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const deliveryFee = restaurant ? restaurant.deliveryFee : 0;
  const total = subtotal + (subtotal > 0 ? deliveryFee : 0);
  const minOrder = restaurant ? restaurant.minOrderAmount : 0;
  const meetsMin = subtotal === 0 ? false : subtotal >= minOrder;

  [
    [el.subtotal, el.subtotalMobile],
  ].forEach(([a, b]) => {
    if (a) a.textContent = `${money(subtotal)} OMR`;
    if (b) b.textContent = `${money(subtotal)} OMR`;
  });
  const feeText = `${money(subtotal > 0 ? deliveryFee : 0)} OMR`;
  if (el.deliveryFee) el.deliveryFee.textContent = feeText;
  if (el.deliveryFeeMobile) el.deliveryFeeMobile.textContent = feeText;
  if (el.total) el.total.textContent = money(total);
  if (el.totalMobile) el.totalMobile.textContent = money(total);

  let noteText = '';
  let noteClass = 'min-order-note';
  if (cart.length) {
    if (meetsMin) {
      noteText = `Min order ${money(minOrder)} OMR met ✓`;
      noteClass = 'min-order-note min-order-note--ok';
    } else {
      noteText = `Add ${money(minOrder - subtotal)} OMR more to reach the ${money(minOrder)} OMR minimum`;
      noteClass = 'min-order-note min-order-note--warn';
    }
  }
  [el.minOrderNote, el.minOrderNoteMobile].forEach((target) => {
    if (!target) return;
    target.textContent = noteText;
    target.className = noteClass;
  });

  const restaurantOpen = restaurant ? restaurant.acceptingOrders : false;
  const disabled = !cart.length || !meetsMin || !restaurantOpen || placingOrder;
  if (el.placeOrderBtn) el.placeOrderBtn.disabled = disabled;
  if (el.placeOrderBtnMobile) el.placeOrderBtnMobile.disabled = disabled;
}

// -----------------------------------------------------------------
// Place order — the real call sequence against the backend.
//   1. POST /orders/customer/{customerId}/restaurant/{restaurantId}
//   2. POST /orders/{id}/items   (once per cart line)
//   3. PUT  /orders/{id}/confirm
// -----------------------------------------------------------------
async function placeOrder() {
  if (placingOrder) return;
  placingOrder = true;
  clearPageError();
  [el.placeOrderBtn, el.placeOrderBtnMobile].forEach((btn) => {
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Placing order…';
  });

  try {
    const order = await createOrder(DEMO_CUSTOMER_ID, restaurantId);

    for (const line of cart) {
      // NOTE: OrderItemRequestDTO only documents { menuItemId, quantity,
      // specialInstructions }. Combo lines are sent with their combo id
      // in the same field — confirm this contract with the backend
      // dev before demo day if combos need a separate endpoint.
      await addOrderItem(order.id, {
        menuItemId: line.menuItemId,
        quantity: line.qty,
      });
    }

    await confirmOrder(order.id);

    cart = [];
    location.href = `track.html?orderId=${order.id}`;
  } catch (err) {
    if (err instanceof ApiError && err.fieldErrors) {
      const messages = Object.entries(err.fieldErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(' · ');
      showPageError(messages || err.message, placeOrder);
    } else if (err instanceof ApiError && err.status === 409) {
      showPageError('This order is in an invalid state. Please refresh and try again.', () => location.reload());
    } else {
      showPageError(err.message || 'Could not place your order. Please try again.', placeOrder);
    }
  } finally {
    placingOrder = false;
    [el.placeOrderBtn, el.placeOrderBtnMobile].forEach((btn) => {
      if (btn) btn.textContent = 'Place Order';
    });
    renderCart();
  }
}

// -----------------------------------------------------------------
// Mobile cart drawer
// -----------------------------------------------------------------
el.cartFab?.addEventListener('click', () => {
  el.cartDrawerOverlay.classList.add('is-open');
});
el.closeDrawerBtn?.addEventListener('click', () => {
  el.cartDrawerOverlay.classList.remove('is-open');
});
el.cartDrawerOverlay?.addEventListener('click', (e) => {
  if (e.target === el.cartDrawerOverlay) el.cartDrawerOverlay.classList.remove('is-open');
});

el.placeOrderBtn.addEventListener('click', placeOrder);
el.placeOrderBtnMobile?.addEventListener('click', placeOrder);

// -----------------------------------------------------------------
// Boot
// -----------------------------------------------------------------
(async function init() {
  await Promise.all([loadRestaurant(), loadCombos(), loadMenu()]);
  renderCart();
})();
