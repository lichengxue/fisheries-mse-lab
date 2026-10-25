(function(){
'use strict';
const $=id=>document.getElementById(id),api=globalThis.__mseDemo,m=globalThis.MSELab,helpers=globalThis.MSEInterface;
const colors=globalThis.MSEVisuals.ruleColors;
const names={stock:'Fish stock',data:'Survey',assessment:'Assessment',rules:'Fishing rules',results:'Compare',future:'One future',people:'People & money'};
const percent=new Set(['recruitCV','surveyCV','surveyBias','assessmentProcessCV','harvest','limit','trigger','implementationCV','smoothCap']);
const ranges=new Map(),shown=new Set(m.RULES.map(r=>r.id));
let view='stock',timer,toastTimer,baseline=null,playTimer=null,playingStep=false,suppress=false,historyUndo=[],editIndex=0,dragging=false,dragChanged=false,editorScale=null;
const n=(v,d=1)=>Number(v).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
const p=(v,d=0)=>n(100*v,d)+'%';
const esc=v=>String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function emit(el,type='input'){el.dispatchEvent(new Event(type,{bubbles:true}));}
function saveFile(content,type,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function stopPlayback(){clearInterval(playTimer);playTimer=null;if(globalThis.MSEFeedback)globalThis.MSEFeedback.stop();else $('play').textContent='Play feedback';}
function showView(key,scroll=true){
 if(!names[key])return;view=key;stopPlayback();
 document.body.dataset.controlsOpen='false';$('toggle-controls').setAttribute('aria-expanded','false');
 document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===key;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
 document.querySelectorAll('.view-panel').forEach(s=>s.hidden=s.id!=='view-'+key);
 document.querySelectorAll('[data-control-panel]').forEach(s=>s.hidden=s.dataset.controlPanel!==key);
 $('inspect-bar').hidden=key==='stock';
 $('toggle-controls').textContent='Edit '+names[key].toLowerCase()+' settings';
 requestAnimationFrame(()=>{api.refresh();paint();});
 if(scroll)window.scrollTo({top:document.querySelector('.flow-nav').offsetTop,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
document.querySelectorAll('[data-view]').forEach(b=>{b.addEventListener('click',()=>showView(b.dataset.view));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=Object.keys(names);let i=keys.indexOf(view);i=e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length;showView(keys[i]);$('tab-'+keys[i]).focus();});});
$('toggle-controls').addEventListener('click',()=>{const open=document.body.dataset.controlsOpen!=='true';document.body.dataset.controlsOpen=String(open);$('toggle-controls').setAttribute('aria-expanded',String(open));$('toggle-controls').textContent=(open?'Hide ':'Edit ')+names[view].toLowerCase()+' settings';requestAnimationFrame(()=>{api.refresh();paint();});});
// Pair every model slider with a typed value in classroom units.
document.querySelectorAll('input[type=range]').forEach(input=>{
 if(input.id==='year'||input.closest('[data-workshop]'))return;
 const label=input.closest('label'),span=label?.querySelector('span');if(!label)return;
 const text=Array.from(span.childNodes).filter(x=>x.nodeType===Node.TEXT_NODE).map(x=>x.textContent).join('').trim();
 label.htmlFor=input.id;input.setAttribute('aria-label',text);
 input.step='0.01';
 const factor=percent.has(input.id)?100:1,number=document.createElement('input'),wrap=document.createElement('div');
 number.type='number';number.min=String(+input.min*factor);number.max=String(+input.max*factor);number.step=String(Math.round(+input.step*factor*1000)/1000);number.value=String(+input.value*factor);number.setAttribute('aria-label',text+(factor===100?' (%)':' value'));number.dataset.companion=input.id;
 wrap.className='range-pair';input.before(wrap);wrap.append(input,number);ranges.set(input.id,{input,number,factor});
 input.addEventListener('input',()=>{number.value=String(Math.round(+input.value*factor*10000)/10000);number.removeAttribute('aria-invalid');});
 const sync=()=>{if(number.value===''||!number.checkValidity()){number.setAttribute('aria-invalid','true');return;}number.removeAttribute('aria-invalid');input.value=String(+number.value/factor);emit(input);};
 number.addEventListener('input',sync);number.addEventListener('change',sync);
});
// Keep fields programmatically and visibly labelled, including native selects.
document.querySelectorAll('label.field').forEach(label=>{const field=label.querySelector('input:not([data-companion]),select,textarea');if(field){label.htmlFor=field.id;if(!field.hasAttribute('aria-label')){const span=label.querySelector('span');if(span){const copy=span.cloneNode(true);copy.querySelectorAll('output').forEach(o=>o.remove());field.setAttribute('aria-label',copy.textContent.trim());}}}});
// Fixed catches get sliders as well as exact tonne inputs.
['catchLow','fixedCatch','catchHigh'].forEach(id=>{
 const number=$(id),wrap=document.createElement('div'),slider=document.createElement('input');number.step='.1';slider.type='range';slider.min='0';slider.max='1000';slider.step='.1';slider.value=number.value;slider.setAttribute('aria-label',number.getAttribute('aria-label')+' slider');wrap.className='range-pair';number.before(wrap);wrap.append(slider,number);
 slider.addEventListener('input',()=>{number.value=slider.value;emit(number);});number.addEventListener('input',()=>slider.value=number.value);ranges.set(id,{input:slider,number,factor:1,catch:true});
});
function syncControls(){
 ranges.forEach(({input,number,factor,catch:isCatch})=>{if(isCatch)input.value=number.value;else number.value=String(Math.round(+input.value*factor*10000)/10000);});
 document.querySelectorAll('[data-species]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.species===$('species').value)));
 const F=safeHistory();if(F){$('builder-years').value=F.length;$('builder-start').value=F[0];$('builder-end').value=F.at(-1);$('builder-turn').max=Math.max(2,F.length-1);}
 drawEditor();drawYearGrid();builderVisibility();
}
document.querySelectorAll('[data-species]').forEach(b=>b.addEventListener('click',()=>{$('species').value=b.dataset.species;emit($('species'));syncControls();}));
document.querySelectorAll('[data-set]').forEach(b=>b.addEventListener('click',()=>{const el=$(b.dataset.set);el.value=b.dataset.value;emit(el);syncControls();}));
// Debounce computation while keeping a clear distinction between drafts and results.
function updateState(){
 const state=api.busy?'busy':api.dirty?'dirty':'ready';document.body.dataset.state=state;
 $('run-state').textContent=api.busy?'Updating all eight strategies…':api.dirty?'Changes waiting to run':'Results are current';
 $('stop-run').hidden=!api.busy;$('stale-banner').hidden=!api.dirty;
 $('stale-banner').textContent=api.busy?'Settings changed during the run. The next update will use them.':'Settings changed. The plots show the last completed run.';
 $('pin-baseline').disabled=!api.result||api.busy||api.dirty;
 $('year-number').max=$('year').max;if(document.activeElement!==$('year-number'))$('year-number').value=$('year').value;$('previous').disabled=+$('year').value<=1;
}
function schedule(){clearTimeout(timer);if($('auto-update').checked&&!suppress)timer=setTimeout(()=>{stopPlayback();api.run();},650);}
document.addEventListener('mse:dirty',()=>{updateState();schedule();syncSpecies();drawSurvey();if(!dragging)drawEditor();});
function syncSpecies(){document.querySelectorAll('[data-species]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.species===$('species').value)));}
document.addEventListener('mse:start',()=>{clearTimeout(timer);stopPlayback();updateState();});
document.addEventListener('mse:result',()=>{updateState();paint();});
document.addEventListener('mse:render',()=>{updateState();paint();});
document.addEventListener('mse:configuration',syncControls);
document.addEventListener('mse:error',()=>{$('run-state').textContent='Check the settings';document.body.dataset.state='dirty';$('stop-run').hidden=true;});
$('auto-update').addEventListener('change',()=>{if($('auto-update').checked&&api.dirty)schedule();else clearTimeout(timer);});
$('stop-run').addEventListener('click',()=>{clearTimeout(timer);suppress=true;api.cancel();suppress=false;});
$('run').addEventListener('click',()=>clearTimeout(timer));
// Build, draw, import and edit the historical forcing series.
function safeHistory(){try{return m.parseHistoricalF($('historicalF').value);}catch{return null;}}
function pushUndo(){const current=$('historicalF').value;if(historyUndo.at(-1)!==current)historyUndo.push(current);if(historyUndo.length>30)historyUndo.shift();}
function setHistory(F,{remember=true,commit=true,grid=true}={}){if(remember)pushUndo();$('historicalF').value=F.map(x=>String(Number(Number(x).toFixed(3)))).join(', ');$('historyPreset').value='custom';editIndex=Math.min(editIndex,F.length-1);if(commit)emit($('historicalF'));drawEditor();if(commit&&grid)drawYearGrid();}
function builderVisibility(){document.querySelectorAll('[data-peak]').forEach(el=>el.hidden=$('builder-shape').value!=='rebuild');$('builder-end').disabled=$('builder-shape').value==='flat';}
$('builder-shape').addEventListener('change',builderVisibility);
$('apply-history').addEventListener('click',()=>{try{const controls=['years','start','end','peak','turn'];if(controls.some(k=>!$('builder-'+k).checkValidity()||$('builder-'+k).value===''))throw Error('Check the history builder values.');setHistory(helpers.buildHistory(Object.fromEntries(['shape',...controls].map(k=>[k,$('builder-'+k).value]))));toast('Fishing history updated. Drag any bar to fine-tune it.');}catch(e){toast(e.message);}});
$('historyPreset').addEventListener('change',()=>{historyUndo=[];syncControls();});
$('historicalF').addEventListener('change',()=>{syncControls();});
$('historicalF').addEventListener('input',()=>{if(!dragging){drawEditor();drawYearGrid();}});
$('undo-history').addEventListener('click',()=>{if(!historyUndo.length)return;$('historicalF').value=historyUndo.pop();$('historyPreset').value='custom';emit($('historicalF'));syncControls();});
$('edit-year').addEventListener('input',()=>{const F=safeHistory();if(!F)return;editIndex=Math.max(0,Math.min(F.length-1,Math.round(+$('edit-year').value)-1));drawEditor();});
let annualEditing=false;
$('edit-f').addEventListener('focus',()=>annualEditing=false);
$('edit-f').addEventListener('input',()=>{const F=safeHistory(),el=$('edit-f');if(!F||el.value===''||!el.checkValidity()){el.setAttribute('aria-invalid','true');return;}el.removeAttribute('aria-invalid');if(F[editIndex]===+el.value)return;if(!annualEditing){pushUndo();annualEditing=true;}F[editIndex]=+el.value;setHistory(F,{remember:false});});
function node(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));if(text!==undefined)el.textContent=text;return el;}
function axes(id,{xMin=0,xMax=1,yMin=0,yMax=1,xTitle='',yTitle='',title='',percentY=false,percentX=false,integerX=false}={}){
 const box=$(id);if(!box||!box.clientWidth)return null;const width=Math.max(240,box.clientWidth),height=box.clientHeight||340,extra=document.documentElement.dataset.textSize==='large'?16:0,left=82+extra,right=20,top=22,bottom=62+extra,W=width-left-right,H=height-top-bottom;
 const svg=node('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':title});svg.append(node('title',{},title));box.replaceChildren(svg);
 const X=x=>left+(x-xMin)/(xMax-xMin||1)*W,Y=y=>top+H-(y-yMin)/(yMax-yMin||1)*H;
 for(let i=0;i<=4;i++){const y=yMin+(yMax-yMin)*i/4;svg.append(node('line',{x1:left,y1:Y(y),x2:left+W,y2:Y(y),stroke:'#dce6e7'}));svg.append(node('text',{x:left-8,y:Y(y)+4,'text-anchor':'end'},n(y,Number.isInteger(Math.round(y*1e9)/1e9)?0:Math.abs(y)<1?2:1)+(percentY?'%':'')));}
 const ticks=width<380?3:4,seen=new Set();for(let i=0;i<=ticks;i++){let x=xMin+(xMax-xMin)*i/ticks;if(integerX)x=Math.max(Math.ceil(xMin),Math.min(Math.floor(xMax),Math.round(x)));if(seen.has(x))continue;seen.add(x);svg.append(node('text',{x:X(x),y:top+H+20,'text-anchor':'middle'},n(x,Number.isInteger(Math.round(x*1e9)/1e9)?0:Math.abs(x)<1?2:1)+(percentX?'%':'')));}
 svg.append(node('text',{x:left+W/2,y:height-7,'text-anchor':'middle',class:'axis-title'},xTitle));svg.append(node('text',{x:15,y:top+H/2,transform:`rotate(-90,15,${top+H/2})`,'text-anchor':'middle',class:'axis-title'},yTitle));
 const clipId=id+'-new-clip',defs=node('defs'),clip=node('clipPath',{id:clipId});clip.append(node('rect',{x:left,y:top,width:W,height:H}));defs.append(clip);svg.append(defs);const marks=node('g',{'clip-path':`url(#${clipId})`});svg.append(marks);return{svg,marks,X,Y,width,height,left,top,W,H,xMin,xMax,yMax};
}
function poly(P,values,color,dash='',width=2){P.marks.append(node('path',{d:values.map((q,i)=>(i?'L':'M')+P.X(q.x)+','+P.Y(q.y)).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash}));}
function hline(P,y,color='#b4582f',dash='5 4'){P.marks.append(node('line',{x1:P.left,y1:P.Y(y),x2:P.left+P.W,y2:P.Y(y),stroke:color,'stroke-dasharray':dash}));}
function nice(v){const s=10**Math.floor(Math.log10(v||1));return Math.ceil(v/s*2)/2*s;}
function drawEditor(){
 const F=safeHistory(),box=$('history-editor');if(!F){box.textContent='Check the annual F values to edit this plot.';return;}
 editIndex=Math.max(0,Math.min(editIndex,F.length-1));const max=dragging&&editorScale?editorScale.yMax:Math.min(3,Math.max(.5,nice(Math.max(...F)*1.3)));
 const P=axes('history-editor',{xMin:.5,xMax:F.length+.5,yMax:max,integerX:true,xTitle:'Historical fishing year',yTitle:'Fishing pressure (F / year)',title:'Editable annual historical fishing mortality'});if(!P)return;editorScale=P;
 const w=P.W/F.length*.84;F.forEach((v,i)=>{const rect=node('rect',{x:P.X(i+1)-w/2,y:P.Y(v),width:w,height:Math.max(2,P.top+P.H-P.Y(v)),fill:i===editIndex?'#b4582f':'#3a78a9',opacity:i===editIndex?1:.78});rect.append(node('title',{},`Year ${i+1}: F = ${v} / year`));P.marks.append(rect);});
 P.svg.append(node('text',{x:P.left+P.W-3,y:12,'text-anchor':'end',fill:'#b4582f'},`Year ${editIndex+1} · F ${n(F[editIndex],3)}`));
 $('edit-year').max=F.length;$('edit-year').value=editIndex+1;if(document.activeElement!==$('edit-f'))$('edit-f').value=F[editIndex];$('undo-history').disabled=!historyUndo.length;
}
function drawYearGrid(){const F=safeHistory();if(!F)return;$('year-grid').innerHTML=F.map((v,i)=>`<label>Year ${i+1}<input type="number" min="0" max="3" step=".01" value="${v}" aria-label="Historical F in year ${i+1}" data-annual-f="${i}"></label>`).join('');}
$('year-grid').addEventListener('focusin',()=>annualEditing=false);
$('year-grid').addEventListener('input',e=>{if(!e.target.matches('[data-annual-f]'))return;if(e.target.value===''||!e.target.checkValidity()){e.target.setAttribute('aria-invalid','true');return;}e.target.removeAttribute('aria-invalid');const F=safeHistory();if(!annualEditing){pushUndo();annualEditing=true;}F[+e.target.dataset.annualF]=+e.target.value;editIndex=+e.target.dataset.annualF;setHistory(F,{remember:false,grid:false});});
function editPointer(e){if(!editorScale)return;const P=editorScale,rect=$('history-editor').getBoundingClientRect(),F=safeHistory();if(!F)return;const x=(e.clientX-rect.left)*P.width/rect.width,y=e.clientY-rect.top;editIndex=Math.max(0,Math.min(F.length-1,Math.round(P.xMin+(x-P.left)/P.W*(P.xMax-P.xMin))-1));F[editIndex]=Math.round(Math.max(0,Math.min(3,(P.top+P.H-y)/P.H*P.yMax))*1000)/1000;dragChanged=true;setHistory(F,{remember:false,commit:false});}
$('history-editor').addEventListener('pointerdown',e=>{if(e.button!==0||!editorScale)return;const rect=$('history-editor').getBoundingClientRect();if(e.clientX-rect.left<editorScale.left||e.clientX-rect.left>editorScale.left+editorScale.W||e.clientY-rect.top<editorScale.top||e.clientY-rect.top>editorScale.top+editorScale.H)return;e.preventDefault();pushUndo();dragging=true;dragChanged=false;$('history-editor').setPointerCapture(e.pointerId);editPointer(e);});
$('history-editor').addEventListener('pointermove',e=>{if(dragging)editPointer(e);});
function finishDrag(){if(!dragging)return;dragging=false;if(dragChanged){emit($('historicalF'));drawYearGrid();}drawEditor();}
$('history-editor').addEventListener('pointerup',finishDrag);$('history-editor').addEventListener('pointercancel',finishDrag);
$('history-editor').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const F=safeHistory();if(!F)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){editIndex=Math.max(0,Math.min(F.length-1,editIndex+(e.key==='ArrowRight'?1:-1)));drawEditor();}else{F[editIndex]=Math.round(Math.max(0,Math.min(3,F[editIndex]+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?.1:.01)))*1000)/1000;setHistory(F);}});
$('import-history').addEventListener('click',()=>$('history-file').click());
$('history-file').addEventListener('change',async()=>{const file=$('history-file').files[0];if(!file)return;try{if(file.size>2e6)throw Error('Choose a CSV smaller than 2 MB.');const F=helpers.parseCSV(await file.text());setHistory(F);syncControls();toast(`Imported ${F.length} historical years.`);}catch(e){toast(e.message);}finally{$('history-file').value='';}});
$('export-input-f').addEventListener('click',()=>{const F=safeHistory();if(!F){toast('Check the F values first.');return;}saveFile('year,F\n'+F.map((v,i)=>`${i+1},${v}`).join('\n'),'text/csv','historical-F-input.csv');});
// Reusable classroom scenarios and portable saved settings.
function apply(c){clearTimeout(timer);stopPlayback();suppress=true;api.applyConfiguration(c);suppress=false;historyUndo=[];syncControls();if($('auto-update').checked)api.run();else updateState();}
$('reset-scenario').addEventListener('click',()=>{apply({...m.DEFAULTS,historicalF:m.DEFAULTS.historicalF.slice()});$('historyPreset').value='development';showView('stock');toast('Classroom defaults restored.');});
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{const c={...m.DEFAULTS};let key='stock';if(b.dataset.scenario==='rebuild'){c.species='long';c.historicalF=m.historicalPreset('rebuilding');c.years=100;c.rule='framp';}if(b.dataset.scenario==='noise'){c.surveyCV=.5;c.surveyEvery=2;c.estimator='direct';key='data';}if(b.dataset.scenario==='catch'){c.species='short';const ref=m.referencePoints(m.makeStock('short'),c);c.catchLow=Math.round(ref.MSY*.5);c.fixedCatch=Math.round(ref.MSY);c.catchHigh=Math.round(ref.MSY*1.5);key='results';}apply(c);showView(key);toast('Classroom scenario loaded.');}));
$('msy-catches').addEventListener('click',()=>{try{const c=api.configuration(),ref=m.referencePoints(m.makeStock(c.species,c.Mfactor),c);['catchLow','fixedCatch','catchHigh'].forEach((id,i)=>{$(id).value=Math.min(1000,Math.round(ref.MSY*[.5,1,1.5][i]));});emit($('fixedCatch'));syncControls();toast('Catch levels set using the current management-model MSY.');}catch(e){toast(e.message);}});
$('save-scenario').addEventListener('click',()=>{try{saveFile(JSON.stringify({format:'fisheries-mse-scenario',interfaceVersion:'1.9.0',config:api.configuration(),workshop:globalThis.MSEWorkshop?.getState(),comparison:globalThis.MSETradeoffView?.getState()},null,2),'application/json','fisheries-mse-scenario.json');}catch(e){toast(e.message);}});
$('load-scenario').addEventListener('click',()=>$('scenario-file').click());
$('scenario-file').addEventListener('change',async()=>{const file=$('scenario-file').files[0];if(!file)return;try{if(file.size>5e6)throw Error('Choose a scenario smaller than 5 MB.');const data=JSON.parse(await file.text());const config=m.check(data.config||data);if(data.comparison)globalThis.MSETradeoffView?.loadState(data.comparison);if(data.workshop)globalThis.MSEWorkshop?.loadState(data.workshop);apply(config);toast('Saved scenario loaded.');}catch(e){toast('Could not load the scenario: '+e.message);}finally{$('scenario-file').value='';}});
// Comparison views show common-rule outcomes, rather than just a selected path.
$('strategy-toggles').innerHTML=m.RULES.map(r=>`<label><input type="checkbox" data-show-rule="${r.id}" checked><i style="background:${colors[r.id]}"></i>${esc(r.short)}</label>`).join('');
$('strategy-toggles').addEventListener('change',e=>{const id=e.target.dataset.showRule;if(!id)return;e.target.checked?shown.add(id):shown.delete(id);drawComparisons();});
function drawComparisons(){
 const result=api.result;if(!result||view!=='results')return;const {config:c,rules}=result,visible=rules.filter(r=>shown.has(r.id));
 let P;if(globalThis.MSETradeoffView)globalThis.MSETradeoffView.drawPairwise();else{
 P=axes('tradeoff-chart',{xMax:nice(Math.max(1,...rules.map(r=>r.metrics.meanCatch))*1.18),yMax:100,xTitle:'Mean actual catch (t / year)',yTitle:'Chance of a low stock (%)',title:'Mean catch versus probability of crossing the biomass limit',percentY:true});
 if(P){rules.forEach((r,i)=>{const active=r.id===api.selected,x=P.X(r.metrics.meanCatch),y=P.Y(r.metrics.risk*100),g=node('g',{role:'button',tabindex:0,'aria-label':`${r.name}: mean catch ${n(r.metrics.meanCatch)} tonnes, risk ${p(r.metrics.risk,1)}. Select strategy.`});const circle=node('circle',{cx:x,cy:y,r:active?8:6,fill:colors[r.id],stroke:active?'#102f3b':'#fff','stroke-width':active?2:1.5});g.append(circle);g.append(node('title',{},`${r.name}\nCatch ${n(r.metrics.meanCatch)} t/year\nRisk ${p(r.metrics.risk,1)}`));if(active)g.append(node('text',{x:x+12,y:y-12,fill:colors[r.id],'font-weight':700},r.short));g.style.cursor='pointer';g.addEventListener('click',()=>api.chooseRule(r.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();api.chooseRule(r.id);}});P.svg.append(g);});}
 let legend=$('tradeoff-legend');if(!legend){legend=document.createElement('div');legend.id='tradeoff-legend';legend.className='quick-values';$('tradeoff-chart').after(legend);legend.addEventListener('click',e=>{const button=e.target.closest('[data-select-rule]');if(button)api.chooseRule(button.dataset.selectRule);});}
 legend.innerHTML=rules.map(r=>`<button type="button" data-select-rule="${r.id}" aria-pressed="${r.id===api.selected}"><i class="swatch" style="background:${colors[r.id]}"></i>${esc(r.short)}</button>`).join('');
 }
 const baselineRule=baseline?.rules.find(r=>r.id===api.selected);
 let maxBio=Math.max(100,...visible.flatMap(r=>r.biomass.map(q=>q.mid/10)),...(baselineRule?baselineRule.biomass.map(q=>q.mid/10):[]));
 P=axes('all-biomass',{xMax:Math.max(c.years,baseline?.config.years||0),yMax:nice(maxBio*1.12),integerX:true,xTitle:'Years ahead',yTitle:'SSB (% unfished)',title:'Median spawning biomass for all visible strategies',percentY:true});
 if(P){hline(P,c.limit*100);visible.forEach(r=>poly(P,r.biomass.map(q=>({x:q.x,y:q.mid/10})),colors[r.id],'',r.id===api.selected?3.5:1.8));if(baselineRule)poly(P,baselineRule.biomass.map(q=>({x:q.x,y:q.mid/10})),'#253b45','6 4',2);}
 P=axes('all-catch',{xMin:1,xMax:Math.max(c.years,baseline?.config.years||0),yMax:nice(Math.max(1,...visible.flatMap(r=>r.catches.map(q=>q.mid)),...(baselineRule?baselineRule.catches.map(q=>q.mid):[]))*1.12),integerX:true,xTitle:'Years ahead',yTitle:'Typical catch (tonnes)',title:'Median realized catch for all visible strategies'});
 if(P){visible.forEach(r=>poly(P,r.catches.map(q=>({x:q.x+1,y:q.mid})),colors[r.id],'',r.id===api.selected?3.5:1.8));if(baselineRule)poly(P,baselineRule.catches.map(q=>({x:q.x+1,y:q.mid})),'#253b45','6 4',2);}
}
function drawMetrics(){const result=api.result;if(!result)return;const r=result.rules.find(x=>x.id===api.selected),v=r.metrics,b=baseline?.rules.find(x=>x.id===r.id)?.metrics;
 const delta=(a,old,unit)=>b?`${a-old>=0?'+':''}${n(a-old,1)} ${unit} from pinned run`:r.name;
 $('metric-cards').innerHTML=[['Average catch',n(v.meanCatch,1)+' t/year',b?delta(v.meanCatch,b.meanCatch,'t/year'):'Average across all futures'],['Chance of a low stock',p(v.risk,1),b?delta(v.risk*100,b.risk*100,'percentage points'):`SSB below ${p(result.config.limit)} of the unfished level at least once in ${result.config.years} years`],['Typical SSB at the end',p(v.terminal,1)+' of unfished level',b?delta(v.terminal*100,b.terminal*100,'percentage points'):'The middle outcome at the end']].map(([label,value,note])=>`<div class="metric-card"><small class="metric-label">${globalThis.MSEVisuals?.iconForLabel(label)||''}${label}</small><strong>${value}</strong><span>${esc(note)}</span></div>`).join('');
 $('selected-context').textContent=['fmsy','framp'].includes(r.id)?'FMSY = the model’s target fishing rate.':'';
 $('baseline-bar').hidden=!baseline;if(baseline)$('baseline-bar').innerHTML=`<strong>Pinned baseline:</strong> ${esc(m.PRESETS[baseline.config.species].example)}, survey CV ${p(baseline.config.surveyCV)}, ${baseline.config.years} years, seed ${baseline.config.seed}. The dark dashed line shows the pinned run’s selected strategy. Deltas compare the same rule.<div class="button-row"><button type="button" class="btn" id="restore-baseline">Restore baseline settings</button><button type="button" class="btn" id="clear-baseline">Clear baseline</button></div>`;
}
$('pin-baseline').addEventListener('click',()=>{if(!api.result||api.dirty||api.busy)return;baseline=structuredClone(api.result);paint();toast('Baseline pinned for this browser session. Change one setting to compare.');});
$('baseline-bar').addEventListener('click',e=>{if(e.target.id==='clear-baseline'){baseline=null;paint();}if(e.target.id==='restore-baseline')apply({...baseline.config});});
function drawSurvey(){
 const cv=+$('surveyCV').value,bias=+$('surveyBias').value,q=+$('surveyQ').value,stock=m.makeStock($('species').value);
 const c={...m.DEFAULTS,surveyQ:q,surveyMinAge:Math.min(stock.A,+$('surveyMinAge').value||1)},expected=m.surveyExpectation(stock.unfished,stock,c).index;
 const random=m.rng(7631),values=Array.from({length:20},(_,i)=>({x:i+1,y:expected*(1+bias)*m.multiplier(cv,m.normal(random))}));
 const P=axes('survey-demo',{xMin:1,xMax:20,yMax:nice(Math.max(expected,...values.map(v=>v.y))*1.1),xTitle:'Repeated survey',yTitle:'Survey index (relative units)',title:'Repeated relative index observations of a fixed stock',integerX:true});if(!P)return;
 hline(P,expected);values.forEach(v=>P.marks.append(node('circle',{cx:P.X(v.x),cy:P.Y(v.y),r:4,fill:'#b4582f'})));
}

function setYear(year){$('year').value=Math.max(1,Math.min(+$('year').max,year));emit($('year'));updateState();}
$('previous').addEventListener('click',()=>{stopPlayback();setYear(+$('year').value-1);});
$('year-number').addEventListener('input',()=>{if($('year-number').value!==''&&$('year-number').checkValidity()){stopPlayback();setYear(+$('year-number').value);}});
$('year').addEventListener('input',()=>{if(!playingStep&&!globalThis.MSEFeedback?.advancing)stopPlayback();updateState();});$('next').addEventListener('click',()=>{stopPlayback();updateState();});
$('play').addEventListener('click',()=>{if(globalThis.MSEFeedback){globalThis.MSEFeedback.toggle();return;}if(playTimer){stopPlayback();return;}if(+$('year').value>=+$('year').max)setYear(1);$('play').textContent='Pause';playTimer=setInterval(()=>{const next=+$('year').value+1;if(next>+$('year').max){stopPlayback();return;}$('year').value=next;playingStep=true;emit($('year'));playingStep=false;$('play').textContent='Pause';updateState();},700);});
// Enlarged and downloadable plots retain their scientific labels and legends.
function exportSVG(figure){const source=figure.querySelector('.chart svg,.history-editor svg');if(!source)return null;const svg=source.cloneNode(true),vb=source.viewBox.baseVal,title=figure.querySelector('h3')?.textContent||'Fisheries MSE plot';
 const legend=Array.from(figure.querySelectorAll('.legend>span')).filter(s=>!s.hidden).map(s=>s.textContent.trim()).join(' · '),width=vb.width||source.width.baseVal.value,height=vb.height||source.height.baseVal.value,font=document.documentElement.dataset.textSize==='large'?16:14;
 function wrap(value,size){const lines=[];let line='';for(const word of value.split(/\s+/)){if(line&&(line+' '+word).length*size*.58>width-28){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
 const titleLines=wrap(title,font+4),legendLines=wrap(legend,font),header=20+titleLines.length*(font+8)+legendLines.length*(font+5)+12;
 svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('viewBox',`0 0 ${width} ${height+header+16}`);svg.setAttribute('width',width);svg.setAttribute('height',height+header+16);
 const content=node('g',{transform:`translate(0,${header})`});while(svg.firstChild)content.append(svg.firstChild);svg.append(node('rect',{width,height:height+header+16,fill:'#fff'}));const style=node('style',{},`text{font-family:Arial,sans-serif;font-size:${font}px;fill:#4c636d}.axis-title{font-size:${font+1}px;fill:#173541}.grid{stroke:#e1e9eb}.frame{fill:none;stroke:#cad8dc}.tick{stroke:#aebfc6}`);svg.append(style);
 let y=font+8;titleLines.forEach(line=>{const t=node('text',{x:14,y,'font-weight':700},line);t.style.fontSize=(font+4)+'px';svg.append(t);y+=font+8;});legendLines.forEach(line=>{svg.append(node('text',{x:14,y:y+2},line));y+=font+5;});svg.append(content);return{svg,title};
}

document.querySelectorAll('.figure').forEach(figure=>{if(!figure.querySelector('.chart,.history-editor'))return;const tools=document.createElement('div');tools.className='plot-tools';tools.innerHTML='<button type="button" data-plot-action="expand" aria-label="Enlarge this plot">↗</button><button type="button" data-plot-action="save" aria-label="Download this plot as SVG">SVG ↓</button>';figure.append(tools);tools.addEventListener('click',e=>{const action=e.target.dataset.plotAction;if(!action)return;const out=exportSVG(figure);if(!out){toast('Run a simulation to populate this plot.');return;}if(action==='save')saveFile(new XMLSerializer().serializeToString(out.svg),'image/svg+xml',out.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.svg');else{$('expanded-title').textContent=out.title;$('expanded-plot').replaceChildren(out.svg);$('plot-dialog').showModal();}});});
$('close-plot').addEventListener('click',()=>$('plot-dialog').close());$('plot-dialog').addEventListener('click',e=>{if(e.target===$('plot-dialog'))$('plot-dialog').close();});
function paint(){drawEditor();drawSurvey();drawMetrics();drawComparisons();updateState();}
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{api.refresh();paint();},120);});
globalThis.MSEViews={showView,axes,poly,hline,colors,saveFile,toast};
syncControls();updateState();paint();
})();
