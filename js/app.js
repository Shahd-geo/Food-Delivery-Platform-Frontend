

import {
  getRestaurants,
  getRestaurantsByCuisine,
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


// DOM references
const el = {

  searchInput: document.getElementById('searchInput'),

  chipRow: document.getElementById('chipRow'),

  grid: document.getElementById('restaurantGrid'),

  pageBanner: document.getElementById('pageBanner')

};


// State
let activeCuisine = 'All';
let searchTerm = '';
let searchDebounceHandle = null;
let requestToken = 0;



// -----------------------------
// Helpers
// -----------------------------

function escapeHtml(value){

  const div = document.createElement('div');

  div.textContent = value ?? '';

  return div.innerHTML;

}



function money(value){

  return Number(value || 0).toFixed(3);

}



function clearPageError(){

  el.pageBanner.innerHTML = '';

}



function showPageError(message, retry){

  el.pageBanner.innerHTML = `

    <div class="banner banner--error">

      <span>
        ${escapeHtml(message)}
      </span>

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



// -----------------------------
// Loading UI
// -----------------------------

function renderSkeletons(){

  el.grid.innerHTML = Array.from(
    {length:6}
  )
  .map(()=>`

    <article class="card restaurant-card">

      <div class="skeleton"
      style="height:120px">
      </div>


      <div class="skeleton skeleton--line">
      </div>


      <div class="skeleton skeleton--line">
      </div>


    </article>

  `)
  .join('');

}



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



// -----------------------------
// Cuisine chips
// -----------------------------

function renderChips(){

  el.chipRow.innerHTML =
  CUISINES.map(c => `

    <button

      type="button"

      class="
      filter-chip
      ${c === activeCuisine
      ? 'filter-chip--active'
      : ''}

      "

      data-cuisine="${c}"

    >

      ${c}

    </button>

  `)
  .join('');



  el.chipRow
  .querySelectorAll('[data-cuisine]')
  .forEach(button=>{


    button.addEventListener(
      'click',
      ()=>{


        activeCuisine =
        button.dataset.cuisine;


        renderChips();


        loadRestaurants();


      }
    );


  });

}



// -----------------------------
// Load restaurants
// -----------------------------

async function loadRestaurants(){

  const token = ++requestToken;


  clearPageError();


  renderSkeletons();



  try {


    let data = [];



    // Search locally from API result
    // avoids backend /search 500 error

    if(searchTerm.trim()){


      const allRestaurants =
      await getRestaurants();



      data =
      allRestaurants.filter(r =>

        r.name
        .toLowerCase()
        .includes(
          searchTerm
          .trim()
          .toLowerCase()
        )

      );


    }



    else if(activeCuisine !== 'All'){


      data =
      await getRestaurantsByCuisine(
        activeCuisine
      );


    }



    else {


      data =
      await getRestaurants();


    }





    if(token !== requestToken)
      return;



    renderGrid(data || []);




  }


  catch(error){


    if(token !== requestToken)
      return;



    el.grid.innerHTML = '';



    showPageError(

      error instanceof ApiError

      ? error.message

      : 'Something went wrong. Please try again.',

      loadRestaurants

    );


  }


}



// -----------------------------
// Restaurant cards
// -----------------------------

function renderGrid(restaurants){


  if(!restaurants.length){


    renderEmpty(
      searchTerm.trim()
      ?
      'No restaurants found.'
      :
      'No restaurants available.'
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

href="
${paused
? '#'
: `menu.html?restaurantId=${r.id}`
}
"

class="
btn
${paused
? 'btn--muted'
: 'btn--brand'}
"

>

${paused
? 'Paused'
: 'View Menu'}

</a>



</article>

`;

}




// -----------------------------
// Search
// -----------------------------

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




// -----------------------------
// Start page
// -----------------------------

renderChips();

loadRestaurants();