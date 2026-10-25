/* Survey observations and the fitted assessment, shown as distinct teaching steps. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=globalThis.__mseDemo,m=globalThis.MSELab,V=globalThis.MSEViews;
const n=(x,d=1)=>Number(x).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
function node(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function plotTools(id,enabled){$(id).classList.toggle('no-data',!enabled);$(id).closest('figure').querySelectorAll('[data-plot-action]').forEach(b=>b.disabled=!enabled);}
function empty(id,message){const p=document.createElement('p');p.className='chart-empty';p.textContent=message;$(id).replaceChildren(p);plotTools(id,false);}
function setYear(value){$('year').value=Math.max(1,Math.min(+$('year').max,Math.round(value)||1));$('year').dispatchEvent(new Event('input',{bubbles:true}));render();}
document.querySelectorAll('[data-shared-year]').forEach(el=>el.addEventListener('input',()=>{if(el.value!==''&&el.checkValidity())setYear(+el.value);}));
document.querySelectorAll('[data-next-survey]').forEach(el=>el.addEventListener('click',()=>{
 const r=api.result;if(!r)return;const path=r.rules.find(v=>v.id===api.selected).path,current=+$('year').value-1;
 const order=Array.from({length:r.config.years},(_,i)=>(current+i+1)%r.config.years),next=order.find(i=>path.surveyVisits[i]);if(next!==undefined)setYear(next+1);
}));
document.querySelectorAll('[data-next-assessment]').forEach(el=>el.addEventListener('click',()=>{
 const r=api.result;if(!r)return;const path=r.rules.find(v=>v.id===api.selected).path,current=+$('year').value-1;
 const order=Array.from({length:r.config.years},(_,i)=>(current+i+1)%r.config.years),next=order.find(i=>path.assessment[i].assessmentDue);if(next!==undefined)setYear(next+1);
}));
function controls(){
 const mode=$('surveyData').value,full=$('estimator').value==='assessment',A=m.PRESETS[$('species').value].A;
 $('surveyMinAge').max=A;if(+$('surveyMinAge').value>A)$('surveyMinAge').value=A;
 $('index-noise-control').hidden=mode==='ages';$('index-noise-presets').hidden=mode==='ages';$('age-sample-control').hidden=mode==='index';$('age-sample-presets').hidden=mode==='index';
 $('use-age-control').hidden=mode==='index'||!full;$('assessment-flex-control').hidden=!full;
 for(const option of $('estimator').options)option.disabled=mode==='ages'&&option.value!=='assessment';
 $('useAgeData').querySelector('option[value="0"]').disabled=mode==='ages';
 if(mode==='ages'&&(!full||!+$('useAgeData').value)){$('estimator').value='assessment';$('useAgeData').value='1';api.markDirty();}
}
function drawIndex(id,path,c,withFit,t){
 if(c.surveyData==='ages'){empty(id,'This survey collects ages only. Choose “Index + age samples” to add an abundance index.');return;}
 plotTools(id,true);
 const fitted=path.assessment.map((a,i)=>({x:i+1,y:a.fittedIndex})),data=path.survey.filter(Number.isFinite);
 const ymax=Math.max(1,...data,...(withFit?fitted.map(v=>v.y):[]))*1.12;
 const P=V.axes(id,{xMin:1,xMax:c.years,yMax:ymax,xTitle:'Decision year',yTitle:'Index (relative units)',title:withFit?'Observed and fitted survey abundance index':'Survey abundance index, in relative units',integerX:true});if(!P)return;
 if(withFit)V.poly(P,fitted,'#3a78a9');
 path.survey.forEach((v,i)=>{if(v!==null){const dot=node('circle',{cx:P.X(i+1),cy:P.Y(v),r:i===t?6:3.5,fill:'#b4582f'});dot.append(node('title',{},`Year ${i+1}: observed index ${n(v,2)}`));P.marks.append(dot);}});
 P.marks.append(node('line',{x1:P.X(t+1),x2:P.X(t+1),y1:P.top,y2:P.top+P.H,stroke:'#8ca4ad','stroke-dasharray':'3 3'}));
}
function drawAges(id,counts,fit,c,stock,t,withFit){
 if(!counts){empty(id,c.surveyData==='index'?'No ages collected. Choose “Index + age samples” to compare age information.':`No age sample in year ${t+1}. Use “Next survey year” to inspect a sample.`);return;}
 plotTools(id,true);
 const sample=m.sum(counts),observed=counts.map(v=>sample?100*v/sample:0),fitted=fit.fittedAge.map(v=>100*v);
 const ymax=Math.max(1,...observed,...(withFit?fitted:[]))*1.12;
 const P=V.axes(id,{xMin:.5,xMax:stock.A+.5,yMax:ymax,xTitle:`Age (years; ${stock.A}+ is the plus group)`,yTitle:'Share of sampled fish (%)',title:withFit?'Observed survey ages compared with fitted age proportions':`Survey age composition in year ${t+1}`,integerX:true,percentY:true});if(!P)return;
 const w=P.W/stock.A*(withFit?.37:.75);
 observed.forEach((v,a)=>{
  const rect=node('rect',{x:P.X(a+1)-(withFit?w:w/2),y:P.Y(v),width:w,height:P.top+P.H-P.Y(v),fill:'#b4582f'});
  rect.append(node('title',{},`Age ${a+1}${a+1===stock.A?'+':''}: ${counts[a]} fish, ${n(v,1)}%`));P.marks.append(rect);
  if(withFit){const r=node('rect',{x:P.X(a+1),y:P.Y(fitted[a]),width:w,height:P.top+P.H-P.Y(fitted[a]),fill:'#3a78a9'});r.append(node('title',{},`Fitted age ${a+1}: ${n(fitted[a],1)}%`));P.marks.append(r);}
 });
}
function render(){
 controls();const r=api.result;if(!r)return;const c=r.config,path=r.rules.find(v=>v.id===api.selected).path,t=Math.min(c.years-1,+$('year').value-1),a=path.assessment[t],counts=path.ageComp[t],full=c.estimator==='assessment';
 for(const input of document.querySelectorAll('[data-shared-year]')){input.max=c.years;if(document.activeElement!==input)input.value=t+1;}
 for(const id of ['survey-index-chart','index-fit-chart'])$(id).closest('figure').hidden=c.surveyData==='ages';
 for(const id of ['survey-age-chart','age-fit-chart'])$(id).closest('figure').hidden=c.surveyData==='index';
 $('survey-demo').closest('details').hidden=c.surveyData==='ages';
 const channels=[path.survey[t]!==null?'an abundance index':null,counts?`${m.sum(counts)} sampled ages`:null].filter(Boolean);
 $('survey-data-note').textContent=`Year ${t+1} · ${path.surveyVisits[t]?'This visit provides '+channels.join(' and ')+'.':'No survey visit this year.'} Both products come from the same survey schedule. Fish ages are sampled by number.`;
 $('assessment-schedule-note').textContent=`Assess every ${c.assessmentEvery===1?'year':c.assessmentEvery+' years'}, starting in year 1. Annual advice stays fixed until the next assessment. Surveys follow their own schedule.`;
 $('assessment-cards').innerHTML=`<div><small>${a.assessmentDue?'Assessment estimate':'Stock prediction'} · year ${t+1}</small><strong>${n(a.ssb)} t</strong></div><div><small>${full?'Approximate 80% range':'Assessment type'}</small><strong>${full?n(a.lo)+'–'+n(a.hi)+' t':'Index shortcut'}</strong></div>`;
 const previous=t===0?r.history.catch.at(-1):path.catch[t-1];
 const dataYears=a.dataYearsUsed||[];
 $('assessment-data-note').textContent=`Year ${t+1} · ${a.assessmentDue?'Assessment year. '+(dataYears.length?'Uses stored survey data from year'+(dataYears.length===1?' ':'s ')+dataYears.join(', ')+'.':'No new survey data; uses the model prediction.'):'No assessment. '+(full?'The stock estimate is a prediction.':'The index shortcut holds its last estimate.')+' Surveys are stored for year '+a.nextAssessmentYear+'.'} Previous catch: ${n(previous)} t.${counts&&full&&!c.useAgeData?' Collected ages are left out.':''}${a.catchShortfall?' The predicted population could not fully explain the previous reported catch.':''}`;
 $('assessment-band-key').hidden=!full;
 $('assessment-ssb-caption').textContent=full?'Gray shows true SSB. Colored dots mark assessments; between them, the line is a model prediction. Shading is an approximate 80% range under the model assumptions; it does not cover every source of error.':'This shortcut converts the index to SSB using a fixed unfished age pattern and assumed q. Even a noise-free index can give the wrong SSB when age structure changes. No uncertainty range is calculated.';
 $('survey-age-caption').textContent=counts?`Year ${t+1}: ${m.sum(counts)} fish aged. Smaller samples give more variable proportions. These ages describe survey-caught fish, which can differ from the whole population.`:'Age samples have their own sampling noise, separate from index noise.';
 $('age-fit-caption').textContent=counts?`Year ${t+1}. ${!a.assessmentDue?'These ages are stored for the next assessment. Bars compare the sample with the current model prediction.':full&&c.useAgeData?'These observed counts informed the assessment.':'These ages were not used in the estimate.'} Blue bars are the model’s proportions among survey-selected fish.`:'There is no observed age composition to fit in this year.';
 $('assessment-fit-note').textContent=!a.assessmentDue?'No fit this year. These plots compare collected data with the current prediction. Stored data are processed at the next assessment.':full&&a.objectiveBefore!==undefined?`At this assessment, stored data are processed in year order. In its last annual step, the fitting score changed from ${n(a.objectiveBefore,2)} to ${n(a.objectiveAfter,2)} (lower fits the data and prediction penalties better). ${a.iterations} fitting steps. ${a.iterations===0?'The model carried its prediction forward.':'Each annual fit adjusts numbers at age; this is not a refit of the entire time series.'}`:'Index shortcuts do not fit an age-structured model.';
 drawIndex('survey-index-chart',path,c,false,t);drawIndex('index-fit-chart',path,c,true,t);
 drawAges('survey-age-chart',counts,a,c,r.stock,t,false);drawAges('age-fit-chart',counts,a,c,r.stock,t,true);
 $('assessment-csv').disabled=api.dirty||api.busy;
}
function exportData(){
 const r=api.result;if(!r||api.dirty||api.busy)return;const path=r.rules.find(v=>v.id===api.selected).path;
 const headers=['model_version','phase','year','strategy','age','survey_visit','observed_index_relative_units','age_count','age_sample_size','fitted_index_relative_units','fitted_age_proportion','estimated_numbers_at_age','estimated_SSB_t','approximate_80_low_t','approximate_80_high_t','true_SSB_t_teaching_only','reported_catch_previous_year_t','assessment_previous_F_per_year','catch_capacity_mismatch','fit_objective_before','fit_objective_after','assessment_due','assessment_year','advice_through_year','annual_catch_advice_t','survey_years_processed','configuration_json'];
 const rows=[];
 for(const phase of ['history','future']){
  const h=phase==='history',fits=h?r.historicalView.assessment:path.assessment,surveys=h?r.historicalView.survey:path.survey,ages=h?r.historicalView.ageComp:path.ageComp,truth=h?r.history.ssb:path.ssb;
  fits.forEach((fit,t)=>fit.N.forEach((N,a)=>{const priorCatch=t===0?(h?null:r.history.catch.at(-1)):(h?r.history.catch[t-1]:path.catch[t-1]);
   rows.push([r.version,phase,t+1,h?'historical forcing':api.selected,a+1,fit.visited,surveys[t],ages[t]?.[a],fit.sampleSize,fit.fittedIndex,fit.fittedAge[a],N,fit.ssb,fit.lo,fit.hi,truth[t],priorCatch,fit.previousF,fit.catchShortfall,fit.objectiveBefore,fit.objectiveAfter,h?true:fit.assessmentDue,h?t+1:fit.assessmentYear,h?'':fit.adviceThroughYear,h?'':path.advice[t],JSON.stringify(h?(fit.visited?[t+1]:[]):fit.dataYearsUsed),JSON.stringify(r.config)]);
  }));
 }
 const csv=[headers,...rows].map(row=>row.map(v=>v===undefined||v===null?'':'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');V.saveFile(csv,'text/csv;charset=utf-8',`mse-assessment-${api.selected}-seed-${r.config.seed}.csv`);
}
$('assessment-csv').addEventListener('click',exportData);
for(const event of ['mse:render','mse:result','mse:configuration'])document.addEventListener(event,render);
document.addEventListener('mse:dirty',()=>{controls();$('assessment-csv').disabled=true;});
document.addEventListener('mse:start',()=>$('assessment-csv').disabled=true);
$('year').addEventListener('input',render);$('next').addEventListener('click',render);$('previous').addEventListener('click',render);
new ResizeObserver(()=>requestAnimationFrame(render)).observe($('view-data'));
new ResizeObserver(()=>requestAnimationFrame(render)).observe($('view-assessment'));
render();
})();
