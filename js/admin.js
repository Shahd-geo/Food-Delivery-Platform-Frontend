import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm";

import {
    getDailySummary,
    getBusiestHours,
    getTopLoyaltyCustomers,
    getDriverLeaderboard,
    getCancellationRate,
    ApiError
} from './api.js';


const el = {


    pageBanner:
        document.getElementById('pageBanner'),


    reportDate:
        document.getElementById('reportDate'),


    metricGrid:
        document.getElementById('metricGrid'),


    chartCanvas:
        document.getElementById('busiestHoursChart'),


    loyaltyTableWrap:
        document.getElementById('loyaltyTableWrap'),


    driverTableWrap:
        document.getElementById('driverTableWrap')

};



let busiestHoursChart = null;




function escapeHtml(value){

    const div=document.createElement('div');

    div.textContent =
        String(value ?? '');

    return div.innerHTML;

}



function money(value){

    return Number(value ?? 0)
        .toFixed(3);

}




function todayIso(){

    return new Date()
        .toISOString()
        .slice(0,10);

}




function renderEmpty(container,message){

    container.innerHTML = `

        <div class="empty">

            ${escapeHtml(message)}

        </div>

    `;

}




function metricCard(label,value,unit=''){


    return `

        <div class="card metric-card">


            <p>
                ${label}
            </p>


            <h2>

                ${value}

                ${
                    unit
                    ?
                    unit
                    :
                    ''
                }

            </h2>


        </div>

    `;


}





// =======================
// Metrics
// =======================


async function loadMetrics(date){


    try{


        const summary =
            await getDailySummary(date);



        const cancellation =
            await getCancellationRate(
                date,
                date
            );



        el.metricGrid.innerHTML = `


            ${metricCard(
                "Orders today",
                summary.totalOrders ?? 0
            )}



            ${metricCard(
                "Delivery fees",
                money(summary.deliveryFees),
                "OMR"
            )}



            ${metricCard(
                "Completed orders",
                cancellation.completedOrders ?? 0
            )}



            ${metricCard(
                "Cancellation rate",
                Number(
                    cancellation.cancellationRate ?? 0
                ).toFixed(1),
                "%"
            )}


        `;



    }

    catch(error){


        showError(
            error.message,
            ()=>loadMetrics(date)
        );


    }

}






// =======================
// Busiest Hours
// =======================


async function loadBusiestHours(){


    try{


        const data =
            await getBusiestHours();



        renderBusiestHoursChart(
            data
        );


    }

    catch(error){


        console.error(error);


    }

}





function renderBusiestHoursChart(rows){



    if(!el.chartCanvas){

        console.error(
            "Missing chart canvas"
        );

        return;

    }



    if(!rows.length){

        renderEmpty(
            el.chartCanvas.parentElement,
            "No data"
        );

        return;

    }



    const labels =
        rows.map(
            row =>
            `${String(row[0]).padStart(2,'0')}:00`
        );



    const values =
        rows.map(
            row=>row[1]
        );



    if(busiestHoursChart){

        busiestHoursChart.destroy();

    }




    busiestHoursChart =
        new Chart(
            el.chartCanvas,
            {

                type:'bar',


                data:{


                    labels,


                    datasets:[

                        {

                            label:'Orders',

                            data:values,

                            borderRadius:5

                        }

                    ]

                },


                options:{


                    responsive:true,


                    maintainAspectRatio:false,


                    plugins:{


                        legend:{
                            display:false
                        }

                    }

                }


            }

        );


}







// =======================
// Loyalty Customers
// =======================


async function loadLoyalty(){


    const rows =
        await getTopLoyaltyCustomers();



    if(!rows.length){

        renderEmpty(
            el.loyaltyTableWrap,
            "No customers"
        );

        return;

    }



    el.loyaltyTableWrap.innerHTML = `


    <table>


    <tr>

        <th>Name</th>

        <th>Email</th>

        <th>Points</th>


    </tr>



    ${
        rows.map(r=>`

        <tr>

            <td>
                ${r.firstName}
                ${r.lastName}
            </td>


            <td>
                ${r.email}
            </td>


            <td>
                ${r.loyaltyPoints}
            </td>


        </tr>


        `).join('')
    }



    </table>


    `;


}







// =======================
// Drivers
// =======================


async function loadDrivers(){


    const rows =
        await getDriverLeaderboard();



    el.driverTableWrap.innerHTML = `


    <table>


    <tr>

        <th>Name</th>

        <th>Phone</th>

        <th>Status</th>


    </tr>



    ${
        rows.map(r=>`

        <tr>


            <td>
                ${r.firstName}
                ${r.lastName}
            </td>



            <td>
                ${r.phone}
            </td>



            <td>

                ${
                    r.isOnline
                    ?
                    "Online"
                    :
                    "Offline"
                }

            </td>



        </tr>


        `).join('')
    }



    </table>


    `;



}






function showError(message,retry){


    el.pageBanner.innerHTML = `


        <div class="error">


            ${escapeHtml(message)}


            <button id="retry">

                Retry

            </button>


        </div>


    `;



    document
    .getElementById('retry')
    .onclick = retry;


}







function loadDashboard(){


    const date =
        el.reportDate.value ||
        todayIso();



    loadMetrics(date);

    loadBusiestHours();

    loadLoyalty();

    loadDrivers();


}






el.reportDate.value =
    todayIso();



el.reportDate.onchange =
    loadDashboard;



loadDashboard();