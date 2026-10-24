const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/model.js');
const near=(x,y,tol=1e-8)=>assert.ok(Math.abs(x-y)<=tol*Math.max(1,Math.abs(y)),`${x} != ${y}`);
test('Beverton-Holt gives R0 at S0, and h R0 at 20% S0',()=>{
 for(const k of Object.keys(m.PRESETS)){
  const s=m.makeStock(k);near(m.recruitment(s.S0,s,.75),s.R0);near(m.recruitment(.2*s.S0,s,.75),.75*s.R0);
 }
});
test('All three unfished age structures remain at equilibrium including the plus group',()=>{
 for(const k of Object.keys(m.PRESETS)){
  const s=m.makeStock(k);let N=s.unfished.slice();
  for(let t=0;t<150;t++)N=m.advance(N,s,0,m.recruitment(m.dot(N,s.sw),s,.75));
  N.forEach((x,a)=>near(x,s.unfished[a]));near(m.dot(N,s.sw),1000);
 }
});
test('Equilibrium diagnostic recovers a requested depletion without initializing the MSE',()=>{
 for(const k of Object.keys(m.PRESETS))for(const depletion of [.1,.6,.95]){
  const s=m.makeStock(k),q=m.equilibriumAtDepletion(s,.75,depletion);
  near(q.SSB/s.S0,depletion);
  const next=m.advance(q.N,s,q.F,m.recruitment(q.SSB,s,.75));
  if(!q.scaledForInitialization)next.forEach((x,a)=>near(x,q.N[a]));
 }
});
test('Aging conserves surviving numbers, and Baranov inversion recovers catches',()=>{
 for(const key of Object.keys(m.PRESETS)){
  const s=m.makeStock(key),N=s.unfished,F=.6,R=123;
  const next=m.advance(N,s,F,R);
  near(m.sum(next),R+m.sum(N.map((x,i)=>x*Math.exp(-s.M-F*s.sel[i]))));
  const catchT=m.catchAtF(N,s,F),fit=m.invertCatch(N,s,catchT);
  near(fit.F,F,1e-8);near(fit.catch,catchT,1e-8);
  const high=m.invertCatch(N,s,1e9);assert.equal(high.capped,true);near(high.F,s.Fcap);assert.ok(high.catch<1e9);
 }
});
test('Survey multiplier has the requested mean and CV',()=>{
 const r=m.rng(42),a=Array.from({length:100000},()=>m.multiplier(.5,m.normal(r)));
 const mean=m.sum(a)/a.length,cv=Math.sqrt(m.sum(a.map(x=>(x-mean)**2))/a.length)/mean;
 assert.ok(Math.abs(mean-1)<.01);assert.ok(Math.abs(cv-.5)<.01);
});
test('Estimator sees survey and past catch, with no simulated true-state argument',()=>{
 const c=m.check({estimator:'mean'}),s=m.makeStock(c.species),e=m.makeEstimator(s,c);
 near(m.estimate(e,100,c),100);near(m.estimate(e,200,c),150);near(m.estimate(e,300,c),200);
 near(m.estimate(e,400,c),300);near(m.estimate(e,null,c),300);
 const d=m.check({estimator:'filter',surveyCV:0}),f=m.makeEstimator(s,d);
 near(m.estimate(f,777,d),777);m.predictEstimator(f,20,d);assert.ok(f.N.every(x=>x>=0&&Number.isFinite(x)));
});
test('Closure overrides smoothing, and closure does not trap reopening at zero',()=>{
 const c=m.check({limit:.2,trigger:.5,harvest:.2,fixedCatch:120});
 assert.equal(m.advice('smooth',100,c,100),0);
 assert.ok(m.advice('smooth',500,c,0)>0);
 near(m.advice('fixed',1,c),120);near(m.advice('fixed',900,c),120);
 assert.equal(m.advice('ramp',200,c),0);near(m.advice('ramp',500,c),100);
});
test('Zero noise produces exact direct survey estimates',()=>{
 const c=m.check({years:20,reps:1,surveyCV:0,recruitCV:0,implementationCV:0,estimator:'direct'});
 const s=m.makeStock(c.species),history=m.historicalPopulation(s,c),start={N:history.N[history.years]};
 const x=m.trial(c,s,start,'ramp',m.shocks(c.seed,0,c.years),true);
 x.estimate.forEach((v,t)=>near(v,x.ssb[t]));
});
test('Reproducible simulations and common random numbers across zero-harvest policies',()=>{
 const c={years:15,reps:12,historicalF:Array(30).fill(0),harvest:0,catchLow:0,fixedCatch:0,catchHigh:0,Fmultiplier:0};
 const a=m.runEnsemble(c),b=m.runEnsemble(c);assert.deepEqual(a,b);
 a.rules.forEach(r=>assert.deepEqual(r.path.ssb,a.rules[0].path.ssb));
 assert.notDeepEqual(m.runEnsemble({...c,seed:12}).rules[0].path.ssb,a.rules[0].path.ssb);
});
test('All presets, estimators and extreme noise remain finite and nonnegative',()=>{
 for(const species of Object.keys(m.PRESETS))for(const estimator of ['direct','mean','filter']){
  const result=m.runEnsemble({species,estimator,years:25,reps:5,surveyCV:1.5,recruitCV:1.5,implementationCV:1,surveyBias:.5,harvest:.8,initialDepletion:.15,surveyEvery:3,Mfactor:1.5});
  for(const r of result.rules){
   for(const key of ['ssb','estimate','advice','catch','F'])assert.ok(r.path[key].every(x=>Number.isFinite(x)&&x>=0),species+' '+estimator+' '+key);
   assert.ok(r.metrics.risk>=0&&r.metrics.risk<=1);
   assert.ok(r.path.F.every(x=>x<=3));
  }
 }
});
test('Calculated MSY exceeds a dense independent grid and is an age-structured equilibrium',()=>{
 for(const species of Object.keys(m.PRESETS))for(const srType of ['BH'])for(const steepness of [.3,.75,.95]){
  const s=m.makeStock(species),c=m.check({species,srType,steepness}),ref=m.referencePoints(s,c);
  assert.ok(ref.Fmsy>0&&ref.Fmsy<s.Fcap);assert.ok(ref.MSY>0);
  for(let i=0;i<=1000;i++){const F=3*i/1000,e=m.equilibrium(s,steepness,F,srType);assert.ok(m.catchAtF(e.N,s,F)<=ref.MSY+1e-7);}
  const e=m.equilibrium(s,steepness,ref.Fmsy,srType),next=m.advance(e.N,s,ref.Fmsy,m.recruitment(e.SSB,s,steepness,srType));
  next.forEach((x,a)=>near(x,e.N[a]));near(m.catchAtF(e.N,s,ref.Fmsy),ref.MSY);near(e.SSB,ref.SSBmsy);
 }
});
test('Catch levels are independent tonne quotas and do not change with U or the survey',()=>{
 const c=m.check({catchLow:35,fixedCatch:75,catchHigh:125,harvest:.8});
 for(const S of [10,500,2000]){near(m.advice('catchLow',S,c),35);near(m.advice('fixed',S,c),75);near(m.advice('catchHigh',S,c),125);}
});
test('F-based decision converts estimated ages into catch, and the F ramp closes at the limit',()=>{
 const c=m.check({estimator:'filter',Fmultiplier:1}),s=m.makeStock(c.species),ref=m.referencePoints(s,c),e=m.equilibrium(s,c.steepness,ref.Fmsy,c.srType),state=m.makeEstimator(s,c);
 state.N=e.N.slice();const d=m.decision('fmsy',e.SSB,c,null,state,ref);
 near(d.targetF,ref.Fmsy);near(d.catch,ref.MSY);near(m.invertCatch(e.N,s,d.catch).F,ref.Fmsy,1e-8);
 near(m.targetF('framp',c.limit*1000,c,ref),0);near(m.targetF('framp',c.trigger*1000,c,ref),ref.Fmsy);
 near(m.targetF('framp',(c.limit+c.trigger)*500,c,ref),ref.Fmsy/2);
 const direct=m.check({estimator:'direct'}),own=m.makeEstimator(s,direct),numbers=m.managementNumbers(own,400,direct);
 near(m.dot(numbers,s.sw),400);near(numbers[0]/numbers[1],s.unfished[0]/s.unfished[1]);
});
test('Reference points use the selected biological model, while process CV changes only stochastic runs',()=>{
 const s=m.makeStock('long'),c=m.check({species:'long'}),ref=m.referencePoints(s,c);
 assert.deepEqual(ref,m.referencePoints(s,{...c,recruitCV:1}));
 assert.deepEqual(ref,m.referencePoints(s,{...c,historicalF:[0,1,0]}));
 assert.notEqual(ref.Fmsy,m.referencePoints(s,{...c,steepness:.4}).Fmsy);
 assert.notEqual(ref.Fmsy,m.referencePoints(m.makeStock('long',1.4),c).Fmsy);
 const r=m.runEnsemble({...c,reps:2,years:5,Mfactor:1.4});near(r.reference.truth.Fmsy,ref.Fmsy);
 assert.notEqual(r.reference.manager.Fmsy,r.reference.truth.Fmsy);assert.equal(r.rules.length,8);
});
test('Zero observed risk has a positive binomial uncertainty upper bound',()=>{
 const [lo,hi]=m.wilson(0,200);near(lo,0);assert.ok(hi>0&&hi<.03);
});
test('Historical F parser preserves annual ordering and rejects invalid series',()=>{
 assert.deepEqual(m.parseHistoricalF('0, 0.1\n0.3; 0.2'),[0,.1,.3,.2]);
 for(const v of ['',[-1],[3.1],[NaN],'year,F\n2000,0.2',Array(151).fill(.2)])assert.throws(()=>m.parseHistoricalF(v));
 assert.throws(()=>m.check({srType:'Ricker'}));
 const input=[0,.2],c=m.check({historicalF:input});c.historicalF[0]=1;near(input[0],0);
});
test('Unfished historical F maintains every species at its BH age equilibrium',()=>{
 for(const species of Object.keys(m.PRESETS)){
  const c=m.check({species,historicalF:Array(150).fill(0)}),s=m.makeStock(species),h=m.historicalPopulation(s,c);
  h.ssb.forEach(S=>near(S,s.S0));h.catch.forEach(C=>near(C,0));h.recruits.forEach(R=>near(R,s.R0));
  h.N[150].forEach((N,a)=>near(N,s.unfished[a]));
 }
});
test('Supplied annual F directly determines historical catch, survival, aging and BH recruitment',()=>{
 const c=m.check({historicalF:[0,.2,.7,.1],recruitCV:1.5,implementationCV:1}),s=m.makeStock(c.species),h=m.historicalPopulation(s,c);
 let N=s.unfished.slice();
 for(let t=0;t<c.historicalF.length;t++){
  const F=c.historicalF[t],S=m.dot(N,s.sw),R=m.recruitment(S,s,c.steepness);
  near(h.F[t],F);near(h.catch[t],m.catchAtF(N,s,F));near(h.recruits[t],R);
  N=m.advance(N,s,F,R);N.forEach((v,a)=>near(h.N[t+1][a],v));near(h.ssb[t+1],m.dot(N,s.sw));
 }
 assert.deepEqual(h,m.historicalPopulation(s,{...c,recruitCV:0,implementationCV:0,harvest:0,fixedCatch:0}));
});
test('Historical endpoint and conditioned estimate are shared fairly by all future rules',()=>{
 const c=m.check({historicalF:[0,.3,.6,.2,.1],reps:4,years:8,estimator:'filter'}),r=m.runEnsemble(c),end=r.history.years;
 near(r.initial.SSB,r.history.ssb[end]);assert.deepEqual(r.initial.N,r.history.N[end]);assert.equal(r.initial.source,'historicalF');
 for(const rule of r.rules){near(rule.path.ssb[0],r.initial.SSB);assert.deepEqual(rule.path.N[0],r.history.N[end]);near(rule.path.estimate[0],r.rules[0].path.estimate[0]);near(rule.path.survey[0],r.rules[0].path.survey[0]);}
 const s=m.makeStock(c.species),w=m.conditionEstimator(s,c,r.history,m.shocks(42,0,end)),before=w.state.N.slice();
 m.trial(c,s,r.initial,'fixed',m.shocks(5,0,c.years),false,r.reference.manager,w);assert.deepEqual(w.state.N,before);
});
test('Historical F changes the true projection start, while observation noise changes only estimated history',()=>{
 const c={species:'medium',reps:1,years:5};
 const noFishing=m.runEnsemble({...c,historicalF:Array(30).fill(0)}),fishing=m.runEnsemble({...c,historicalF:Array(30).fill(.5)});
 near(noFishing.initial.SSB,1000);assert.ok(fishing.initial.SSB<noFishing.initial.SSB);
 const changedNoise=m.runEnsemble({...c,historicalF:Array(30).fill(.5),surveyCV:1});
 assert.deepEqual(changedNoise.history,fishing.history);assert.notDeepEqual(changedNoise.historicalView,fishing.historicalView);
});
test('Survey schedule and smoothing baseline continue through the historical handoff',()=>{
 const c=m.check({historicalF:[.1,.2,.3,.4,.5],surveyEvery:3,surveyCV:0,estimator:'mean',recruitCV:0,implementationCV:0,reps:1,years:5}),r=m.runEnsemble(c),path=r.rules.find(v=>v.id==='smooth').path;
 assert.equal(path.survey[0],null);near(path.survey[1],path.ssb[1]);near(path.estimate[0],r.historicalView.estimate.at(-1));
 near(path.advice[0],m.advice('smooth',path.estimate[0],c,r.history.catch.at(-1)));
});
