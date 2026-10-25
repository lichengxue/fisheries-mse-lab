const test=require('node:test'),assert=require('node:assert/strict'),m=require('../src/model.js');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Survey index uses selected biomass while age samples use selected numbers',()=>{
 const c=m.check({surveyMinAge:3}),s=m.makeStock(c.species),N=s.unfished;
 const e=m.surveyExpectation(N,s,c),selected=N.map((v,a)=>s.ages[a]>=3?v:0);
 near(e.index,c.surveyQ*m.dot(selected,s.w));near(m.sum(e.proportions),1);
 e.proportions.forEach((p,a)=>near(p,selected[a]/m.sum(selected)));
 near(m.surveyExpectation(N,s,{...c,surveyQ:.2}).index,2*e.index);
 assert.deepEqual(m.surveyExpectation(N,s,{...c,surveyQ:.2}).proportions,e.proportions);
});
test('A single survey can provide an index, age composition, or both on the same schedule',()=>{
 for(const surveyData of ['index','ages','both']){
  const c=m.check({surveyData,surveyEvery:3,surveyCV:0}),s=m.makeStock(c.species),z=m.shocks(1,0,5);
  const visit=m.observeSurvey(s.unfished,s,c,1,z,2),missing=m.observeSurvey(s.unfished,s,c,0,z,2);
  assert.equal(visit.visited,true);assert.equal(missing.visited,false);assert.equal(missing.index,null);assert.equal(missing.counts,null);
  assert.equal(visit.index!==null,surveyData!=='ages');assert.equal(visit.counts!==null,surveyData!=='index');
  if(visit.counts)assert.equal(m.sum(visit.counts),c.ageSample);
 }
 assert.throws(()=>m.check({surveyData:'ages',estimator:'direct'}));
 assert.equal(m.check({estimator:'filter'}).estimator,'assessment');
 for(const species of ['short','medium','long']){
  const r=m.runEnsemble({species,surveyData:'ages',surveyEvery:3,years:5,reps:2});
  for(const rule of r.rules){assert.ok(rule.path.survey.every(v=>v===null));assert.ok(rule.path.estimate.every(v=>Number.isFinite(v)&&v>=0));}
 }
});
test('Multinomial age sampling is reproducible and larger samples reduce sampling noise',()=>{
 assert.deepEqual(m.sampleAges([.2,.3,.5],100,7),m.sampleAges([.2,.3,.5],100,7));
 const errors=n=>Array.from({length:1500},(_,i)=>{const x=m.sampleAges([.2,.3,.5],n,i);assert.equal(m.sum(x),n);return (x[0]/n-.2)**2;});
 const a=errors(20),b=errors(500);assert.ok(m.sum(b)<m.sum(a)/10);
 near(m.sum(m.sampleAges([0,1,0],100,1)),100);assert.deepEqual(m.sampleAges([0,1,0],100,1),[0,100,0]);
});
test('Age sampling never changes recruitment, index-noise or implementation random streams',()=>{
 const c=m.check({}),s=m.makeStock(c.species),z=m.shocks(42,2,10),before=structuredClone(z);
 m.observeSurvey(s.unfished,s,c,0,z);assert.deepEqual(z,before);
 const a=m.runEnsemble({years:6,reps:2,surveyData:'index'}),b=m.runEnsemble({years:6,reps:2,surveyData:'both'});
 // Fixed quotas use the same true removals even when assessment estimates differ.
 assert.deepEqual(a.rules[0].path.ssb,b.rules[0].path.ssb);
 assert.deepEqual(a.rules[0].path.survey,b.rules[0].path.survey);
});
test('Age-structured assessment fits a penalized likelihood and age data change estimated shape',()=>{
 const c=m.check({surveyCV:.1}),s=m.makeStock(c.species),e=m.makeEstimator(s,c),N=s.unfished.map((v,a)=>v*(a<3?2:.3));
 const expected=m.surveyExpectation(N,s,c),counts=m.sampleAges(expected.proportions,1000,42);
 m.estimate(e,{index:expected.index,counts},c);
 assert.ok(e.fit.objectiveAfter<e.fit.objectiveBefore-1);
 const noAges=m.makeEstimator(s,c);m.estimate(noAges,{index:expected.index,counts:null},c);
 const excluded=m.makeEstimator(s,c);m.estimate(excluded,{index:expected.index,counts},{...c,useAgeData:0});
 assert.deepEqual(excluded.N,noAges.N);
 assert.ok(Math.abs(e.N[0]/e.N[5]-noAges.N[0]/noAges.N[5])>1);
 const snap=m.assessmentSnapshot(e,{visited:true,counts,sampleSize:1000},c);
 assert.ok(snap.lo<snap.ssb&&snap.hi>snap.ssb);near(snap.fittedIndex,c.assumedQ*m.dot(e.N,s.w));
 assert.deepEqual(snap.N,e.N);assert.equal(snap.sampleSize,1000);
});
test('With informative exact-shape samples and a precise index the fitted ages recover a known population',()=>{
 const c=m.check({surveyCV:0}),s=m.makeStock(c.species),N=s.unfished.map((v,a)=>v*(a<4?.7:1.3)),e=m.makeEstimator(s,c);
 const expected=m.surveyExpectation(N,s,c),counts=expected.proportions.map(p=>p*1e6);
 m.estimate(e,{index:expected.index,counts},c);
 near(m.dot(e.N,s.sw),m.dot(N,s.sw),.002);
 e.N.forEach((v,a)=>near(v,N[a],.003));
});
test('The assessment uses only supplied observations, assumed biology, and lagged reported catch',()=>{
 const c=m.check({surveyData:'index'}),s=m.makeStock(c.species),a=m.makeEstimator(s,c),b=m.makeEstimator({S0:999999,unfished:[123]},c);
 assert.deepEqual(a,b); // No true state or true F is read, including at initialization.
 const obs={index:85,counts:null};m.estimate(a,obs,c);m.estimate(b,obs,c);assert.deepEqual(a,b);
 m.predictEstimator(a,0,c);m.predictEstimator(b,100,c);assert.notDeepEqual(a.N,b.N);assert.ok(b.previousF>a.previousF);
 const miss=m.assessmentSnapshot(b,{visited:false,counts:null},c);assert.equal(miss.catchShortfall,false);
});
test('Assumed survey calibration and natural mortality can cause assessment error',()=>{
 const c=m.check({surveyCV:.05}),s=m.makeStock(c.species),obs={index:100,counts:null};
 const a=m.makeEstimator(s,c),d={...c,assumedQ:.2},b=m.makeEstimator(s,d);
 m.estimate(a,obs,c);m.estimate(b,obs,d);assert.ok(b.last<a.last*.7);
 const scaled=m.makeEstimator(s,c);m.estimate(scaled,{index:200,counts:null},{...c,assumedQ:.2});
 scaled.N.forEach((v,i)=>near(v,a.N[i]));
 const r=m.runEnsemble({years:5,reps:1}),wrong=m.runEnsemble({years:5,reps:1,Mfactor:1.4});
 assert.deepEqual(r.history,wrong.history);assert.notDeepEqual(r.historicalView.estimate,wrong.historicalView.estimate);
});
test('Without a survey the assessment predicts forward and reports conditional uncertainty',()=>{
 const c=m.check({surveyData:'index',surveyCV:.05,assessmentProcessCV:.5}),s=m.makeStock(c.species),e=m.makeEstimator(s,c);
 m.estimate(e,{index:100,counts:null},c);const old=e.variance;
 m.predictEstimator(e,50,c);const predicted=e.N.slice();m.estimate(e,{index:null,counts:null},c);
 e.N.forEach((v,a)=>near(v,predicted[a]));assert.ok(e.variance>old);assert.equal(e.fit.iterations,0);
 assert.ok(Number.isFinite(e.last)&&e.last>0);
});
test('Information solver matches its defining matrix and preserves positive uncertainty',()=>{
 const P=[.2,.4,.3],p=[.2,.3,.5],v=[.1,.2,.7],n=100,V=.05,info=m.assessmentInformation(P,p,v,n,V),b=[1,-2,3],x=info.solve(b);
 for(let i=0;i<3;i++)near(x[i]/P[i]+n*p[i]*x[i]-n*p[i]*m.dot(p,x)+v[i]*m.dot(v,x)/V,b[i]);
 assert.ok(info.diag.every(d=>d>0));
});
