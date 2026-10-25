/* An animated view of the actual assessment and advice schedule. */
(function(){
'use strict';
const $=id=>document.getElementById(id),api=globalThis.__mseDemo,m=globalThis.MSELab,V=globalThis.MSEViews,icons=globalThis.MSEVisuals;
if(!$('feedback-stage'))return;
let playing=false,timer=null,phase=0,advancing=false,signature='',speed=1;
const n=(x,d=1)=>Number(x).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
const panel=document.querySelector('[data-control-panel=future]');
const intervalLabel=document.createElement('label');intervalLabel.className='field';intervalLabel.htmlFor='futureAssessmentEvery';
intervalLabel.innerHTML='<span>Assessment interval</span><select id="futureAssessmentEvery" aria-label="Assessment interval in the animation">'+$('assessmentEvery').innerHTML+'</select>';
const help=document.createElement('p');help.className='lesson-help';help.textContent='Annual catch advice stays fixed until the next assessment. The fish keep changing each year.';
const tryThree=document.createElement('button');tryThree.type='button';tryThree.className='btn';tryThree.id='try-three-year-cycle';tryThree.textContent='Try a 3-year cycle';
panel.querySelector('.control-heading').after(intervalLabel,help,tryThree);
const speedLabel=document.createElement('label');speedLabel.className='field feedback-speed';speedLabel.htmlFor='feedback-speed';speedLabel.innerHTML='<span>Playback speed</span><select id="feedback-speed" aria-label="Animation speed"><option value="0.65">Slow</option><option value="1" selected>Normal</option><option value="2">Fast</option></select>';
tryThree.after(speedLabel);
document.querySelectorAll('[data-feedback-icon]').forEach(el=>el.innerHTML=icons.icon(el.dataset.feedbackIcon));
document.querySelectorAll('.feedback-fish').forEach(el=>el.innerHTML=icons.icon('fish'));
function context(){
 const result=api.result;if(!result)return null;
 const rule=result.rules.find(r=>r.id===api.selected),t=Math.max(0,Math.min(result.config.years-1,+$('year').value-1));
 return {result,rule,path:rule.path,t,year:t+1,schedule:m.managementSchedule(result.config,t)};
}
function stop(){clearTimeout(timer);timer=null;playing=false;$('play').textContent='Play feedback';$('play').setAttribute('aria-pressed','false');$('feedback-stage').classList.remove('playing');}
function changeInterval(value){
 stop();phase=0;$('year').value=1;$('assessmentEvery').value=String(value);$('futureAssessmentEvery').value=String(value);
 $('assessmentEvery').dispatchEvent(new Event('input',{bubbles:true}));
}
$('futureAssessmentEvery').addEventListener('change',()=>changeInterval(+$('futureAssessmentEvery').value));
tryThree.addEventListener('click',()=>changeInterval(3));
$('assessmentEvery').addEventListener('change',()=>{stop();phase=0;$('year').value=1;render();});
$('feedback-speed').addEventListener('change',()=>{speed=+$('feedback-speed').value;if(playing){clearTimeout(timer);scheduleNext();}});
const watch=$('watch-feedback');if(watch)watch.addEventListener('click',()=>V.showView('future'));
function steps(c){return c.schedule.assessmentDue?[0,1,2,3]:c.path.surveyVisits[c.t]?[0,2,3]:[2,3];}
function scheduleNext(){
 const c=context();if(!c||!playing)return;
 const duration=phase===1?1700:phase===3?1700:1000;
 timer=setTimeout(()=>{
  if(!playing)return;
  const c=context(),order=steps(c),index=order.indexOf(phase);
  if(index<order.length-1)phase=order[index+1];
  else if(c.year<c.result.config.years){
   advancing=true;$('year').value=c.year+1;$('year').dispatchEvent(new Event('input',{bubbles:true}));advancing=false;
   phase=steps(context())[0];
  }else{stop();render();return;}
  render();scheduleNext();
 },duration/speed);
}
function toggle(){
 if(playing){stop();render();return;}
 if(api.dirty||api.busy||!api.result)return;
 if(+$('year').value>=+$('year').max){advancing=true;$('year').value=1;$('year').dispatchEvent(new Event('input',{bubbles:true}));advancing=false;}
 phase=steps(context())[0];playing=true;$('play').textContent='Pause';$('play').setAttribute('aria-pressed','true');render();scheduleNext();
}
function render(){
 $('futureAssessmentEvery').value=$('assessmentEvery').value;
 const c=context();$('play').disabled=!c||api.dirty||api.busy;if(!c)return;
 const {result:r,path,t,year,schedule:s}=c,a=path.assessment[t],due=s.assessmentDue;
 const nextSignature=[r.version,r.config.seed,r.config.assessmentEvery,api.selected,r.config.years,r.config.surveyEvery].join('|');
 if(signature!==nextSignature){stop();phase=0;signature=nextSignature;}
 const assessed=due&&phase>=1,advised=!due||phase>=2,finished=phase>=3;
 const count=path.ageComp[t]?m.sum(path.ageComp[t]):0,channels=[path.survey[t]!==null?'an index':null,count?n(count,0)+' sampled ages':null].filter(Boolean);
 text('feedback-survey-step',path.surveyVisits[t]?'New data this year':'No visit this year');
 text('feedback-assessment-step',due?'Assessment year':'Next: year '+s.nextAssessmentYear);
 text('feedback-advice-step',due?'Renew for '+r.config.assessmentEvery+' year'+(r.config.assessmentEvery===1?'':'s'):'Keep existing advice');
 const dataYears=a.dataYearsUsed||[],dataLabel=dataYears.length?'Survey data from year'+(dataYears.length===1?' ':'s ')+dataYears.join(', '):'No new survey data';
 let message;
 if(phase===0)message=path.surveyVisits[t]?`Year ${year}: survey provides ${channels.join(' and ')}.${due?' Ready for assessment.':' Store the data for year '+s.nextAssessmentYear+'.'}`:`Year ${year}: no survey visit. ${due?'Assess using the available data and model prediction.':'Continue with existing advice.'}`;
 else if(phase===1)message=`Assessment in year ${year}. ${dataLabel}. Update estimated SSB.`;
 else if(phase===2)message=due?`Set ${n(path.advice[t])} t/year for ${s.assessmentYear===s.adviceThroughYear?'year '+year:'years '+s.assessmentYear+'–'+s.adviceThroughYear}. Next assessment: year ${s.nextAssessmentYear}.`:`Year ${year}: no assessment. Keep ${n(path.advice[t])} t/year from the year ${s.assessmentYear} assessment.`;
 else message=`Year ${year}: catch ${n(path.catch[t])} t. Fish survive, grow and add young fish. SSB changes: ${n(path.ssb[t])} → ${n(path.ssb[t+1])} t.`;
 if(!playing&&phase>0)message+=' Paused.';
 text('feedback-message',message);
 const stage=$('feedback-stage');stage.dataset.phase=phase;stage.classList.toggle('playing',playing);stage.classList.toggle('assessment-year',due);
 stage.style.setProperty('--mp-color',V.colors[c.rule.id]);
 document.querySelectorAll('[data-feedback-step]').forEach(el=>{const i=+el.dataset.feedbackStep;el.classList.toggle('active',i===phase);el.classList.toggle('complete',i<phase);el.classList.toggle('waiting',i===1&&!due);if(i===phase)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 const S=path.ssb[t+(finished?1:0)],percent=100*S/r.stock.S0;
 text('feedback-stock-value',n(S)+' t');text('feedback-stock-time',(finished?'End':'Start')+' of year '+year);
 $('feedback-stock-fill').style.width=Math.max(0,Math.min(100,percent))+'%';
 text('feedback-stock-note',n(percent)+'% of unfished SSB');
 text('feedback-quota-label',advised?(due?'New annual catch advice':'Annual catch advice · held'):'Annual catch advice');
 text('feedback-quota-value',advised?n(path.advice[t])+' t/year':'—');
 text('feedback-quota-period',`Applies to ${s.assessmentYear===s.adviceThroughYear?'year '+s.assessmentYear:'years '+s.assessmentYear+'–'+s.adviceThroughYear}.`);
 text('feedback-estimate',due?(assessed?'Assessment estimate: '+n(path.estimate[t])+' t SSB.':'Estimate will update at the assessment.'):'Stock prediction: '+n(path.estimate[t])+' t SSB. No new fit this year.');
 text('feedback-period-note',`Advice period ${Math.floor(t/r.config.assessmentEvery)+1} · next assessment in year ${s.nextAssessmentYear}${s.nextAssessmentYear>r.config.years?' (beyond this run)':''}`);
 const track=$('feedback-years');track.replaceChildren();
 $('feedback-stage').closest('.trace-section').style.setProperty('--feedback-nav-height',document.querySelector('.flow-nav').offsetHeight+'px');
 $('feedback-csv').disabled=api.dirty||api.busy;
 for(let y=s.assessmentYear;y<=Math.min(s.nextAssessmentYear,r.config.years);y++){
  const b=document.createElement('button');b.type='button';b.className='feedback-year';b.classList.toggle('assessment-marker',y===s.assessmentYear||y===s.nextAssessmentYear);b.classList.toggle('current',y===year);
  b.textContent='Year '+y;b.setAttribute('aria-label','Go to year '+y+((y===s.assessmentYear||y===s.nextAssessmentYear)?', assessment year':''));if(y===year)b.setAttribute('aria-current','true');
  if(y===s.assessmentYear||y===s.nextAssessmentYear)b.insertAdjacentHTML('afterbegin',icons.icon('chart'));
  b.addEventListener('click',()=>{stop();phase=0;$('year').value=y;$('year').dispatchEvent(new Event('input',{bubbles:true}));});track.append(b);
 }
}
$('feedback-csv').addEventListener('click',()=>{
 const c=context();if(!c||api.dirty||api.busy)return;
 const {result:r,path}=c,headers=['model_version','strategy','year','assessment_due','assessment_year','advice_through_year','next_assessment_year','survey_visit','survey_index','fish_aged','survey_years_processed','estimated_SSB_t','true_SSB_start_t','annual_catch_advice_t','actual_catch_t','true_SSB_end_t','recruits_to_age_1','configuration_json'];
 const rows=path.catch.map((catchTaken,t)=>{const a=path.assessment[t];return[r.version,c.rule.name,t+1,a.assessmentDue,a.assessmentYear,a.adviceThroughYear,a.nextAssessmentYear,path.surveyVisits[t],path.survey[t],path.ageComp[t]?m.sum(path.ageComp[t]):0,JSON.stringify(a.dataYearsUsed),path.estimate[t],path.ssb[t],path.advice[t],catchTaken,path.ssb[t+1],path.recruits[t],JSON.stringify(r.config)];});
 const csv=[headers,...rows].map(row=>row.map(v=>v===null?'':'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');V.saveFile(csv,'text/csv;charset=utf-8','mse-feedback-'+api.selected+'.csv');
});
for(const event of ['mse:start','mse:dirty'])document.addEventListener(event,()=>{stop();render();});
document.addEventListener('mse:result',()=>{signature='';render();});
for(const event of ['mse:render','mse:configuration'])document.addEventListener(event,render);
$('year').addEventListener('input',()=>{if(!advancing){phase=0;stop();}render();});
for(const id of ['next','previous'])$(id).addEventListener('click',()=>{phase=0;render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
globalThis.MSEFeedback={toggle,stop,get advancing(){return advancing;}};
render();
})();
