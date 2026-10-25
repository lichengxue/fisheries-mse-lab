/* Common scales for comparing management procedures across several objectives. */
(function(root){
'use strict';
const E=typeof module==='object'&&module.exports?require('./economics.js'):root.MSEEconomics;
const AXES=[
 {id:'safety',label:'Avoid low SSB',unit:'chance of low SSB',better:'lower'},
 {id:'catch',label:'Catch',unit:'t / year',better:'higher'},
 {id:'profit',label:'Fishing profit',unit:'$ / year',better:'higher'},
 {id:'jobs',label:'Jobs supported',unit:'job-years / year',better:'higher'},
 {id:'stability',label:'Steady catches',unit:'annual catch change (t)',better:'lower'}
];
function validateSelection(ids,available){
 if(!Array.isArray(ids)||ids.length<1||ids.length>3)throw Error('Choose one to three MPs.');
 if(new Set(ids).size!==ids.length)throw Error('Choose each MP only once.');
 if(ids.some(id=>!available.includes(id)))throw Error('Choose an MP from this simulation.');
 return ids.slice();
}
function defaultSelection(available,selected='framp'){
 return [...new Set([selected,'fixed','smooth',...available])].filter(id=>available.includes(id)).slice(0,3);
}
function profiles(economics,ids,targets=E.TARGETS){
 validateSelection(ids,economics.rules.map(r=>r.id));
 return ids.map(id=>{
  const r=economics.rules.find(r=>r.id===id),scores=E.scoreCriteria(r,targets);
  return {id,name:r.name,short:r.short,scores,raw:{safety:r.biology.risk,catch:r.biology.meanCatch,
    profit:r.metrics.profit,jobs:r.metrics.jobs,stability:r.biology.change}};
 });
}
const api={AXES,validateSelection,defaultSelection,profiles};root.MSETradeoffs=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
