const BASE = 'http://localhost:8080/api';


export class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors || null;
  }
}

/**
 * Core fetch wrapper.
 * @param {string} path - path appended to BASE, e.g. '/restaurants/1/menu'
 * @param {object} opts - { method, body }
 */
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // backend down / CORS / offline — surface as a normal ApiError
    // so every page's catch block can handle it the same way.
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  if (res.status === 204) return null; // No Content

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      (data && data.message) || `Request failed (${res.status})`,
      res.status,
      data && data.fieldErrors
    );
  }

  return data; // Response DTO(s)
}

// =========================================================
// Endpoint helpers used by the Restaurant Browse page (Day 1)
// =========================================================

/** GET /api/restaurants → RestaurantResponseDTO[] (active restaurants only) */
export function getRestaurants() {
  return api('/restaurants');
}

/** GET /api/restaurants/cuisine/{cuisine} → RestaurantResponseDTO[] */
export function getRestaurantsByCuisine(cuisine) {
  return api(`/restaurants/cuisine/${encodeURIComponent(cuisine)}`);
}

/** GET /api/restaurants/search?name= → RestaurantResponseDTO[] (paginated on backend) */
export function searchRestaurantsByName(name) {
  return api(`/restaurants/search?name=${encodeURIComponent(name)}`);
}

/** GET /api/restaurants/near?lat=&lng= → RestaurantResponseDTO[] */
export function getNearbyRestaurants(lat, lng) {
  return api(`/restaurants/near?lat=${lat}&lng=${lng}`);
}

// =========================================================
// Endpoint helpers used by the Order Tracking page (Day 3)
// =========================================================

/** GET /api/orders/{id} → OrderResponseDTO (status, items, totals…) */
export function getOrder(orderId) {
  return api(`/orders/${orderId}`);
}

/** GET /api/orders/{id}/timeline → status history with timestamps */
export function getOrderTimeline(orderId) {
  return api(`/orders/${orderId}/timeline`);
}

/** GET /api/orders/{id}/eta → estimated delivery time */
export function getOrderEta(orderId) {
  return api(`/orders/${orderId}/eta`);
}

// =========================================================
// Endpoint helpers used by the Admin / Reporting Dashboard (Day 3)
// =========================================================

/** GET /api/reports/platform/daily-summary?date=YYYY-MM-DD */
export function getDailySummary(date) {
  return api(`/reports/platform/daily-summary?date=${encodeURIComponent(date)}`);
}

/** GET /api/reports/platform/busiest-hours */
export function getBusiestHours() {
  return api('/reports/platform/busiest-hours');
}

/** GET /api/reports/customers/top-loyalty */
export function getTopLoyaltyCustomers() {
  return api('/reports/customers/top-loyalty');
}

/** GET /api/reports/drivers/leaderboard */
export function getDriverLeaderboard() {
  return api('/reports/drivers/leaderboard');
}

/** GET /api/reports/orders/cancellation-rate?from=YYYY-MM-DD&to=YYYY-MM-DD */
export function getCancellationRate(from, to) {
  return api(`/reports/orders/cancellation-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

// =========================================================
// Endpoint helpers used by the Menu & Cart page (Day 2)
// =========================================================

/** GET /api/restaurants/{id} → RestaurantResponseDTO */
export function getRestaurant(restaurantId) {
  return api(`/restaurants/${restaurantId}`);
}

/** GET /api/restaurants/{id}/menu → MenuItemResponseDTO[] */
export function getMenu(restaurantId) {
  return api(`/restaurants/${restaurantId}/menu`);
}

/** GET /api/restaurants/{id}/combos → ComboResponseDTO[] */
export function getCombos(restaurantId) {
  return api(`/restaurants/${restaurantId}/combos`);
}

/**
 * POST /api/orders/customer/{customerId}/restaurant/{restaurantId}
 * → OrderResponseDTO (empty order, has .id)
 */
export function createOrder(customerId, restaurantId) {
  return api(`/orders/customer/${customerId}/restaurant/${restaurantId}`, {
    method: 'POST',
  });
}

/**
 * POST /api/orders/{orderId}/items
 * body: OrderItemRequestDTO { menuItemId, quantity, specialInstructions }
 */
export function addOrderItem(orderId, { menuItemId, quantity, specialInstructions = '' }) {
  return api(`/orders/${orderId}/items`, {
    method: 'POST',
    body: { menuItemId, quantity, specialInstructions },
  });
}

/** PUT /api/orders/{orderId}/confirm → OrderResponseDTO (confirmed) */
export function confirmOrder(orderId) {
  return api(`/orders/${orderId}/confirm`, { method: 'PUT' });
}

/** GET /api/drivers → DriverResponseDTO[] */
export function getDrivers() {
  return api('/drivers');
}

/** GET /api/drivers/{id}/deliveries → delivery/order list for that driver */
export function getDriverDeliveries(driverId) {
    return api(`/drivers/${driverId}/deliveries`);
}

/** GET /api/reviews/driver/{id} → ReviewResponseDTO[] (each has .rating) */
export function getDriverReviews(driverId) {
  return api(`/reviews/driver/${driverId}`);
}