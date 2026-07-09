import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm";

import {
    getDailySummary,
    getBusiestHours,
    getTopLoyaltyCustomers,
    getDrivers,
    getDriverDeliveries,
    getDriverReviews,
    getCancellationRate,
    ApiError
} from './api.js';

const el = {
    pageBanner: document.getElementById('pageBanner'),
    reportDate: document.getElementById('reportDate'),
    metricGrid: document.getElementById('metricGrid'),
    chartCanvas: document.getElementById('busiestHoursChart'),
    loyaltyTableWrap: document.getElementById('loyaltyTableWrap'),
    driverTableWrap: document.getElementById('driverTableWrap')
};

let busiestHoursChart = null;

function escapeHtml(value){
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function money(value){
    return Number(value ?? 0).toFixed(3);
}

function todayIso(){
    return new Date().toISOString().slice(0, 10);
}

function renderEmpty(container, message){
    container.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

function metricCard(label, value, unit = '', modifier = '', sub = ''){
    return `
        <div class="metric-card ${modifier}">
            <p class="metric-card__label">${escapeHtml(label)}</p>
            <p class="metric-card__value">
                ${value}
                ${unit ? `<span class="metric-card__unit">${escapeHtml(unit)}</span>` : ''}
            </p>
            ${sub ? `<p class="metric-card__sub">${escapeHtml(sub)}</p>` : ''}
        </div>
    `;
}

// =======================
// Metrics
// =======================
async function loadMetrics(date){
    try{
        const summary = await getDailySummary(date);
        const cancellation = await getCancellationRate(date, date);

        const orders = Number(summary.totalOrders ?? 0);
        const revenue = Number(summary.deliveryFees ?? 0);
        const avgOrder = orders > 0 ? revenue / orders : 0;
        const cancelRate = Number(cancellation.cancellationRate ?? 0);

        el.metricGrid.innerHTML = `
            ${metricCard("Orders", orders, "", "", "today")}
            ${metricCard("Revenue", money(revenue), "OMR", "metric-card--revenue")}
            ${metricCard("Avg Order", avgOrder.toFixed(2), "OMR", "metric-card--avg")}
            ${metricCard("Cancel Rate", cancelRate.toFixed(1), "%", "metric-card--cancel", "of orders")}
        `;
    }
    catch(error){
        showError(error.message, () => loadMetrics(date));
    }
}

// =======================
// Busiest Hours
// =======================
async function loadBusiestHours(){
    try{
        const data = await getBusiestHours();
        renderBusiestHoursChart(data);
    }
    catch(error){
        console.error(error);
    }
}

function renderBusiestHoursChart(rows){
    if(!el.chartCanvas){
        console.error("Missing chart canvas");
        return;
    }

    if(!rows.length){
        renderEmpty(el.chartCanvas.parentElement, "No data");
        return;
    }

    const labels = rows.map(row => {
        const hour24 = Number(row[0]);
        const period = hour24 >= 12 ? 'p' : 'a';
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        return `${hour12}${period}`;
    });

    const values = rows.map(row => row[1]);

    if(busiestHoursChart){
        busiestHoursChart.destroy();
    }

    const styles = getComputedStyle(document.documentElement);
    const barColor = styles.getPropertyValue('--brand').trim() || '#2F6FED';
    const gridColor = styles.getPropertyValue('--bg').trim() || '#E4E9F0';
    const mutedColor = styles.getPropertyValue('--muted').trim() || '#8592A6';

    busiestHoursChart = new Chart(el.chartCanvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Orders',
                data: values,
                backgroundColor: barColor,
                borderRadius: { topLeft: 6, topRight: 6 },
                borderSkipped: false,
                maxBarThickness: 42
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: mutedColor } },
                y: { grid: { color: gridColor }, ticks: { color: mutedColor }, beginAtZero: true }
            }
        }
    });
}

// =======================
// Loyalty Customers
// =======================
async function loadLoyalty(){
    try{
        const rows = await getTopLoyaltyCustomers();

        if(!rows.length){
            renderEmpty(el.loyaltyTableWrap, "No customers");
            return;
        }

        el.loyaltyTableWrap.innerHTML = `
            <ul class="rank-list">
                ${rows.map((r, i) => `
                    <li>
                        <span class="rank-badge">${i + 1}</span>
                        <span class="rank-name">${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</span>
                        <span class="rank-points">${escapeHtml(r.loyaltyPoints)} <span>pts</span></span>
                    </li>
                `).join('')}
            </ul>
        `;
    }
    catch(error){
        renderEmpty(el.loyaltyTableWrap, error.message);
    }
}

// =======================
// Drivers
// =======================
async function loadDrivers(){
    try{
        const drivers = await getDrivers();

        if(!drivers.length){
            renderEmpty(el.driverTableWrap, "No drivers");
            return;
        }

        const rows = await Promise.all(drivers.map(async driver => {
            const [deliveries, reviews] = await Promise.all([
                getDriverDeliveries(driver.id).catch(() => []),
                getDriverReviews(driver.id).catch(() => [])
            ]);

            const completed = deliveries.length;
            const avgRating = reviews.length
                ? reviews.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / reviews.length
                : 0;

            return {
                firstName: driver.firstName,
                lastName: driver.lastName,
                completed,
                rating: avgRating
            };
        }));

        rows.sort((a, b) => b.completed - a.completed);

        el.driverTableWrap.innerHTML = `
            <table class="data-table">
                <tr>
                    <th>Driver</th>
                    <th>Completed</th>
                    <th>Rating</th>
                </tr>
                ${rows.map(r => `
                    <tr>
                        <td>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</td>
                        <td>${r.completed}</td>
                        <td>
                            <span class="rating-cell">
                                <span class="star">★</span>${r.rating.toFixed(1)}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </table>
        `;
    }
    catch(error){
        renderEmpty(el.driverTableWrap, error.message);
    }
}

function showError(message, retry){
    el.pageBanner.innerHTML = `
        <div class="error">
            ${escapeHtml(message)}
            <button id="retry">Retry</button>
        </div>
    `;
    document.getElementById('retry').onclick = retry;
}

function loadDashboard(){
    const date = el.reportDate.value || todayIso();
    loadMetrics(date);
    loadBusiestHours();
    loadLoyalty();
    loadDrivers();
}

el.reportDate.value = todayIso();
el.reportDate.onchange = loadDashboard;

loadDashboard();