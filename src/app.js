(function(){
'use strict';
const $=id=>document.getElementById(id),m=globalThis.MSELab;
const colors={teal:'#117d79',orange:'#b4582f',blue:'#3a78a9',muted:'#586d76',purple:'#855c99'};
const ruleColor=globalThis.MSEVisuals.ruleColors;
const fields=['species','historicalF','surveyCV','surveyBias','surveyEvery','surveyData','surveyQ','surveyMinAge','ageSample','estimator','useAgeData','assumedQ','assessmentProcessCV','recruitCV','implementationCV','harvest','limit','trigger','smoothCap','Mfactor','steepness','catchLow','fixedCatch','catchHigh','Fmultiplier','years','reps','seed'];
let result=null,selected='framp',worker=null,token=0,busy=false,dirty=false;
const num=(n,d=1)=>Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n,d=0)=>num(100*n,d)+'%';
const fmt=n=>Math.abs(n)>=1000?num(n,0):Math.abs(n)>=100?num(n,0):Math.abs(n)>=10?num(n,1):num(n,2);
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function configuration(){
 for(const el of document.querySelectorAll('input[type=number][data-companion]'))if(el.value===''||!el.checkValidity())throw Error('Check '+el.getAttribute('aria-label')+'. Enter a value between '+el.min+' and '+el.max+'.');
 const v={rule:selected};for(const k of fields){const el=$(k);if(el.type==='number'&&(el.value===''||!el.checkValidity()))throw Error('Check '+(el.getAttribute('aria-label')||k)+'. Enter a value between '+el.min+' and '+el.max+'.');v[k]=k==='historicalF'?m.parseHistoricalF(el.value):['species','estimator','surveyData'].includes(k)?el.value:+el.value;}return m.check(v);
}
function descriptions(){
 for(const k of ['recruitCV','surveyCV','assessmentProcessCV','harvest','limit','trigger','implementationCV'])$(k+'-value').textContent=pct(+$(k).value);
 $('surveyBias-value').textContent=(+$('surveyBias').value>0?'+':'')+pct(+$('surveyBias').value);
 $('smoothCap-value').textContent='±'+pct(+$('smoothCap').value);
 $('steepness-value').textContent=num(+$('steepness').value,2);
 $('Fmultiplier-value').textContent=num(+$('Fmultiplier').value,2)+' × FMSY';
 $('Mfactor-value').textContent=num(+$('Mfactor').value,2)+' × true M';
 const life=m.PRESETS[$('species').value];
 $('life-profile').textContent=`${life.example} example. About half the fish are mature by age ${life.mat50}.`;
 try{const F=m.parseHistoricalF($('historicalF').value);$('history-count').textContent=`${F.length} historical years · first F = ${num(F[0],3)} · last F = ${num(F[F.length-1],3)} / year.`;}catch(e){$('history-count').textContent=e.message;}
 $('estimator-note').textContent={assessment:'Fits survey data to predicted numbers at age.',direct:'A simple comparator: scales the latest index using assumed q and an unfished age pattern. Ignores age samples and catch.',mean:'A simple comparator: averages up to 3 indices with a fixed age pattern. Ignores age samples and catch.'}[$('estimator').value];
 $('rule-note').textContent={catchLow:`Catch advice stays at ${$('catchLow').value} t/year.`,fixed:`Catch advice stays at ${$('fixedCatch').value} t/year.`,catchHigh:`Catch advice stays at ${$('catchHigh').value} t/year.`,proportional:'Catch advice is the harvest fraction × estimated spawning biomass.',ramp:`Advice declines below ${pct(+$('trigger').value)} unfished SSB and reaches zero at ${pct(+$('limit').value)}.`,smooth:`The ramp’s advice changes by at most ±${pct(+$('smoothCap').value)} per year, with a closure override and reopening exception.`,fmsy:'Targets a chosen multiple of model FMSY each year. Estimated abundance converts the F target into catch advice.',framp:'Reduces the F target between the biomass trigger and limit, with closure at the limit. Estimated abundance converts F into catch advice.'}[selected];
}
function setStatus(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function markDirty(){dirty=true;descriptions();$('csv').disabled=true;$('history-csv').disabled=true;if(!busy)setStatus('Settings changed. Update the simulation to apply them.');document.dispatchEvent(new CustomEvent('mse:dirty'));}
function progress(v){$('progress-fill').style.width=(100*v)+'%';document.querySelector('.progress').setAttribute('aria-valuenow',String(Math.round(100*v)));}
function run(){
 let c;try{c=configuration();}catch(e){setStatus(e.message,true);document.dispatchEvent(new CustomEvent('mse:error'));return;}
 if(worker){worker.terminate();worker=null;}
 const id=++token;busy=true;dirty=false;$('run').disabled=true;$('csv').disabled=true;$('history-csv').disabled=true;progress(0);setStatus('Testing eight fishing rules…');document.dispatchEvent(new CustomEvent('mse:start'));
 const done=r=>{if(id!==token)return;worker?.terminate();worker=null;result=r;busy=false;$('run').disabled=false;$('csv').disabled=dirty;$('history-csv').disabled=dirty;progress(1);$('year').max=c.years;$('year').value=Math.min(+$('year').value,c.years);setStatus(dirty?'Completed. Settings changed during the run; update to apply them.':`${c.reps.toLocaleString()} possible futures · ${c.years} years · eight fishing rules.`);render();document.dispatchEvent(new CustomEvent('mse:result'));try{localStorage.setItem('mse-classroom-v4',JSON.stringify({...c,rule:selected}));}catch{};};
 const fail=e=>{if(id!==token)return;busy=false;$('run').disabled=false;setStatus('The run could not finish: '+e.message,true);document.dispatchEvent(new CustomEvent('mse:error'));};
 try{
  const source=$('mse-model').textContent+`\nself.onmessage=e=>{try{const r=MSELab.runEnsemble(e.data,p=>postMessage({type:'progress',value:p}));postMessage({type:'result',value:r});}catch(err){postMessage({type:'error',message:err.message});}};`;
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);
  worker.onmessage=e=>{if(id!==token)return;if(e.data.type==='progress')progress(e.data.value);else if(e.data.type==='result')done(e.data.value);else fail(Error(e.data.message));};
  worker.onerror=e=>{worker?.terminate();worker=null;fail(Error(e.message||'Worker unavailable.'));};worker.postMessage(c);
 }catch{
  setTimeout(()=>{try{done(m.runEnsemble(c,progress));}catch(e){fail(e);}},30);
 }
}
function current(){return result.rules.find(r=>r.id===selected);}
function chooseRule(id){selected=id;$('rule').value=id;descriptions();if(result)render();}
function renderTable(){
 const c=result.config;
 $('run-description').textContent=`${m.PRESETS[c.species].example} · ${c.reps} futures per rule · ${c.years} years · seed ${c.seed}. Select a row to inspect its trajectories.`;
 $('history-values').innerHTML=[['Prescribed history',result.history.years+' years'],['Final historical F',num(result.initial.F,3)+' / year'],['Projection-start SSB',pct(result.initial.SSB/1000,1)+' unfished']].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('');
 $('history-description').textContent=`Starts at 1,000 t unfished SSB. The historical F series produces ${num(result.initial.SSB,1)} t SSB and its associated age structure at the handoff. Every future strategy starts from this same true population; historical survey noise can give each replicate a different estimated state.`;
 const ref=result.reference.manager;
 $('reference-values').innerHTML=[['FMSY',num(ref.Fmsy,3)+' / year'],['MSY',num(ref.MSY,1)+' t / year'],['SSBMSY / unfished',pct(ref.SSBmsy/1000,1)]].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('');
 $('reference-note').textContent=`Deterministic equilibrium benchmarks from the management model: Beverton–Holt, h = ${num(c.steepness,2)}, assumed M = ${num(c.Mfactor,2)} × true M. FMSY maximizes equilibrium catch; it does not guarantee low risk with noisy information.`;
 $('risk-heading').textContent=`Chance of a low stock`;
 $('comparison').querySelector('tbody').innerHTML=result.rules.map(r=>{
  const v=r.metrics,interval=v.riskInterval.map(x=>pct(x,1)).join(' to ');
  return `<tr class="${r.id===selected?'selected':''}"><td><button type="button" class="policy-button" data-policy="${r.id}" aria-pressed="${r.id===selected}"><i class="swatch" style="background:${ruleColor[r.id]}"></i>${escape(r.name)}</button></td><td title="${v.crossings} of ${c.reps} futures. 95% Monte Carlo interval: ${interval}">${pct(v.risk,1)} <span class="mini risk-zero">(${v.crossings}/${c.reps})</span></td><td>${num(v.meanCatch,1)}</td><td>${num(v.change,1)}</td><td>${pct(v.terminal,1)}</td></tr>`;
 }).join('');
 $('comparison').querySelectorAll('[data-policy]').forEach(b=>b.addEventListener('click',()=>chooseRule(b.dataset.policy)));
 $('risk-footnote').textContent=`Low stock means SSB below ${pct(c.limit)} of the unfished level, at least once in ${c.years} years. A simulated risk of 0% does not prove the rule is risk-free.`;
}
function renderTrace(){
 const c=result.config,r=current(),t=+$('year').value-1,path=r.path;
 $('year-value').textContent=t+1;$('next').disabled=t===c.years-1;
 const values=[['True SSB',path.ssb[t],'truth','t'],['Survey index',path.survey[t],'manager','index units'],['Survey ages',path.ageComp[t]?m.sum(path.ageComp[t]):null,'manager','fish aged'],['Estimated SSB',path.estimate[t],'manager','t'],['Allowed catch',path.advice[t],'manager','t'],['F target',path.targetF[t],'manager','/ year'],['Actual F',path.F[t],'truth','/ year'],['Actual catch',path.catch[t],'truth','t'],['Next year’s SSB',path.ssb[t+1],'truth','t']];
 $('trace').innerHTML=values.map(([label,value,role,unit])=>`<div class="trace-item ${role} ${['F target','Actual F','Next year’s SSB'].includes(label)?'extra-trace':''}"><small>${globalThis.MSEVisuals?.iconForLabel(label)||''}${label}</small><div class="trace-value">${value===null?(label==='F target'?'Catch rule':label==='Survey ages'?'No age sample':'No index'):`${num(value,unit==='t'?1:3)} <span>${unit}</span>`}</div></div>`).join('');
 const cap=path.capped?` Some quotas hit the fishing-capacity ceiling (${pct(r.metrics.capFraction,1)} of all trial-years).`:'';
 $('trace-detail').textContent=`${r.name}. One possible future, not the median. ${!path.surveyVisits[t]?'No new survey this year. ':''}The operating model knows the true state; the decision procedure does not.${cap}`;
}
function svgNode(tag,attrs={},text){const a=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))a.setAttribute(k,v);if(text!==undefined)a.textContent=text;return a;}
function tickStep(span,n=4){const raw=span/n,p=Math.pow(10,Math.floor(Math.log10(raw||1))),v=raw/p;return(v<=1?1:v<=2?2:v<=2.5?2.5:v<=5?5:10)*p;}
function stepDigits(step){for(let d=0;d<6;d++)if(Math.abs(step*10**d-Math.round(step*10**d))<1e-7)return d;return 6;}
function niceMax(x){const s=tickStep(x);return Math.ceil((x||1)/s)*s;}
function makePlot(id,{xMax,yMax,xTitle,yTitle,title,xMin=0,percent=false,xPercent=false,integerX=false}){
 const box=$(id),width=Math.max(260,box.clientWidth),height=box.clientHeight||285;
 const extra=document.documentElement.dataset.textSize==='large'?16:0,left=82+extra,right=20,top=22,bottom=62+extra,W=width-left-right,H=height-top-bottom;
 box.replaceChildren();const svg=svgNode('svg',{width,height,viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':title});
 svg.append(svgNode('title',{},title));box.append(svg);
 const clipId=id+'-clip',defs=svgNode('defs'),clip=svgNode('clipPath',{id:clipId});clip.append(svgNode('rect',{x:left,y:top,width:W,height:H}));defs.append(clip);svg.append(defs);
 const X=v=>left+(v-xMin)/(xMax-xMin||1)*W,Y=v=>top+H-(v/yMax)*H;
 const ystep=tickStep(yMax,4),ysteps=Math.round(yMax/ystep);
 for(let i=0;i<=ysteps;i++){const v=i*ystep,y=Y(v);svg.append(svgNode('line',{x1:left,y1:y,x2:left+W,y2:y,class:'grid'}));svg.append(svgNode('text',{x:left-8,y:y+4,'text-anchor':'end'},percent?num(v,0)+'%':fmt(v)));}
 const ticks=width<380?3:5,xstep=integerX?Math.max(1,Math.ceil(tickStep(xMax-xMin,ticks))):tickStep(xMax-xMin,ticks);
 for(let v=Math.ceil(xMin/xstep)*xstep;v<=xMax+1e-8;v+=xstep){const x=X(v);svg.append(svgNode('line',{x1:x,y1:top+H,x2:x,y2:top+H+5,class:'tick'}));svg.append(svgNode('text',{x,y:top+H+20,'text-anchor':'middle'},xPercent?num(v,0)+'%':num(v,integerX?0:stepDigits(xstep))));}
 svg.append(svgNode('rect',{x:left,y:top,width:W,height:H,class:'frame','data-chart-frame':''}));
 svg.append(svgNode('text',{x:left+W/2,y:height-8,'text-anchor':'middle',class:'axis-title','data-axis':'x'},xTitle));
 svg.append(svgNode('text',{x:16,y:top+H/2,'text-anchor':'middle',transform:`rotate(-90,16,${top+H/2})`,class:'axis-title','data-axis':'y'},yTitle));
 const marks=svgNode('g',{'clip-path':`url(#${clipId})`});svg.append(marks);
 return {box,svg,marks,width,height,left,top,W,H,X,Y,xMin,xMax,yMax};
}
function pathLine(points,P){return points.filter(q=>Number.isFinite(q.y)).map((q,i)=>(i?'L':'M')+P.X(q.x).toFixed(2)+','+P.Y(q.y).toFixed(2)).join('');}
function line(P,points,color,width=2,dash){P.marks.append(svgNode('path',{d:pathLine(points,P),fill:'none',stroke:color,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})}));}
function band(P,values,color){const a=values.map(q=>({x:q.x,y:q.hi})),b=values.slice().reverse().map(q=>({x:q.x,y:q.lo}));P.marks.append(svgNode('path',{d:pathLine(a.concat(b),P)+'Z',fill:color,opacity:.14,stroke:'none'}));}
function reference(P,y,label){const p=P.Y(y);P.marks.append(svgNode('line',{x1:P.left,y1:p,x2:P.left+P.W,y2:p,stroke:colors.orange,'stroke-width':1.2,'stroke-dasharray':'5,4'}));if(label&&p>P.top+14)P.svg.append(svgNode('text',{x:P.left+P.W-5,y:p-5,'text-anchor':'end'},label));}
function cursor(P,x){const px=P.X(x);P.marks.append(svgNode('line',{x1:px,y1:P.top,x2:px,y2:P.top+P.H,stroke:'#a3b6be','stroke-width':1,'stroke-dasharray':'3,3'}));}
const tooltip=$('tooltip');
function showTip(event,rows){tooltip.textContent='';rows.forEach((text,i)=>{const d=document.createElement(i?'div':'strong');d.textContent=text;tooltip.append(d);});tooltip.hidden=false;const rect=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,event.clientX+13))+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,event.clientY+13))+'px';}
function hover(P,getRows,integer=true){const overlay=svgNode('rect',{x:P.left,y:P.top,width:P.W,height:P.H,fill:'transparent','data-chart-hit':''});P.svg.append(overlay);const handler=e=>{const rect=P.svg.getBoundingClientRect(),x=P.xMin+((e.clientX-rect.left-P.left)/P.W)*(P.xMax-P.xMin);showTip(e,getRows(integer?Math.round(x):x));};overlay.addEventListener('pointermove',handler);overlay.addEventListener('pointerleave',()=>tooltip.hidden=true);overlay.addEventListener('pointerdown',handler);}
function renderCharts(){
 if(!result)return;
 const c=result.config,stock=result.stock,r=current(),t=+$('year').value-1,path=r.path,col=ruleColor[r.id];
 tooltip.hidden=true;
 const hist=result.history,hview=result.historicalView;
 // The historical F series is the forcing input, before any HCR is applied.
 let P=makePlot('history-f-chart',{xMin:.5,xMax:hist.years+.5,yMax:niceMax(Math.max(.1,...hist.F)*1.1),xTitle:'Historical fishing year',yTitle:'Prescribed F / year',title:'Supplied historical fishing mortality time series',integerX:true});
 const hw=P.W/hist.years*.8;
 hist.F.forEach((F,i)=>P.marks.append(svgNode('rect',{x:P.X(i+1)-hw/2,y:P.Y(F),width:hw,height:P.top+P.H-P.Y(F),fill:colors.blue})));
 hover(P,i=>{i=Math.max(1,Math.min(hist.years,i));return['Historical fishing year '+i,'Prescribed F: '+num(hist.F[i-1],3)+' / year','Catch: '+num(hist.catch[i-1],1)+' t','End SSB: '+pct(hist.ssb[i]/1000,1)+' unfished'];});
 const showObserved=$('show-history-observations')?.checked;const hmax=Math.max(100,...hist.ssb.map(v=>v/10),...(showObserved?hview.estimate.map(v=>v/10):[]));
 P=makePlot('history-ssb-chart',{xMax:hist.years,yMax:niceMax(hmax*1.05),xTitle:'Years before management',yTitle:'SSB (% of unfished level)',title:'Historical true and estimated SSB',percent:true,integerX:true});
 line(P,hist.ssb.map((v,i)=>({x:i,y:v/10})),colors.teal,2.5);if(showObserved)line(P,hview.estimate.map((v,i)=>({x:i,y:v/10})),colors.blue,1.5);

 P.marks.append(svgNode('circle',{cx:P.X(hist.years),cy:P.Y(result.initial.SSB/10),r:4.5,fill:colors.teal}));
 hover(P,i=>{i=Math.max(0,Math.min(hist.years,i));return['Historical year '+i,'True SSB: '+num(hist.ssb[i],1)+' t',i===hist.years?'Projection starts here':'Next supplied F: '+num(hist.F[i],3)+' / year'];});
 // Time series across replicate futures.
 const biomass=r.biomass.map(q=>({...q,lo:q.lo/10,mid:q.mid/10,hi:q.hi/10}));
 P=makePlot('biomass-chart',{xMax:c.years,yMax:niceMax(Math.max(100,c.limit*100,...biomass.map(q=>q.hi),...path.ssb.map(x=>x/10))*1.04),xTitle:'Years ahead',yTitle:'SSB (% of unfished level)',title:'True spawning biomass, median and 10th to 90th percentile across futures',percent:true,integerX:true});
 band(P,biomass,col);line(P,path.ssb.map((v,i)=>({x:i,y:v/10})),colors.muted,1.1,'4,3');line(P,biomass.map(q=>({x:q.x,y:q.mid})),col,2.5);reference(P,c.limit*100,'Limit '+pct(c.limit));cursor(P,t);
 hover(P,i=>{i=Math.max(0,Math.min(c.years,i));return['Year '+i,'Median: '+num(biomass[i].mid,1)+'% unfished','10th–90th: '+num(biomass[i].lo,1)+'–'+num(biomass[i].hi,1)+'%','One future: '+pct(path.ssb[i]/1000,1)];});
 const catches=r.catches.map(q=>({...q,x:q.x+1}));
 P=makePlot('catch-chart',{xMin:1,xMax:c.years,yMax:niceMax(Math.max(1,...catches.map(q=>q.hi),...path.catch)*1.05),xTitle:'Decision year',yTitle:'Actual catch (t)',title:'Realized catch, median and 10th to 90th percentile across futures',integerX:true});
 band(P,catches,col);line(P,path.catch.map((v,i)=>({x:i+1,y:v})),colors.muted,1.1,'4,3');line(P,catches.map(q=>({x:q.x,y:q.mid})),col,2.5);cursor(P,t+1);
 hover(P,i=>{i=Math.max(1,Math.min(c.years,i));const q=catches[i-1];return['Decision year '+i,'Median actual catch: '+num(q.mid,1)+' t','10th–90th: '+num(q.lo,1)+'–'+num(q.hi,1)+' t','One future: '+num(path.catch[i-1],1)+' t'];});
 const assessed=path.assessment,fullAssessment=c.estimator==='assessment';
 const assessmentBand=assessed.map((q,i)=>({x:i+1,lo:q.lo,hi:q.hi}));
 P=makePlot('observation-chart',{xMin:1,xMax:c.years,yMax:niceMax(Math.max(1,...path.ssb.slice(0,-1),...path.estimate,...(fullAssessment?assessed.map(q=>q.hi):[]))*1.06),xTitle:'Decision year',yTitle:'SSB (tonnes)',title:'True SSB and the assessment estimate used for fishing decisions',integerX:true});
 if(fullAssessment)band(P,assessmentBand,col);
 line(P,path.ssb.slice(0,-1).map((v,i)=>({x:i+1,y:v})),colors.muted,1.5);
 line(P,path.estimate.map((v,i)=>({x:i+1,y:v})),col,2.2);cursor(P,t+1);
 hover(P,i=>{i=Math.max(1,Math.min(c.years,i));const a=assessed[i-1];return['Decision year '+i,'True SSB: '+num(path.ssb[i-1],1)+' t','Estimated SSB: '+num(a.ssb,1)+' t',fullAssessment?'Approximate 80% range: '+num(a.lo,1)+'–'+num(a.hi,1)+' t':'Index shortcut: fixed age pattern'];});
 // Age structure is the actual state in the selected illustrative future.
 const N=path.N[t],total=m.sum(N),proportion=N.map(x=>total>0?100*x/total:0);
 P=makePlot('age-chart',{xMin:.5,xMax:stock.A+.5,yMax:niceMax(Math.max(1,...proportion)*1.08),xTitle:'Age (years)',yTitle:'Share of fish (%)',title:'True age composition at the beginning of the selected decision year',percent:true,integerX:true});
 const bw=P.W/stock.A*.82;
 proportion.forEach((v,i)=>P.marks.append(svgNode('rect',{x:P.X(i+1)-bw/2,y:P.Y(v),width:bw,height:P.top+P.H-P.Y(v),fill:col})));
 $('age-plus-note').textContent=`Age ${stock.A}+ includes older fish`;
 hover(P,i=>{i=Math.max(1,Math.min(stock.A,i));return['Age '+i+(i===stock.A?'+':''),num(proportion[i-1],2)+'% of fish',num(N[i-1],0)+' fish','Mature fraction: '+pct(stock.mat[i-1],0)];});
 // First-future fishing mortality: a target can differ from realized F.
 const trueRef=result.reference.truth,managerRef=result.reference.manager;
 P=makePlot('f-chart',{xMin:1,xMax:c.years,yMax:niceMax(Math.max(trueRef.Fmsy,...path.F,...path.targetF.filter(Number.isFinite))*1.1),xTitle:'Decision year',yTitle:'Fishing mortality F / year',title:'One future: realized fishing mortality and F target with true-model FMSY reference',integerX:true});
 line(P,path.F.map((v,i)=>({x:i+1,y:v})),col,2);if(path.targetF[0]!==null)line(P,path.targetF.map((v,i)=>({x:i+1,y:v})),colors.muted,1.2,'4,3');reference(P,trueRef.Fmsy,'True-model FMSY');cursor(P,t+1);
 hover(P,i=>{i=Math.max(1,Math.min(c.years,i));return['Decision year '+i,'Actual F: '+num(path.F[i-1],3)+' / year','Target: '+(path.targetF[i-1]===null?'catch rule':num(path.targetF[i-1],3)+' / year'),'True-model FMSY: '+num(trueRef.Fmsy,3)+' / year'];});
 // Equilibrium yield is computed from survivorship, recruitment and Baranov catch.
 P=makePlot('yield-chart',{xMax:managerRef.xmax,yMax:niceMax(managerRef.MSY*1.18),xTitle:'Constant fishing mortality F / year',yTitle:'Equilibrium catch (t / year)',title:'Management model equilibrium yield curve and the calculated FMSY'});
 line(P,managerRef.curve,colors.blue,2.5);reference(P,managerRef.MSY,'MSY');
 P.marks.append(svgNode('line',{x1:P.X(managerRef.Fmsy),y1:P.top,x2:P.X(managerRef.Fmsy),y2:P.top+P.H,stroke:colors.orange,'stroke-width':1.2,'stroke-dasharray':'5,4'}));
 P.marks.append(svgNode('circle',{cx:P.X(managerRef.Fmsy),cy:P.Y(managerRef.MSY),r:4.5,fill:colors.orange}));
 hover(P,F=>{const s=m.makeStock(c.species,c.Mfactor),e=m.equilibrium(s,c.steepness,F,c.srType);return['F: '+num(F,3)+' / year','Equilibrium catch: '+num(m.catchAtF(e.N,s,F),1)+' t / year','SSB: '+pct(e.SSB/1000,1)+' unfished'];},false);
 // The selected HCR is expressed in its native control variable, F or tonnes.
 const previous=t>0?path.advice[t-1]:result.history.catch[result.history.years-1],d=path.estimate[t]/1000,xmax=Math.max(120,Math.ceil(d*110/10)*10);
 const isF=selected==='fmsy'||selected==='framp',ruleValue=S=>isF?m.targetF(selected,S,c,managerRef):m.advice(selected,S,c,previous),point=isF?path.targetF[t]:path.advice[t];
 const curve=Array.from({length:241},(_,i)=>{const x=xmax*i/240;return{x,y:ruleValue(x/100*1000)};});
 P=makePlot('hcr-chart',{xMax:xmax,yMax:niceMax(Math.max(isF?managerRef.Fmsy:1,point,...curve.map(q=>q.y))*1.15),xTitle:'Estimated SSB (% unfished)',yTitle:isF?'F target / year':'Catch advice (t)',title:r.name+(isF?' F-target curve':' catch-advice curve, conditional on previous advice'),xPercent:true});
 if(['ramp','smooth','framp'].includes(selected))for(const [x,label]of [[c.limit*100,'Limit'],[c.trigger*100,'Trigger']]){P.marks.append(svgNode('line',{x1:P.X(x),y1:P.top,x2:P.X(x),y2:P.top+P.H,stroke:'#a3b6be','stroke-width':1,'stroke-dasharray':'3,3'}));P.svg.append(svgNode('text',{x:P.X(x)+5,y:P.top+13},label));}
 if(isF)reference(P,managerRef.Fmsy,'Management FMSY');
 line(P,curve,col,2.5);P.marks.append(svgNode('circle',{cx:P.X(d*100),cy:P.Y(point),r:5,fill:colors.orange,stroke:'#fff','stroke-width':1.5}));
 $('hcr-title').textContent='The rule: '+r.name;
 $('hcr-legend').textContent=isF?'F target':'Allowed catch';
 $('hcr-caption').textContent=isF?`Full-rate target = ${num(c.Fmultiplier,2)} × management FMSY (${num(managerRef.Fmsy,3)}/year)${selected==='framp'?', reduced below the biomass trigger':''}. The ${c.estimator==='assessment'?'assessment’s estimated age structure':'assumed unfished age shape, scaled to estimated SSB'} converts target F into catch advice. Actual F can differ from the target.`:selected==='smooth'?`This curve uses previous advice of ${previous===null?'none in year 1':num(previous,1)+' t'}. The ±${pct(c.smoothCap)} cap yields to closure below the limit; reopening uses the raw ramp.`:['catchLow','fixed','catchHigh'].includes(selected)?`Fixed advice = ${num(path.advice[t],1)} t/year. Edit catch A, B and C to compare different quotas. Actual catch can differ from advice.`:`Harvest fraction = ${pct(c.harvest)} of estimated spawning biomass${selected==='ramp'?', reduced between the limit and full-rate trigger':''}.`;
 hover(P,x=>['Estimated SSB: '+num(x,1)+'% unfished',(isF?'F target: '+num(ruleValue(x/100*1000),3)+' / year':'Catch advice: '+num(ruleValue(x/100*1000),1)+' t')],false);
 // Biological stock–recruitment function, conditional process band, and actual recruits.
 const sxmax=Math.max(150,Math.ceil(Math.max(...path.ssb.slice(0,-1),...hist.ssb)/10*1.05/25)*25);
 const sr=Array.from({length:241},(_,i)=>{const x=sxmax*i/240,mid=100*m.recruitment(x/100*1000,stock,c.steepness,c.srType)/stock.R0;return{x,mid,lo:mid*m.multiplier(c.recruitCV,-1.281551565545),hi:mid*m.multiplier(c.recruitCV,1.281551565545)};});
 const observedR=path.recruits.map(v=>100*v/stock.R0),historicalR=hist.recruits.map(v=>100*v/stock.R0);
 P=makePlot('recruitment-chart',{xMax:sxmax,yMax:niceMax(Math.max(100,...sr.map(q=>q.hi),...observedR,...historicalR)*1.06),xTitle:'SSB (% unfished)',yTitle:'Young fish (% of unfished level)',title:'Beverton–Holt recruitment curve, historical mean recruits and stochastic projection recruits',percent:true,xPercent:true});
 band(P,sr,colors.teal);line(P,sr.map(q=>({x:q.x,y:q.mid})),colors.teal,2.5);
 hist.recruits.forEach((v,i)=>P.marks.append(svgNode('circle',{cx:P.X(hist.ssb[i]/10),cy:P.Y(historicalR[i]),r:3,fill:colors.blue,opacity:.65})));
 path.recruits.forEach((v,i)=>P.marks.append(svgNode('circle',{cx:P.X(path.ssb[i]/10),cy:P.Y(observedR[i]),r:i===t?5:2.5,fill:i===t?colors.orange:colors.muted,opacity:i===t?1:.35})));
 P.marks.append(svgNode('circle',{cx:P.X(100),cy:P.Y(100),r:4,fill:'#fff',stroke:colors.teal,'stroke-width':2}));
 $('recruitment-caption').textContent=`Beverton–Holt governs this population. Historical recruits (blue) follow the mean relationship. Projection recruits vary around it with CV = ${pct(c.recruitCV)}. h = ${num(c.steepness,2)} means ${pct(c.steepness)} of R0 at 20% unfished SSB. The orange point enters age 1 after projection decision year ${t+1}.`;
 hover(P,x=>{const R=m.recruitment(x/100*1000,stock,c.steepness,c.srType);return['True SSB: '+num(x,1)+'% unfished','Expected young fish: '+pct(R/stock.R0,1)+' of R0',num(R,0)+' age-1 fish next year'];},false);
 // Keep line and band legends consistent with the chosen strategy.
 document.querySelectorAll('.legend .sample[data-policy-color]').forEach(x=>x.style.background=col);
}
function render(){if(!result)return;renderTable();renderTrace();renderCharts();document.dispatchEvent(new CustomEvent('mse:render'));}
function downloadCSV(head,rows,filename){
 const csv=[head,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function summaryCSV(){if(!result)return;const c=result.config,head=['model_version','strategy','species_archetype','projection_years','futures','seed','historical_years','historical_F_series_per_year','survey_CV','survey_bias','survey_interval_years','estimator','assumed_M_multiplier','projection_recruitment_CV','recruitment_relationship','recruitment_steepness','projection_start_SSB_fraction','implementation_CV','harvest_fraction','biomass_limit_fraction','biomass_trigger_fraction','catch_advice_change_cap','fixed_catch_A_t','fixed_catch_B_t','fixed_catch_C_t','FMSY_multiplier','management_FMSY_per_year','management_MSY_t_per_year','management_SSBMSY_t','true_model_FMSY_per_year','risk','crossings','risk_95CI_low','risk_95CI_high','mean_catch_t_per_year','mean_absolute_annual_catch_change_t','median_terminal_SSB_fraction','fraction_closed_years','fraction_capacity_limited_years'];
 const extra=['surveyData','surveyQ','surveyMinAge','ageSample','useAgeData','assumedQ','assessmentProcessCV'];head.push(...extra);
 const rows=result.rules.map(r=>{const v=r.metrics,ref=result.reference.manager;return[result.version,r.name,c.species,c.years,c.reps,c.seed,result.history.years,JSON.stringify(c.historicalF),c.surveyCV,c.surveyBias,c.surveyEvery,c.estimator,c.Mfactor,c.recruitCV,c.srType,c.steepness,result.initial.SSB/1000,c.implementationCV,c.harvest,c.limit,c.trigger,c.smoothCap,c.catchLow,c.fixedCatch,c.catchHigh,c.Fmultiplier,ref.Fmsy,ref.MSY,ref.SSBmsy,result.reference.truth.Fmsy,v.risk,v.crossings,...v.riskInterval,v.meanCatch,v.change,v.terminal,v.closed,v.capFraction,...extra.map(k=>c[k])];});
 downloadCSV(head,rows,`mse-${c.species}-seed-${c.seed}.csv`);
}
function historyCSV(){if(!result)return;const h=result.history,v=result.historicalView;
 const head=['model_version','historical_fishing_year','prescribed_F_per_year','true_SSB_start_t','catch_t','BH_recruits_to_age1_next_year','true_SSB_end_t','survey_index_relative_units_first_replicate','estimate_start_t_first_replicate'];
 const rows=h.F.map((F,i)=>[result.version,i+1,F,h.ssb[i],h.catch[i],h.recruits[i],h.ssb[i+1],v.survey[i]??'',v.estimate[i]]);
 downloadCSV(head,rows,`mse-historical-${result.config.species}.csv`);
}
// Bind controls after every required element exists.
$('historicalF').value=m.DEFAULTS.historicalF.join(', ');
try{const saved=JSON.parse(localStorage.getItem('mse-classroom-v4')||localStorage.getItem('mse-classroom-v3')||'null');if(saved){const v=m.check(saved.surveyData?saved:{...saved,estimator:'assessment'});for(const k of fields)$(k).value=k==='historicalF'?v[k].join(', '):v[k];$('historyPreset').value='custom';selected=m.RULES.some(r=>r.id===saved.rule)?saved.rule:'framp';$('rule').value=selected;}}catch{}
fields.forEach(k=>{$(k).addEventListener('input',markDirty);$(k).addEventListener('change',markDirty);});
$('historyPreset').addEventListener('change',()=>{if($('historyPreset').value!=='custom')$('historicalF').value=m.historicalPreset($('historyPreset').value).join(', ');markDirty();});
$('historicalF').addEventListener('input',()=>$('historyPreset').value='custom');
$('rule').addEventListener('change',()=>chooseRule($('rule').value));
$('run').addEventListener('click',run);$('csv').addEventListener('click',summaryCSV);
$('history-csv').addEventListener('click',historyCSV);
$('new-seed').addEventListener('click',()=>{$('seed').value=(Math.random()*4294967295)>>>0;run();});
$('year').addEventListener('input',()=>{if(result){renderTrace();renderCharts();}});
$('next').addEventListener('click',()=>{$('year').value=Math.min(+$('year').max,+$('year').value+1);renderTrace();renderCharts();});
$('preset-table').innerHTML=Object.entries(m.PRESETS).map(([k,v])=>`<tr><td>${v.name} (${v.example.toLowerCase()})</td><td>${v.A}+</td><td>${num(v.M,2)}</td><td>${num(v.k,2)}</td><td>${v.mat50}</td><td>${v.selectAge}</td></tr>`).join('');
let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderCharts,90);}).observe(document.querySelector('.main'));
descriptions();run();
globalThis.__mseDemo={get result(){return result;},get busy(){return busy;},get dirty(){return dirty;},get selected(){return selected;},run,chooseRule,configuration,summaryCSV,refresh:render,markDirty,
 applyConfiguration(input){const c=m.check(input);for(const k of fields)$(k).value=k==='historicalF'?c[k].join(', '):c[k];selected=m.RULES.some(r=>r.id===input.rule)?input.rule:'framp';$('rule').value=selected;$('historyPreset').value='custom';markDirty();document.dispatchEvent(new CustomEvent('mse:configuration'));},
 cancel(){token++;worker?.terminate();worker=null;busy=false;dirty=true;$('run').disabled=false;setStatus('Run stopped. Update the simulation when ready.');document.dispatchEvent(new CustomEvent('mse:dirty'));}
};
})();
