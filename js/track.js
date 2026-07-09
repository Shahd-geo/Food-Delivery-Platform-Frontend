import {
    getOrder,
    getOrderTimeline,
    getOrderEta,
    getDriverDeliveries,
    ApiError
} from "./api.js";



const STAGES = [
    "PENDING",
    "PREPARING",
    "READY",
    "ON_THE_WAY",
    "DELIVERED"
];


const STAGE_LABELS = {

    PENDING: "Order Placed",
    PREPARING: "Preparing",
    READY: "Ready",
    ON_THE_WAY: "On The Way",
    DELIVERED: "Delivered"

};



const POLL_INTERVAL_MS = 5000;



const params = new URLSearchParams(location.search);

const orderId = Number(params.get("orderId"));



const el = {

    pageBanner:
        document.getElementById("pageBanner"),

    orderIdLabel:
        document.getElementById("orderIdLabel"),

    restaurantName:
        document.getElementById("restaurantName"),

    etaCountdown:
        document.getElementById("etaCountdown"),

    timeline:
        document.getElementById("timeline"),

    orderDetails:
        document.getElementById("orderDetails"),

    driverName:
        document.getElementById("driverName"),

    driverStatus:
        document.getElementById("driverStatus")

};



let pollHandle = null;

let countdownHandle = null;



function escapeHtml(value){

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;

}



function money(value){

    return Number(value || 0).toFixed(3);

}




function showPageError(message){


    el.pageBanner.innerHTML = `

    <div class="banner banner--error">

        ${escapeHtml(message)}

    </div>

    `;

}





if(!orderId){


    showPageError(
        "No order id found. Use track.html?orderId=1"
    );


}
else{


    boot();

}







async function boot(){


    await refreshAll();


    pollHandle =
        setInterval(refreshAll, POLL_INTERVAL_MS);


}








async function refreshAll(){


    try{


        const [
            order,
            timeline,
            eta

        ] = await Promise.all([


            getOrder(orderId),


            getOrderTimeline(orderId)
            .catch(()=>[]),


            getOrderEta(orderId)
            .catch(()=>null)


        ]);



        renderOrder(order);


        renderTimeline(
            order.status,
            timeline
        );


        renderEta(eta);



        // Load driver name
        loadDriverName(
            eta,
            order.id
        );




        if(order.status === "DELIVERED"){

            clearInterval(pollHandle);

        }



    }
    catch(error){


        showPageError(

            error instanceof ApiError
            ?
            error.message
            :
            "Cannot load order"

        );


    }


}








function renderOrder(order){



    el.orderIdLabel.textContent =
        order.orderCode || 
        `Order #${order.id}`;



    el.restaurantName.textContent =
        order.restaurant?.name ||
        "Restaurant";




    let html = "";



    (order.orderItems || [])
    .forEach(item => {


        html += `

        <div class="order-details__row">


            <span>

                ${escapeHtml(
                    item.menuItem?.name
                )}

                × ${item.quantity}

            </span>



            <span>

                ${money(
                    item.totalPrice
                )}
                OMR

            </span>


        </div>

        `;


    });





    html += `


    <div class="order-details__row">


        <strong>Total</strong>


        <strong>

            ${money(order.totalAmount)}
            OMR

        </strong>


    </div>



    <div class="order-details__row">


        Status


        <span class="badge">

            ${order.status.replaceAll("_"," ")}

        </span>


    </div>


    `;



    el.orderDetails.innerHTML = html;


}










async function loadDriverName(eta, orderId){


    try{


        if(!eta || !eta.driverId){


            el.driverName.textContent =
                "No driver assigned";


            return;

        }





        const deliveries =

            await getDriverDeliveries(
                eta.driverId
            );






        const delivery =

            deliveries.find(
                d => d.order?.Id === orderId
            );







        if(delivery && delivery.driver){



            el.driverName.textContent =

                `${delivery.driver.firstName}
                 ${delivery.driver.lastName}`;





            el.driverStatus.textContent =

                delivery.status
                .replaceAll("_"," ");



        }
        else{


            el.driverName.textContent =
                "No driver assigned";


        }




    }

    catch(error){


        console.error(
            "Driver loading error:",
            error
        );


        el.driverName.textContent =
            "Driver unavailable";


    }


}









function renderTimeline(status,timeline){



    let currentIndex =
        STAGES.indexOf(status);



    el.timeline.innerHTML =

    STAGES.map((stage,index)=>{


        let state =
            "is-pending";



        if(index < currentIndex)

            state =
            "is-completed";


        else if(index === currentIndex)

            state =
            "is-current";




        return `


        <div class="timeline__node ${state}">


            <div class="timeline__dot"></div>



            <div class="timeline__label">

                ${STAGE_LABELS[stage]}

            </div>



        </div>


        `;



    }).join("");



}










function renderEta(eta){



    clearInterval(countdownHandle);



    if(!eta){


        el.etaCountdown.textContent =
            "--";


        return;

    }





    if(eta.estimatedMinutes != null){



        startCountdown(

            eta.estimatedMinutes * 60

        );


    }
    else{


        el.etaCountdown.textContent =
            "Calculating...";


    }



}








function startCountdown(seconds){



    function update(){



        if(seconds <= 0){


            el.etaCountdown.textContent =
                "Arriving now";


            clearInterval(countdownHandle);


            return;

        }




        const minutes =
            Math.floor(seconds / 60);



        const sec =
            seconds % 60;



        el.etaCountdown.textContent =

            `${minutes}:${String(sec)
            .padStart(2,"0")}`;





        seconds--;


    }





    update();



    countdownHandle =

        setInterval(
            update,
            1000
        );


}