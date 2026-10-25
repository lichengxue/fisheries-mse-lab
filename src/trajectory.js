/* Join known history and matched first-replicate MP trajectories. */
(function(root){
'use strict';
function selection(ids,available){
 if(!Array.isArray(ids)||ids.length<1||ids.length>available.length||new Set(ids).size!==ids.length||ids.some(id=>!available.includes(id)))throw Error('Choose at least one distinct, available MP.');
 return ids.slice();
}
function defaults(available,selected='framp'){return [...new Set([selected,'fixed','smooth',...available])].filter(id=>available.includes(id)).slice(0,Math.min(3,available.length));}
function frame(result,time,phase=0){
 const H=result.history.years,Y=result.config.years;
 time=Math.max(-H,Math.min(Y,Math.round(time)));phase=Math.max(0,Math.min(3,Math.round(phase)));
 const history=time<0,complete=time===Y,t=Math.min(Y-1,Math.max(0,time)),finished=!history&&(phase===3||complete);
 const cursor=history?time:Math.min(Y,time+(finished&&!complete?1:0));
 const a=result.rules[0].path.assessment[t],due=a.assessmentDue;
 const adviceThrough=history?0:complete?Y:Math.min(Y,due&&phase<2?time:a.adviceThroughYear);
 return {time,phase,history,complete,t,year:t+1,cursor,finished,historyIndex:H+Math.min(0,time),adviceThrough,due:!history&&!complete&&due,assessmentYear:a.assessmentYear,nextAssessmentYear:a.nextAssessmentYear};
}
function series(result,ids,time,phase=0){
 selection(ids,result.rules.map(r=>r.id));const f=frame(result,time,phase),h=result.history,H=h.years;
 const historySSB=h.ssb.map((y,i)=>({x:i-H,y})),historyCatch=h.catch.map((y,i)=>({x:i+1-H,y}));
 const rules=ids.map(id=>{
  const r=result.rules.find(r=>r.id===id),p=r.path;
  const ssb=f.history?[]:p.ssb.slice(0,f.cursor+1).map((y,x)=>({x,y}));
  const catchTaken=f.history?[]:p.catch.slice(0,f.cursor).map((y,i)=>({x:i+1,y}));
  const advice=[];
  for(let i=0;i<f.adviceThrough;i++)advice.push({x:i,y:p.advice[i]},{x:i+1,y:p.advice[i]});
  return {id:r.id,name:r.name,short:r.short,ssb,catchTaken,advice};
 });
 return {...f,historySSB,historyCatch,rules};
}
function snapshots(result,ids,time,phase=0){
 selection(ids,result.rules.map(r=>r.id));const f=frame(result,time,phase);
 return ids.map(id=>{
  const r=result.rules.find(r=>r.id===id),p=r.path,a=p.assessment[f.t];
  return {id,name:r.name,ssb:f.history?result.history.ssb[f.historyIndex]:p.ssb[f.cursor],
   estimate:f.history||f.due&&phase<1?null:p.estimate[f.t],
   advice:f.history||f.due&&phase<2?null:p.advice[f.t],catchTaken:f.finished?p.catch[f.t]:null,
   assessmentYear:a.assessmentYear,adviceThroughYear:a.adviceThroughYear};
 });
}
const api={selection,defaults,frame,series,snapshots};root.MSETrajectory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
