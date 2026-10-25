/* A synchronized history and feedback player for any chosen MPs. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=globalThis.__mseDemo,m=globalThis.MSELab,V=globalThis.MSEViews,T=globalThis.MSETrajectory,icons=globalThis.MSEVisuals;
if(!$('timeline-ssb-chart'))return;
const available=m.RULES.map(r=>r.id),storageKey='fisheries-mse-timeline-v1',dashes=['','8 4','2 5','10 3 2 3','12 4','4 3','10 3 2 3 2 3','1 4'];
let ids=T.defaults(available,api.selected),catchView='catch',speed=1,time=0,phase=0,playing=false,timer=null,advancing=false,currentResult=null,pendingLoad=null,choiceNames='';
const n=(x,d=1)=>Number(x).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
function validate(input){
 if(!input||!['catch','advice'].includes(input.catchView)||![.5,1,4].includes(+input.speed))throw Error('Check the timeline view and playback speed.');
 const state={ids:T.selection(input.ids,available),catchView:input.catchView,speed:+input.speed};
 if(input.time!==undefined){if(!Number.isInteger(input.time)||input.time< -150||input.time>150||!Number.isInteger(input.phase)||input.phase<0||input.phase>3)throw Error('Check the saved timeline year and step.');Object.assign(state,{time:input.time,phase:input.phase});}
 return state;
}
try{const saved=localStorage.getItem(storageKey);if(saved){const s=validate(JSON.parse(saved));ids=s.ids;catchView=s.catchView;speed=s.speed;}}catch{}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({ids,catchView,speed}));}catch{}}
function getState(){return {ids:ids.slice(),catchView,speed,time,phase};}
function loadState(input){const s=validate(input);stop();ids=s.ids;catchView=s.catchView;speed=s.speed;pendingLoad=s;persist();}
const panel=document.querySelector('[data-control-panel=future]');
panel.querySelector('.control-heading').textContent='Timeline settings';
const intervalLabel=document.createElement('label');intervalLabel.className='field';intervalLabel.htmlFor='futureAssessmentEvery';intervalLabel.innerHTML='<span>Assessment interval</span><select id="futureAssessmentEvery" aria-label="Assessment interval in the animation">'+$('assessmentEvery').innerHTML+'</select>';
const help=document.createElement('p');help.className='lesson-help';help.textContent='All selected MPs are assessed on this schedule. Each sets its own annual catch advice.';
const tryThree=document.createElement('button');tryThree.type='button';tryThree.className='btn';tryThree.id='try-three-year-cycle';tryThree.textContent='Try a 3-year cycle';
const speedLabel=document.createElement('label');speedLabel.className='field feedback-speed';speedLabel.htmlFor='feedback-speed';speedLabel.innerHTML='<span>Playback speed</span><select id="feedback-speed" aria-label="Animation speed"><option value="0.5">Slow</option><option value="1">Normal</option><option value="4">Fast</option></select>';
panel.querySelector('.control-heading').after(intervalLabel,help,tryThree,speedLabel);
const editHistory=document.createElement('button');editHistory.type='button';editHistory.className='btn';editHistory.id='timeline-edit-history';editHistory.textContent='Edit fishing history';editHistory.addEventListener('click',()=>V.showView('stock'));speedLabel.after(editHistory);
const stepIcons=['survey','chart','rule','fish'];document.querySelectorAll('[data-timeline-step]').forEach((el,i)=>el.insertAdjacentHTML('afterbegin',icons.icon(stepIcons[i])));
$('timeline-detail-rule').innerHTML=m.RULES.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
$('timeline-detail-rule').addEventListener('change',()=>api.chooseRule($('timeline-detail-rule').value));
const watch=$('watch-feedback');if(watch)watch.addEventListener('click',()=>V.showView('future'));
function context(){return api.result?T.frame(api.result,time,phase):null;}
function buttonState(){const f=context();$('play').textContent=playing?'Pause':f?.complete?'Replay timeline':'Play timeline';$('play').setAttribute('aria-pressed',String(playing));}
function stop(){clearTimeout(timer);timer=null;playing=false;buttonState();$('feedback-stage').classList.remove('playing');}
function syncYear(){
 const f=context();if(!f||f.history)return;const year=f.year;
 if(+$('year').value!==year){advancing=true;$('year').value=year;$('year').dispatchEvent(new Event('input',{bubbles:true}));advancing=false;}
}
function setTime(value,newPhase=0){stop();const f=T.frame(api.result,value,newPhase);time=f.time;phase=f.phase;syncYear();render();}
function order(){const f=context();if(f.history||f.complete)return [];return f.due?[0,1,2,3]:api.result.rules.find(r=>r.id===ids[0]).path.surveyVisits[f.t]?[0,2,3]:[2,3];}
function start(){if(!api.result||api.dirty||api.busy)return;if(context().complete){time=-api.result.history.years;phase=0;}playing=true;buttonState();render();scheduleNext();}
function toggle(){if(playing){stop();render();}else start();}
function scheduleNext(){
 if(!playing)return;const f=context(),duration=f.history?250:phase===1?900:phase===3?800:500;
 timer=setTimeout(()=>{
  if(!playing)return;const f=context();
  if(f.history){time++;phase=0;}
  else if(f.complete){stop();render();return;}
  else{const steps=order(),at=steps.indexOf(phase);if(at>=0&&at<steps.length-1)phase=steps[at+1];else{time++;phase=0;}}
  syncYear();if(context().complete)stop();render();if(playing)scheduleNext();
 },duration/speed);
}
function changeInterval(value){stop();$('assessmentEvery').value=String(value);$('futureAssessmentEvery').value=String(value);$('assessmentEvery').dispatchEvent(new Event('input',{bubbles:true}));}
$('futureAssessmentEvery').addEventListener('change',()=>changeInterval(+$('futureAssessmentEvery').value));tryThree.addEventListener('click',()=>changeInterval(3));
$('feedback-speed').addEventListener('change',()=>{speed=+$('feedback-speed').value;persist();if(playing){clearTimeout(timer);scheduleNext();}});
$('timeline-from-history').addEventListener('click',()=>{if(!api.result||api.dirty||api.busy)return;setTime(-api.result.history.years);start();});
$('timeline-to-feedback').addEventListener('click',()=>{if(api.result)setTime(0);});
$('timeline-to-end').addEventListener('click',()=>{if(api.result)setTime(api.result.config.years,3);});
$('timeline-position').addEventListener('input',()=>{if(api.result)setTime(+$('timeline-position').value);});
$('timeline-number').addEventListener('input',()=>{const el=$('timeline-number');if(api.result&&el.value!==''&&el.checkValidity())setTime(+el.value);});
$('timeline-catch-view').addEventListener('change',()=>{catchView=$('timeline-catch-view').value;persist();render();});
$('timeline-mp-choices').addEventListener('change',e=>{const id=e.target.dataset.timelineMp;if(!id)return;stop();ids=e.target.checked?[...ids,id]:ids.filter(v=>v!==id);persist();render();});
function choices(result){
 const key=result.rules.map(r=>r.name).join('|');
 if(choiceNames!==key){choiceNames=key;$('timeline-mp-choices').innerHTML=result.rules.map(r=>`<label class="timeline-mp-choice"><input type="checkbox" data-timeline-mp="${r.id}" aria-label="Follow ${esc(r.name)}"><i class="swatch" style="background:${V.colors[r.id]}"></i><span>${esc(r.name)}</span></label>`).join('');}
 document.querySelectorAll('[data-timeline-mp]').forEach(el=>{el.checked=ids.includes(el.dataset.timelineMp);el.disabled=el.checked&&ids.length===1;el.closest('label').classList.toggle('included',el.checked);});
 text('timeline-choice-title',`Choose MPs to follow · ${ids.length} selected`);
}
function node(tag,attrs={},value){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(value!==undefined)el.textContent=value;return el;}
function nice(value){const step=10**Math.floor(Math.log10(value||1))/5;return Math.ceil(value/step)*step;}
function plot(id,r,data,kind){
 const box=$(id);if(!box.clientWidth)return;
 const width=box.clientWidth,height=box.clientHeight||280,large=document.documentElement.dataset.textSize==='large',left=large?86:76,right=20,top=34,bottom=53,W=width-left-right,H=height-top-bottom;
 const Hyears=r.history.years,Yyears=r.config.years,xmin=-Hyears,xmax=Yyears;
 const raw=data.rules.map(q=>r.rules.find(p=>p.id===q.id).path);
 const ymax=kind==='ssb'?nice(Math.max(...r.history.ssb,...raw.flatMap(p=>p.ssb))*1.1):nice(Math.max(1,...r.history.catch,...raw.flatMap(p=>[...p.catch,...p.advice]))*1.1);
 const X=x=>left+(x-xmin)/(xmax-xmin)*W,Z=y=>top+H-y/ymax*H;
 const svg=node('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':kind==='ssb'?'Shared historical and selected MP spawning stock biomass trajectories':catchView==='advice'?'Historical catch and selected MP annual catch advice':'Historical and selected MP actual catch trajectories'});
 svg.append(node('rect',{x:left,y:top,width:X(0)-left,height:H,fill:'#eef3f4'}),node('rect',{x:X(0),y:top,width:X(xmax)-X(0),height:H,fill:'#fbfdfd'}));
 for(let j=0;j<=4;j++){const y=ymax*j/4;svg.append(node('line',{x1:left,x2:left+W,y1:Z(y),y2:Z(y),stroke:'#dce6e8'}),node('text',{x:left-9,y:Z(y)+5,'text-anchor':'end'},n(y,ymax<10?1:0)));}
 const proposed=[xmin,Math.round(xmin/2),0,Math.round(xmax/3),Math.round(2*xmax/3),xmax],ticks=[...new Set(proposed)].filter(x=>x===0||Math.abs(X(x)-X(0))>35);
 for(const x of ticks)svg.append(node('text',{x:X(x),y:top+H+22,'text-anchor':'middle'},String(x)));
 if(X(0)-left>75)svg.append(node('text',{x:left+8,y:21,'font-weight':600},'History'));
 svg.append(node('text',{x:X(0)+8,y:21,'font-weight':600},'Feedback'),node('line',{x1:X(0),x2:X(0),y1:top,y2:top+H,stroke:'#8199a2','stroke-width':1.5,'stroke-dasharray':'5 4'}));
 const title=kind==='ssb'?'SSB (tonnes)':'Tonnes / year';
 svg.append(node('text',{x:17,y:top+H/2,transform:`rotate(-90,17,${top+H/2})`,'text-anchor':'middle',class:'axis-title'},title),node('text',{x:left+W/2,y:height-5,'text-anchor':'middle',class:'axis-title'},'Year · 0 is the start of feedback'));
 const clipId=id+'-clip',defs=node('defs'),clip=node('clipPath',{id:clipId});clip.append(node('rect',{x:left-6,y:top-6,width:W+12,height:H+12}));defs.append(clip);svg.append(defs);const marks=node('g',{'clip-path':`url(#${clipId})`});svg.append(marks);
 function path(points,color,dash='',lineWidth=2.7){if(!points.length)return;marks.append(node('path',{d:points.map((p,i)=>(i?'L':'M')+X(p.x)+','+Z(p.y)).join(' '),fill:'none',stroke:color,'stroke-width':lineWidth,'stroke-linejoin':'round','stroke-linecap':'round','stroke-dasharray':dash}));}
 path(kind==='ssb'?data.historySSB:data.historyCatch,'#566B75','',2.5);
 if(kind==='ssb')marks.append(node('line',{x1:left,x2:left+W,y1:Z(r.stock.S0*r.config.limit),y2:Z(r.stock.S0*r.config.limit),stroke:'#8fa4ad','stroke-width':1,'stroke-dasharray':'5 5'}));
 for(let i=0;i<data.rules.length;i++){
  const q=data.rules[i],points=kind==='ssb'?q.ssb:catchView==='advice'?q.advice:q.catchTaken;
  path(points,V.colors[q.id],dashes[i]);
  if(points.length){const p=points.at(-1),dot=node('circle',{cx:X(p.x),cy:Z(p.y),r:4.2,fill:V.colors[q.id],stroke:'#fff','stroke-width':1.5});dot.append(node('title',{},`${q.name}: year ${p.x}, ${n(p.y)} tonnes`));marks.append(dot);}
 }
 if(data.history){const index=data.historyIndex,point=kind==='ssb'?data.historySSB[index]:index?data.historyCatch[index-1]:null;if(point)marks.append(node('circle',{cx:X(point.x),cy:Z(point.y),r:5,fill:'#566B75',stroke:'#fff','stroke-width':1.5}));}
 marks.append(node('line',{x1:X(data.cursor),x2:X(data.cursor),y1:top,y2:top+H,stroke:'#173541','stroke-width':1.4,'stroke-dasharray':'3 4'}));
 if(kind==='ssb'&&!data.history)for(let x=0;x<Yyears;x+=r.config.assessmentEvery){if(x<time||x===time&&phase>=1||data.complete)svg.append(node('circle',{cx:X(x),cy:top-7,r:x===time&&phase===1?4:2.2,fill:'#0a7a70'}));}
 box.replaceChildren(svg);
 const legend=$('timeline-'+(kind==='ssb'?'ssb':'catch')+'-legend');legend.innerHTML='<span><i class="timeline-key" style="border-color:#566B75"></i>Shared history</span>'+data.rules.map((p,i)=>`<span><i class="timeline-key key-${i}" data-dash="${dashes[i]}" style="border-color:${V.colors[p.id]}"></i>${esc(p.short)}</span>`).join('');
}
function cards(r,data){
 const box=$('timeline-mp-cards');
 if(data.history){const i=data.historyIndex,S=r.history.ssb[i];box.innerHTML=`<div class="timeline-value-card history-card"><strong>Shared historical population</strong><b>${n(S)} t SSB</b><span>${i?'After historical year '+i+' · prescribed F '+n(r.history.F[i-1],3)+' / year':'Before the first historical fishing year'}</span><span>Every MP starts from the same population at year 0.</span></div>`;return;}
 box.innerHTML=T.snapshots(r,ids,time,phase).map(p=>`<div class="timeline-value-card" style="--mp-color:${V.colors[p.id]}"><strong>${esc(r.rules.find(q=>q.id===p.id).short)}</strong><b>${n(p.ssb)} t SSB</b><span>${p.advice===null?'Advice awaits assessment':(data.due?'New advice: ':'Advice held: ')+n(p.advice)+' t/year'}</span><small>${p.advice===null?'':`For years ${p.assessmentYear}–${p.adviceThroughYear}. `}${p.catchTaken===null?'':`Catch taken: ${n(p.catchTaken)} t.`}</small></div>`).join('');
}
function render(){
 const r=api.result;$('futureAssessmentEvery').value=$('assessmentEvery').value;$('feedback-speed').value=String(speed);$('timeline-catch-view').value=catchView;
 const disabled=!r||api.dirty||api.busy;$('play').disabled=disabled;$('timeline-from-history').disabled=disabled;$('timeline-csv').disabled=disabled;for(const id of ['timeline-to-feedback','timeline-to-end','timeline-position','timeline-number'])$(id).disabled=!r;if(!r)return;
 if(currentResult!==r){stop();currentResult=r;time=pendingLoad?.time??0;phase=pendingLoad?.phase??0;pendingLoad=null;const f=T.frame(r,time,phase);time=f.time;phase=f.phase;syncYear();}
 const data=T.series(r,ids,time,phase),f=data;choices(r);buttonState();
 for(const el of [$('timeline-position'),$('timeline-number')]){el.min=-r.history.years;el.max=r.config.years;if(document.activeElement!==el)el.value=time;}
 text('timeline-position-label',f.complete?'End of feedback · year '+r.config.years:f.history?'History · '+(-time)+' years before feedback':'Feedback year '+f.year+' of '+r.config.years);
 const stage=$('feedback-stage');stage.dataset.phase=f.history?'history':f.complete?'complete':String(phase);stage.classList.toggle('playing',playing);
 document.querySelectorAll('[data-timeline-step]').forEach(el=>{const i=+el.dataset.timelineStep,active=!f.history&&!f.complete&&i===phase;el.classList.toggle('active',active);el.classList.toggle('waiting',f.history||i===1&&!f.due);if(active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 let message;
 if(f.history)message='History: the supplied fishing pressure changes one shared population. MPs begin at year 0.';
 else if(f.complete)message=`Feedback complete: all ${r.config.years} years shown for ${ids.length} MP${ids.length===1?'':'s'}. Compare their final SSB and catches.`;
 else if(phase===0)message=`Feedback year ${f.year}: ${r.rules.find(p=>p.id===ids[0]).path.surveyVisits[f.t]?'survey each MP’s stock.':'no survey visit.'} ${f.due?'An assessment is due.':'Store new data for the next assessment.'}`;
 else if(phase===1){const years=[...new Set(ids.flatMap(id=>r.rules.find(p=>p.id===id).path.assessment[f.t].dataYearsUsed))].sort((a,b)=>a-b);message=`Assessment in year ${f.year}: ${years.length?'process available survey data from year'+(years.length===1?' ':'s ')+years.join(', '):'use model predictions'}. Each MP updates its own stock estimate.`;}
 else if(phase===2)message=f.due?`Year ${f.year}: each MP sets annual catch advice for years ${f.assessmentYear}–${r.rules[0].path.assessment[f.t].adviceThroughYear}. Next assessment: year ${f.nextAssessmentYear}.`:`Year ${f.year}: no assessment. Each MP keeps its annual advice from year ${f.assessmentYear}.`;
 else message=`End of feedback year ${f.year}: each stock changes after fishing, survival and new young fish. The colored paths advance together.`;
 text('timeline-message',message);
 text('timeline-catch-title',catchView==='advice'?'Annual catch advice':'Catch taken');
 text('timeline-catch-caption',catchView==='advice'?'Gray shows historical catch. Colored lines show annual advice, extending to the next assessment. Advice stays fixed within each period.':'Gray shows historical catch. Colored paths show catch taken by each MP. Catch taken can differ from advice.');
 text('timeline-context',`${r.history.years} historical years + ${r.config.years} feedback years. One matched simulated future per MP, under the same random conditions. SSB is the weight of mature fish.`);
 $('timeline-detail').hidden=f.history;$('timeline-detail-rule').value=api.selected;
 cards(r,data);if(!$('view-future').hidden){plot('timeline-ssb-chart',r,data,'ssb');plot('timeline-catch-chart',r,data,'catch');}
 document.querySelector('.timeline-panel').style.setProperty('--timeline-nav-height',document.querySelector('.flow-nav').offsetHeight+'px');
}
$('timeline-csv').addEventListener('click',()=>{
 const r=api.result;if(!r||api.dirty||api.busy)return;
 const headers=['model_version','phase','MP','year_within_phase','timeline_year_end','true_SSB_start_t','true_SSB_end_t','actual_catch_t','annual_catch_advice_t','actual_F_per_year','assessment_due','estimated_SSB_t','advice_through_feedback_year','survey_years_processed','configuration_json','timeline_choices_json'],rows=[],config=JSON.stringify(r.config),choice=JSON.stringify(getState());
 r.history.catch.forEach((C,t)=>rows.push([r.version,'history','shared_history',t+1,t+1-r.history.years,r.history.ssb[t],r.history.ssb[t+1],C,'',r.history.F[t],'','','','',config,choice]));
 for(const id of ids){const rule=r.rules.find(q=>q.id===id),p=rule.path;p.catch.forEach((C,t)=>rows.push([r.version,'feedback',rule.name,t+1,t+1,p.ssb[t],p.ssb[t+1],C,p.advice[t],p.F[t],p.assessment[t].assessmentDue,p.estimate[t],p.assessment[t].adviceThroughYear,JSON.stringify(p.assessment[t].dataYearsUsed),config,choice]));}
 V.saveFile([headers,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8','mse-selected-MP-trajectories.csv');
});
for(const event of ['mse:start','mse:dirty'])document.addEventListener(event,()=>{stop();render();});
for(const event of ['mse:result','mse:render','mse:configuration'])document.addEventListener(event,render);
$('year').addEventListener('input',()=>{if(!advancing){stop();time=+$('year').value-1;phase=0;render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,80);}).observe($('view-future'));
globalThis.MSEFeedback={toggle,stop,getState,loadState,get advancing(){return advancing;}};
render();
})();
