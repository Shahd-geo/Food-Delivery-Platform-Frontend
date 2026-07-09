// =========================================================
// app.js — Restaurant Browse page behaviour
// =========================================================

import {
  getRestaurants,
  getRestaurantsByCuisine,
  searchRestaurantsByName,
  ApiError,
} from './api.js';


// Matches backend cuisineType values
const CUISINES = [
  'All',
  'Arabic',
  'Indian',
  'Italian',
  'Burgers',
  'Japanese',
  'Healthy'
];


// DOM refs
const el = {

  searchInput:
    document.getElementById('searchInput'),

  chipRow:
    document.getElementById('chipRow'),

  grid:
    document.getElementById('restaurantGrid'),

  pageBanner:
    document.getElementById('pageBanner'),

};



// State

let activeCuisine = 'All';

let searchTerm = '';

let searchDebounceHandle = null;

let requestToken = 0;



// Helpers

function escapeHtml(str) {

  const div = document.createElement('div');

  div.textContent = str ?? '';

  return div.innerHTML;

}



function money(value) {

  return Number(value || 0).toFixed(3);

}



function clearPageError(){

  el.pageBanner.innerHTML = '';

}



function showPageError(message, retry){

  el.pageBanner.innerHTML = `

  <div class="banner banner--error">

    ${escapeHtml(message)}

    <button id="retryBtn">
      Retry
    </button>

  </div>

  `;


  document
  .getElementById('retryBtn')
  .addEventListener(
    'click',
    retry
  );

}



// Loading

function renderSkeletons(){

  el.grid.innerHTML = Array.from(
    {length:6}
  )
  .map(()=>`

    <div class="card restaurant-card">

      <div class="skeleton"></div>

      <div class="skeleton skeleton--line"></div>

      <div class="skeleton skeleton--line"></div>

    </div>

  `)
  .join('');

}



// Empty

function renderEmpty(message){

  el.grid.innerHTML = `

  <div class="empty">

    <div class="empty__icon">
      🔍
    </div>

    <p>
      ${escapeHtml(message)}
    </p>

  </div>

  `;

}




// Cuisine buttons

function renderChips(){

  el.chipRow.innerHTML =
  CUISINES.map(c=>`

    <button

      class="filter-chip 
      ${c===activeCuisine 
      ? 'filter-chip--active'
      : ''}"

      data-cuisine="${c}"

    >

      ${c}

    </button>

  `)
  .join('');



  el.chipRow
  .querySelectorAll('[data-cuisine]')
  .forEach(btn=>{


    btn.addEventListener(
      'click',
      ()=>{


        activeCuisine =
        btn.dataset.cuisine;


        renderChips();


        loadRestaurants();


      }
    );


  });


}




// Load restaurants

async function loadRestaurants(){


  const token = ++requestToken;


  clearPageError();


  renderSkeletons();



  try{


    let restaurants;



    if(searchTerm.trim()){


      restaurants =
      await searchRestaurantsByName(
        searchTerm.trim()
      );


    }

    else if(activeCuisine !== 'All'){


      restaurants =
      await getRestaurantsByCuisine(
        activeCuisine
      );


    }

    else{


      restaurants =
      await getRestaurants();


    }





    if(token !== requestToken)
      return;



    renderGrid(
      restaurants || []
    );



  }

  catch(error){


    if(token !== requestToken)
      return;



    el.grid.innerHTML='';



    showPageError(

      error instanceof ApiError

      ? error.message

      : 'Something went wrong',

      loadRestaurants

    );


  }



}




// Cards

function renderGrid(restaurants){


  if(!restaurants.length){


    renderEmpty(
      searchTerm
      ?
      'No restaurants found'
      :
      'No restaurants available'
    );


    return;

  }




  el.grid.innerHTML =
  restaurants
  .map(restaurantCardHtml)
  .join('');

}




function restaurantCardHtml(r){


  const paused =
  r.acceptingOrders === false;



return `

<article class="card restaurant-card">


<div class="restaurant-card__thumb">


<span class="badge 
${paused 
? 'badge--muted'
: 'badge--success'}">

${paused 
? 'Paused'
: 'Open'}

</span>


</div>




<div class="restaurant-card__top">


<h2 class="restaurant-card__title">

${escapeHtml(r.name)}

</h2>


</div>




<div class="chip">

${escapeHtml(r.cuisineType)}

</div>




<div class="restaurant-card__row">

<span>
Delivery fee
</span>


<strong>

${money(r.deliveryFee)}
OMR

</strong>


</div>





<div class="restaurant-card__row">

<span>
Min order
</span>


<strong>

${money(r.minOrderAmount)}
OMR

</strong>


</div>





<a

href="${
paused
?
'#'
:
`menu.html?restaurantId=${r.id}`
}"

class="btn ${
paused
?
'btn--muted'
:
'btn--brand'
}"

>

${
paused
?
'Paused'
:
'View Menu'
}


</a>



</article>


`;

}





// Search

el.searchInput.addEventListener(
'input',
()=>{


searchTerm =
el.searchInput.value;



clearTimeout(
searchDebounceHandle
);



searchDebounceHandle =
setTimeout(
loadRestaurants,
300
);


});






// Start

renderChips();

loadRestaurants();