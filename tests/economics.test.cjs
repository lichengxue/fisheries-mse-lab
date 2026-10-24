const test=require('node:test');
const assert=require('node:assert/strict');
const e=require('../src/economics.js'),m=require('../src/model.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Economics accounts for tonnes, kilograms, allocated effort, fixed costs and job proxies',()=>{
 const v=e.annual(100,.5,e.validate());near(v.revenue,400000);near(v.cost,130000);near(v.profit,270000);near(v.jobs,17.5);near(v.small.profit+v.large.profit,v.profit);
 const closed=e.annual(0,0,e.validate());near(closed.profit,-50000);near(closed.jobs,0);
 near(e.annual(0,0,e.validate({smallShare:0})).cost,30000);near(e.annual(0,0,e.validate({smallShare:1})).cost,20000);
});
const fixture=()=>({config:{years:2,reps:2},rules:[{id:'a',name:'A',short:'A',economicTrials:{catch:[10,20,0,10],F:[0,0,0,0]},metrics:{risk:.1,meanCatch:10,change:5},path:{survey:[10,null],catch:[10,20],F:[0,0]}}]});
test('All futures determine profit, losses, discounted NPV and pointwise bands',()=>{
 const a={price:1,smallFixed:5000,largeFixed:10000,discount:0,surveyCost:2000};
 const r=e.evaluate(fixture(),a).rules[0];near(r.metrics.profit,-5000);near(r.metrics.npv,-10000);near(r.metrics.lossYears,.75);near(r.metrics.negativeNPV,.5);near(r.metrics.agencyAnnual,1000);near(r.metrics.netAfterSurvey,-6000);near(r.profitBands[0].mid,-10000);near(r.profitBands[1].mid,0);near(r.profitBands[0].lo,-14000);
 const discounted=e.evaluate(fixture(),{...a,discount:.1}).rules[0];near(discounted.metrics.npv,(-5000/1.1+5000/1.1**2-15000/1.1-5000/1.1**2)/2);
 assert.deepEqual(e.evaluate(fixture(),a,false).rules[0].profitBands,[]);
});
test('Retained catch and F trajectories match biological summaries without economic feedback',()=>{
 const r=m.runEnsemble({years:8,reps:4}),before=structuredClone(r);
 for(const rule of r.rules){near(m.sum(Array.from(rule.economicTrials.catch))/32,rule.metrics.meanCatch);assert.deepEqual(Array.from(rule.economicTrials.catch).slice(0,8),rule.path.catch);assert.deepEqual(Array.from(rule.economicTrials.F).slice(0,8),rule.path.F);}
 e.evaluate(r,{price:8,costScale:2,smallShare:.9});assert.deepEqual(r,before);
});
test('Scores use fixed target anchors, normalized weights, and require a nonzero objective weight',()=>{
 const rule=e.evaluate(fixture()).rules[0],scores=e.scoreCriteria(rule,{catch:20,profit:200000,jobs:10,change:10});near(scores.safety,90);near(scores.catch,50);near(scores.stability,50);
 near(e.roleScore(scores,{weights:{safety:2,catch:2}}),70);assert.equal(e.roleScore(scores,{weights:{}}),null);
 assert.throws(()=>e.scoreCriteria(rule,{jobs:0}));assert.throws(()=>e.validate({price:Infinity}));
});
test('Guardrails and role thresholds are separate; no roles cannot imply agreement',()=>{
 const econ=e.evaluate(fixture()),roles=[{id:'x',enabled:true,influence:1,minimum:80,weights:{safety:1}}];
 const g={enabled:true,risk:.2,profit:-100000,jobs:0,budget:100000};
 const rank=e.rank(econ,roles,e.TARGETS,g);assert.equal(rank.common.length,1);assert.equal(rank.leader.id,'a');
 assert.equal(e.rank(econ,roles,e.TARGETS,{...g,risk:0}).leader,null);
 assert.equal(e.rank(econ,[],e.TARGETS,g).common.length,0);assert.equal(e.rank(econ,[{...roles[0],weights:{}}],e.TARGETS,g).leader,null);
});
test('Dominance identifies a rule that is no worse on risk, profit, jobs and catch variation',()=>{
 const econ=e.evaluate(fixture()),a=econ.rules[0];econ.rules.push({...a,id:'b',biology:{...a.biology,risk:.2,change:6},metrics:{...a.metrics,profit:a.metrics.profit-1,jobs:a.metrics.jobs-1}});
 const ranks=e.rank(econ,e.ROLES,e.TARGETS,{enabled:false});assert.equal(ranks.rows.find(r=>r.id==='a').nonDominated,true);assert.equal(ranks.rows.find(r=>r.id==='b').nonDominated,false);
});
