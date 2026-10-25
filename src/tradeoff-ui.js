/* Compare complete management procedures with shared monitoring and assessment. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=globalThis.__mseDemo,V=globalThis.MSEViews,E=globalThis.MSEEconomics,T=globalThis.MSETradeoffs;
if(!$('radar-chart'))return;
const available=globalThis.MSELab.RULES.map(r=>r.id),key='fisheries-mse-comparison-v1';
let state={view:'radar',ids:null,x:'catch',y:'risk'},cachedResult=null,cachedAssumptions='',econ=null,timer,choiceIds='';
const f=(v,d=1)=>Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const money=v=>(v<0?'−':'')+'$'+f(Math.abs(v),0),pct=v=>f(100*v,1)+'%';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pairAxes={
 catch:{label:'Average catch',title:'Average catch (t / year)',value:r=>r.biology.meanCatch,format:v=>f(v)+' t/year',better:'higher'},
 profit:{label:'Fishing profit',title:'Average profit ($ thousands / year)',value:r=>r.metrics.profit/1000,format:v=>money(v*1000)+'/year',better:'higher',negative:true},
 jobs:{label:'Jobs supported',title:'Jobs supported (job-years / year)',value:r=>r.metrics.jobs,format:v=>f(v)+' job-years/year',better:'higher'},
 risk:{label:'Chance of low SSB',title:'Chance of low SSB (%)',value:r=>r.biology.risk*100,format:v=>f(v)+'%',better:'lower',percent:true},
 change:{label:'Annual catch change',title:'Average annual catch change (t)',value:r=>r.biology.change,format:v=>f(v)+' t',better:'lower'}
};
function validate(input){
 if(!input||!['radar','pairwise'].includes(input.view)||!pairAxes[input.x]||!pairAxes[input.y]||input.x===input.y)throw Error('Check the comparison view and axes.');
 return {view:input.view,ids:T.validateSelection(input.ids,available),x:input.x,y:input.y};
}
try{const saved=localStorage.getItem(key);if(saved)state=validate(JSON.parse(saved));}catch{}
function persist(){try{localStorage.setItem(key,JSON.stringify(getState()));}catch{}}
function getState(){return {...state,ids:state.ids?.slice()||T.defaultSelection(available,api.selected)};}
function economicData(){
 const workshop=globalThis.MSEWorkshop.getState(),signature=JSON.stringify(workshop.assumptions);
 if(cachedResult!==api.result||cachedAssumptions!==signature){econ=E.evaluate(api.result,workshop.assumptions,false);cachedResult=api.result;cachedAssumptions=signature;}
 return {econ,workshop};
}
function node(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function panelState(){
 const radar=state.view==='radar';$('radar-panel').hidden=!radar;$('pairwise-panel').hidden=radar;$('metric-cards').hidden=radar;
 document.querySelectorAll('[data-comparison-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.comparisonView===state.view)));
 $('inspect-bar').hidden=!$('view-stock').hidden||(!$('view-results').hidden&&radar);
 $('compare-x').value=state.x;$('compare-y').value=state.y;
 for(const option of $('compare-x').options)option.disabled=option.value===state.y;
 for(const option of $('compare-y').options)option.disabled=option.value===state.x;
 $('comparison-csv').disabled=!api.result||api.dirty||api.busy||!!document.querySelector('#radar-scale [aria-invalid=true]');
}
function choices(){
 const rules=api.result.rules;
 if(choiceIds!==rules.map(r=>r.id).join(',')){
  choiceIds=rules.map(r=>r.id).join(',');$('mp-choices').replaceChildren();
  for(const r of rules){const label=document.createElement('label'),input=document.createElement('input'),swatch=document.createElement('i'),name=document.createElement('span');label.className='mp-choice';input.type='checkbox';input.dataset.compareMp=r.id;swatch.className='swatch';swatch.style.background=V.colors[r.id];label.append(input,swatch,name);$('mp-choices').append(label);}
 }
 for(const input of $('mp-choices').querySelectorAll('input')){
  const r=rules.find(v=>v.id===input.dataset.compareMp),checked=state.ids.includes(r.id);input.checked=checked;
  input.disabled=checked?state.ids.length===1:state.ids.length===3;input.setAttribute('aria-label','Compare '+r.name);
  const quota={catchLow:api.result.config.catchLow,fixed:api.result.config.fixedCatch,catchHigh:api.result.config.catchHigh}[r.id];
  input.parentElement.querySelector('span').textContent=r.short+(quota===undefined?'':' · '+f(quota,0)+' t');input.parentElement.title=r.name;input.parentElement.classList.toggle('included',checked);
 }
}
function rawText(axis,value){if(axis==='safety')return pct(value);if(axis==='profit')return money(value);return f(value);}
function radar(profiles){
 const box=$('radar-chart');if(!box.clientWidth)return;
 const width=box.clientWidth,height=box.clientHeight||480,large=document.documentElement.dataset.textSize==='large',font=width<420?16:large?18:16;
 const cx=width/2,cy=height*.48,r=Math.min(width*.26,(height-170)/2),gap=width<420?32:55;
 const angle=i=>-Math.PI/2+i*2*Math.PI/5,point=(i,score,rad=r)=>({x:cx+Math.cos(angle(i))*rad*score/100,y:cy+Math.sin(angle(i))*rad*score/100});
 const svg=node('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':'Radar comparison of selected management procedures on five objective scores'});
 svg.append(node('title',{},'MP trade-offs: farther from the center is better on each objective'));
 svg.append(node('desc',{},profiles.map(p=>p.name+': '+T.AXES.map(a=>`${a.label} ${f(p.scores[a.id],1)} of 100`).join(', ')).join('. ')+'. Scores use common class targets; polygon area is not an overall ranking.'));
 for(const score of [25,50,75,100]){
  const points=T.AXES.map((a,i)=>{const p=point(i,score);return p.x+','+p.y;}).join(' ');
  svg.append(node('polygon',{points,fill:score===100?'#f7fafb':'none',stroke:'#d1dfe3','stroke-width':1}));
 }
 // Draw the outer fill first, then all rings again so it cannot obscure them.
 for(const score of [25,50,75])svg.append(node('polygon',{points:T.AXES.map((a,i)=>{const p=point(i,score);return p.x+','+p.y;}).join(' '),fill:'none',stroke:'#d1dfe3'}));
 T.AXES.forEach((a,i)=>{const p=point(i,100);svg.append(node('line',{x1:cx,y1:cy,x2:p.x,y2:p.y,stroke:'#c0d1d7'}));});
 for(const score of [0,25,50,75,100]){const p=point(0,score);const text=node('text',{x:p.x+7,y:p.y+5,fill:'#526b76','font-size':large?16:14},String(score));text.style.fontSize=(large?16:14)+'px';svg.append(text);}
 const labels=[['Avoid low','SSB'],['Catch'],['Fishing','profit'],['Jobs','supported'],['Steady','catches']];
 T.AXES.forEach((a,i)=>{const p=point(i,100,r+gap),text=node('text',{x:p.x,y:Math.max(font+8,p.y-(labels[i].length-1)*(font+2)/2),'text-anchor':'middle','font-weight':600,fill:'#173541'});text.style.fontSize=font+'px';
  labels[i].forEach((line,j)=>text.append(node('tspan',{x:p.x,dy:j?font+2:0},line)));svg.append(text);
 });
 const dashes=['','10 5','2 6'];
 profiles.forEach((p,j)=>{
  const points=T.AXES.map((a,i)=>point(i,p.scores[a.id])),color=V.colors[p.id];
  const outline={points:points.map(p=>p.x+','+p.y).join(' '),fill:'none','stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':dashes[j]};
  svg.append(node('polygon',{...outline,stroke:'#fff','stroke-width':6}));
  svg.append(node('polygon',{...outline,stroke:color,'stroke-width':3.3}));
  points.forEach((pt,i)=>{const axis=T.AXES[i],label=`${p.name}: ${axis.label}, score ${f(p.scores[axis.id],1)} of 100; original value ${rawText(axis.id,p.raw[axis.id])} ${axis.unit}`;
   const mark=node(j===1?'rect':'circle',{...(j===1?{x:pt.x-4,y:pt.y-4,width:8,height:8}:{cx:pt.x,cy:pt.y,r:4.5}),fill:color,stroke:'#fff','stroke-width':1.5});
   mark.append(node('title',{},label));svg.append(mark);
  });
 });
 box.replaceChildren(svg);
 $('radar-legend').innerHTML=profiles.map((p,j)=>`<span><i class="radar-key key-${j}" style="border-color:${V.colors[p.id]}"></i>${escape(p.name)}</span>`).join('');
 const head='<thead><tr><th>MP</th><th>Chance low SSB<br>(lower is better)</th><th>Catch<br>(t/year)</th><th>Profit<br>($/year)</th><th>Jobs<br>(job-years/year)</th><th>Catch change<br>(t)</th></tr></thead>';
 $('radar-values').innerHTML=head+'<tbody>'+profiles.map(p=>`<tr><td>${escape(p.name)}</td><td>${pct(p.raw.safety)}</td><td>${f(p.raw.catch)}</td><td>${money(p.raw.profit)}</td><td>${f(p.raw.jobs)}</td><td>${f(p.raw.stability)}</td></tr>`).join('')+'</tbody>';
}
function extent(values,axis){if(axis.percent)return [0,100];const lo=axis.negative?Math.min(0,...values):0,hi=Math.max(1,...values),pad=Math.max(axis.negative?1:.1,(hi-lo)*.14);return [lo<0?lo-pad:0,hi+pad];}
function drawPairwise(){
 if(!api.result||$('view-results').hidden||state.view!=='pairwise')return;
 const {econ}=economicData(),xAxis=pairAxes[state.x],yAxis=pairAxes[state.y],xs=econ.rules.map(xAxis.value),ys=econ.rules.map(yAxis.value),[xMin,xMax]=extent(xs,xAxis),[yMin,yMax]=extent(ys,yAxis);
 const P=V.axes('tradeoff-chart',{xMin,xMax,yMin,yMax,xTitle:xAxis.title,yTitle:yAxis.title,title:`Management procedures: ${xAxis.label} versus ${yAxis.label}`,percentX:xAxis.percent,percentY:yAxis.percent});if(!P)return;
 econ.rules.forEach(r=>{const x=xAxis.value(r),y=yAxis.value(r),active=r.id===api.selected,label=`Inspect ${r.name}: ${xAxis.label} ${xAxis.format(x)}, ${yAxis.label} ${yAxis.format(y)}`,g=node('g',{role:'button',tabindex:0,'aria-label':label});
  g.append(node('circle',{cx:P.X(x),cy:P.Y(y),r:active?8:6,fill:V.colors[r.id],stroke:active?'#173541':'#fff','stroke-width':active?2:1.5}));g.append(node('title',{},label));
  if(active)g.append(node('text',{x:P.X(x)+12,y:P.Y(y)-12,'font-weight':700},r.short));
  g.style.cursor='pointer';g.addEventListener('click',()=>api.chooseRule(r.id));g.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();api.chooseRule(r.id);}});P.svg.append(g);
 });
 $('pairwise-title').textContent=xAxis.label+' versus '+yAxis.label;
 $('pairwise-caption').textContent=`Each dot is an MP. ${xAxis.better==='higher'?'Right':'Left'} is better for ${xAxis.label.toLowerCase()}; ${yAxis.better==='higher'?'up':'down'} is better for ${yAxis.label.toLowerCase()}. Click a dot to inspect that MP. Values summarize all simulated futures.`;
 let legend=$('tradeoff-legend');if(!legend){legend=document.createElement('div');legend.id='tradeoff-legend';legend.className='quick-values';$('tradeoff-chart').after(legend);legend.addEventListener('click',e=>{const b=e.target.closest('[data-select-rule]');if(b)api.chooseRule(b.dataset.selectRule);});}
 legend.innerHTML=econ.rules.map(r=>`<button type="button" data-select-rule="${r.id}" aria-pressed="${r.id===api.selected}"><i class="swatch" style="background:${V.colors[r.id]}"></i>${escape(r.short)}</button>`).join('');
}
function render(){
 panelState();if(!api.result||$('view-results').hidden)return;
 if(!state.ids)state.ids=T.defaultSelection(available,api.selected);
 const {econ,workshop}=economicData();choices();
 for(const input of document.querySelectorAll('[data-radar-target]'))if(document.activeElement!==input&&input.getAttribute('aria-invalid')!=='true')input.value=workshop.targets[input.dataset.radarTarget];
 if(state.view==='radar')radar(T.profiles(econ,state.ids,workshop.targets));else drawPairwise();
 const c=api.result.config;$('radar-context').textContent=`${c.reps} futures × ${c.years} years per MP. These MPs share the survey and assessment settings; their fishing rules differ. Scores use the shared class targets, not the best and worst MPs in this chart.`;
}
function queue(){clearTimeout(timer);timer=setTimeout(render,100);}
document.querySelectorAll('[data-comparison-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.comparisonView;persist();render();}));
$('mp-choices').addEventListener('change',()=>{const ids=[...$('mp-choices').querySelectorAll('input:checked')].map(el=>el.dataset.compareMp);try{state.ids=T.validateSelection(ids,available);persist();render();}catch(e){V.toast(e.message);choices();}});
for(const key of ['x','y'])$('compare-'+key).addEventListener('change',()=>{state[key]=$('compare-'+key).value;persist();render();});
document.querySelectorAll('[data-radar-target]').forEach(input=>input.addEventListener('input',()=>{
 const all=[...document.querySelectorAll('[data-radar-target]')],invalid=all.filter(el=>el.value===''||!el.checkValidity());
 for(const el of all)el.setAttribute('aria-invalid',String(invalid.includes(el)));
 $('radar-scale-error').hidden=!invalid.length;$('radar-scale-error').textContent='Enter positive targets. The plot uses the last valid scale until these values are corrected.';
 if(invalid.length){$('comparison-csv').disabled=true;return;}
 globalThis.MSEWorkshop.setTargets(Object.fromEntries(all.map(el=>[el.dataset.radarTarget,+el.value])));render();
}));
function exportCSV(){
 if(!api.result||api.dirty||api.busy||document.querySelector('#radar-scale [aria-invalid=true]'))return;const {econ,workshop}=economicData(),profiles=T.profiles(econ,state.ids,workshop.targets);
 const cols=['interface_version','model_version','MP','projection_years','futures','seed','chance_low_SSB_fraction','mean_catch_t_per_year','mean_profit_dollars_per_year','jobs_supported_job_years_per_year','mean_absolute_annual_catch_change_t',...T.AXES.map(a=>a.id+'_score_0_100'),'targets_json','economic_assumptions_json','model_configuration_json','comparison_json'];
 const rows=profiles.map(p=>['1.8.1',api.result.version,p.name,api.result.config.years,api.result.config.reps,api.result.config.seed,...T.AXES.map(a=>p.raw[a.id]),...T.AXES.map(a=>p.scores[a.id]),JSON.stringify(workshop.targets),JSON.stringify(workshop.assumptions),JSON.stringify(api.result.config),JSON.stringify(getState())]);
 V.saveFile([cols,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8','fisheries-mse-mp-comparison.csv');
}
$('comparison-csv').addEventListener('click',exportCSV);
for(const event of ['mse:render','mse:result','mse:configuration'])document.addEventListener(event,render);
document.addEventListener('mse:workshop',queue);
for(const event of ['mse:dirty','mse:start'])document.addEventListener(event,()=>$('comparison-csv').disabled=true);
$('radar-scale').addEventListener('toggle',()=>{if($('radar-scale').open)render();});
new ResizeObserver(queue).observe($('radar-chart'));
globalThis.MSETradeoffView={drawPairwise,getState,loadState(input){state=validate(input);persist();render();}};
render();
})();
