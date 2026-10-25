const test=require('node:test'),assert=require('node:assert/strict'),m=require('../src/model.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('Assessment intervals default to annual and require 1–10 whole years',()=>{
 assert.equal(m.check({}).assessmentEvery,1);
 for(const value of [0,11,2.5,NaN,Infinity])assert.throws(()=>m.check({assessmentEvery:value}),/assessment interval/i);
 const c=m.check({assessmentEvery:3});
 assert.deepEqual(Array.from({length:8},(_,t)=>m.managementSchedule(c,t).assessmentDue),[true,false,false,true,false,false,true,false]);
 assert.deepEqual(m.managementSchedule(c,4),{assessmentDue:false,assessmentYear:4,adviceThroughYear:6,nextAssessmentYear:7});
});

test('All MPs hold annual advice for the full period while the population changes',()=>{
 const r=m.runEnsemble({years:8,reps:2,assessmentEvery:3,implementationCV:0});
 for(const rule of r.rules){
  const p=rule.path;
  for(let t=0;t<8;t++){
   assert.equal(p.assessment[t].assessmentDue,t%3===0);
   if(t%3!==0){near(p.advice[t],p.advice[t-1]);assert.equal(p.targetF[t],p.targetF[t-1]);}
   const next=m.advance(p.N[t],r.stock,p.F[t],p.recruits[t]);next.forEach((v,a)=>near(v,p.N[t+1][a]));
  }
  assert.notDeepEqual(p.N[1],p.N[2]);
 }
 const f=r.rules.find(v=>v.id==='fmsy').path;
 assert.notEqual(f.F[1],f.F[2]); // A held quota is not a constant realized fishing rate.
});

test('Surveys between assessments cannot affect current advice or estimates, but inform the next assessment',()=>{
 const c=m.check({years:6,reps:1,assessmentEvery:3,surveyData:'index',implementationCV:0,surveyCV:.3}),s=m.makeStock(c.species),start={N:s.unfished.slice()},z=m.shocks(42,0,c.years),changed=structuredClone(z);
 changed.obs[1]+=4;
 const a=m.trial(c,s,start,'fixed',z,true),b=m.trial(c,s,start,'fixed',changed,true);
 assert.notEqual(a.survey[1],b.survey[1]);
 near(a.estimate[1],b.estimate[1]);near(a.estimate[2],b.estimate[2]);
 assert.deepEqual(a.advice,b.advice);assert.deepEqual(a.ssb,b.ssb);
 assert.notEqual(a.estimate[3],b.estimate[3]);
 assert.deepEqual(a.assessment[3].dataYearsUsed,[2,3,4]);
 assert.deepEqual(a.assessment[2].dataYearsUsed,[]);
});

test('Changing the interval leaves historical forcing and conditioned history unchanged',()=>{
 const c={years:8,reps:1,historicalF:[.1,.2,.3,.4,.5],surveyEvery:3,surveyData:'both'};
 const a=m.runEnsemble(c),b=m.runEnsemble({...c,assessmentEvery:4});
 assert.deepEqual(a.history,b.history);assert.deepEqual(a.historicalView,b.historicalView);
 const p=b.rules.find(v=>v.id==='framp').path;
 assert.equal(p.surveyVisits[0],false);assert.equal(p.surveyVisits[1],true);
 assert.equal(p.assessment[1].assessmentDue,false);
 assert.deepEqual(p.assessment[4].dataYearsUsed,[2,5]);
 assert.equal(p.assessment[4].assessmentDue,true);
});

test('Ages-only observations are retained until assessment; long advice periods remain finite',()=>{
 for(const species of ['short','medium','long']){
  const r=m.runEnsemble({species,years:12,reps:1,surveyData:'ages',assessmentEvery:10});
  for(const rule of r.rules){
   const p=rule.path;assert.ok(p.survey.every(v=>v===null));
   assert.deepEqual(p.assessment[10].dataYearsUsed,Array.from({length:10},(_,i)=>i+2));
   for(const key of ['ssb','estimate','advice','catch','F'])assert.ok(p[key].every(v=>Number.isFinite(v)&&v>=0));
   p.advice.slice(0,10).forEach(v=>near(v,p.advice[0]));
  }
 }
});

test('Multi-year outcomes are reproducible across all retained economic trajectories',()=>{
 const c={years:11,reps:3,assessmentEvery:4,seed:512};
 const a=m.runEnsemble(c),b=m.runEnsemble(c);assert.deepEqual(a,b);
 for(const rule of a.rules){
  assert.deepEqual(Array.from(rule.economicTrials.catch.slice(0,c.years)),rule.path.catch);
  assert.deepEqual(Array.from(rule.economicTrials.F.slice(0,c.years)),rule.path.F);
 }
});
