/* Shared, decorative symbols. Text labels carry the meaning. */
(function(root){
'use strict';
const paths={
 fish:'<path d="M7 12 2 7v10l5-5Z"/><path d="M7 12c4-7 11-7 15 0-4 7-11 7-15 0Z"/><circle cx="17.5" cy="10.5" r=".8" fill="currentColor" stroke="none"/><path d="m10 7 3-3 3 3m-6 10 3 3 3-3"/>',
 boat:'<path d="M3 14h18l-3 5H7l-4-5Zm5 0V8h8v6M10 8V5h4v3M2 21c2 1 3 1 5 0 2 1 3 1 5 0 2 1 3 1 5 0 2 1 3 1 5 0"/>',
 fleet:'<path d="M2 14h20l-4 5H7l-5-5Zm4 0V9h13v5M9 9V5h7v4M12 5V2m5 12V7h3v7M1 21c2 1 4 1 6 0 2 1 4 1 6 0 2 1 4 1 6 0 2 1 3 1 4 0"/>',
 catch:'<path d="m3 11 2 10h14l2-10H3Zm5 0v10m8-10v10M8 7 5 3m11 4 3-4"/><path d="M7 7c3-4 7-4 10 0-3 4-7 4-10 0Z"/><path d="m7 7-3-2v4l3-2Z"/>',
 survey:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 11c1-3 4-3 6-1M10 5v2M3 20c2 1 4 1 6 0 2 1 4 1 6 0"/>',
 rule:'<path d="M7 4H4v17h16V4h-3M8 2h8v5H8V2Zm0 10 2 2 5-5M8 18h8"/>',
 chart:'<path d="M3 3v18h18M7 17v-5m5 5V7m5 10v-8"/>',
 future:'<path d="M3 8h4V4M4 7a9 9 0 1 1-1 8M12 7v5l4 2"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
 coin:'<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
 shield:'<path d="M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>'
};
function icon(kind,extra=''){return paths[kind]?`<svg class="mse-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[kind]}</svg>`:'';}
function fish(kind){
 const body={short:'M17 20c10-12 30-11 42 0-12 11-32 12-42 0Z',medium:'M16 20c9-15 30-14 44 0-14 14-35 14-44 0Z',long:'M15 20c8-16 31-16 45 0-14 16-37 16-45 0Z'}[kind];
 return`<svg class="fish-illustration fish-${kind}" viewBox="0 0 64 40" aria-hidden="true" focusable="false"><path class="fish-tail" d="m19 20-15-12 2 12-2 12 15-12Z"/><path class="fish-body" d="${body}"/><path class="fish-fin" d="${kind==='long'?'m24 10 4-7 4 5 5-6 4 6 5-3 3 6':'m27 11 8-7 7 7'}"/><path class="fish-fin" d="m30 28 8 7 6-7"/><path d="M45 12c-4 4-4 12 0 16" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".65"/><circle cx="51" cy="17" r="1.7" fill="white"/><circle cx="51.4" cy="17" r=".8" fill="#173541"/></svg>`;
}
function iconForLabel(label){if(/catch/i.test(label))return icon('catch');if(/SSB|stock at the end/i.test(label))return icon('fish');if(/chance.*stock|risk/i.test(label))return icon('shield');if(/jobs|livelihood/i.test(label))return icon('people');if(/survey/i.test(label))return icon('survey');if(/profit|value|money|cost|loss/i.test(label))return icon('coin');return'';}
function roleIcon(id){return icon(({fleet:'boat',community:'people',conservation:'fish',management:'rule'})[id]||'people');}
function decorate(){
 const headings=[['#view-stock .view-intro h2','fish'],['#view-data .view-intro h2','survey'],['#view-rules .view-intro h2','boat'],['#view-results .view-intro h2','chart'],['#view-future .view-intro h2','future'],['#view-people .view-intro h2','people'],['#hcr-title','rule']];
 for(const [selector,kind]of headings){const el=document.querySelector(selector);if(el&&!el.querySelector('.mse-icon'))el.insertAdjacentHTML('afterbegin',icon(kind));}
}
function initialize(){
 const api=root.__mseDemo,heading=document.querySelector('.mast h1');heading.insertAdjacentHTML('afterbegin',icon('fish','brand-fish'));
 document.querySelectorAll('[data-species]').forEach(b=>{const span=b.querySelector('.fish-symbol');span.setAttribute('aria-hidden','true');span.innerHTML=fish(b.dataset.species);});
 const tabs={stock:'fish',data:'survey',rules:'boat',results:'chart',future:'future',people:'people'};
 for(const [key,kind]of Object.entries(tabs)){const badge=document.querySelector('#tab-'+key+'>span'),step=badge.textContent;badge.innerHTML=icon(kind)+`<span class="sr-only">${step}</span>`;badge.classList.add('step-symbol');}
 const label=document.createElement('label'),select=document.createElement('select'),caption=document.createElement('span');label.className='text-size-choice';caption.textContent='Text size';select.id='text-size';select.setAttribute('aria-label','Text size');select.innerHTML='<option value="comfortable">Comfortable</option><option value="large">Larger</option>';label.append(caption,select);document.querySelector('.header-actions').append(label);
 let saved='comfortable';try{saved=localStorage.getItem('mse-text-size')||saved;}catch{}if(!['comfortable','large'].includes(saved))saved='comfortable';select.value=saved;
 function apply(){document.documentElement.dataset.textSize=select.value;try{localStorage.setItem('mse-text-size',select.value);}catch{}requestAnimationFrame(()=>api.refresh());}
 select.addEventListener('change',apply);apply();decorate();document.addEventListener('mse:render',decorate);
}
root.MSEVisuals={icon,fish,iconForLabel,roleIcon,initialize};
})(globalThis);
