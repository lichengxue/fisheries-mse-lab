(function(root){
'use strict';
const DEFAULTS={price:4,smallShare:.5,costScale:1,smallCostF:200000,largeCostF:120000,smallFixed:20000,largeFixed:30000,smallTonnesJob:4,largeTonnesJob:10,discount:.03,surveyCost:10000};
const TARGETS={catch:80,profit:200000,jobs:12,change:50};
const GUARDRAILS={enabled:true,risk:.2,profit:0,jobs:8,budget:20000};
const CRITERIA=[{id:'safety',name:'Keep the stock healthy'},{id:'profit',name:'Fishing profit'},{id:'jobs',name:'Jobs supported'},{id:'catch',name:'Catch amount'},{id:'stability',name:'Steady catches'}];
const ROLES=[
 {id:'fleet',name:'Fleet representatives',weights:{safety:2,profit:5,jobs:1,catch:3,stability:2}},
 {id:'community',name:'Coastal community',weights:{safety:3,profit:2,jobs:5,catch:2,stability:3}},
 {id:'conservation',name:'Conservation group',weights:{safety:8,profit:1,jobs:1,catch:1,stability:1}},
 {id:'management',name:'Management team',weights:{safety:4,profit:2,jobs:2,catch:1,stability:4}}
].map(r=>({...r,influence:1,minimum:55,enabled:true,vote:'',concern:''}));
const clamp=x=>Math.max(0,Math.min(1,x));
const sum=a=>a.reduce((x,v)=>x+v,0);
function quantile(a,p){const b=Array.from(a).sort((x,y)=>x-y),i=(b.length-1)*p,k=Math.floor(i);return b[k]+(b[Math.min(k+1,b.length-1)]-b[k])*(i-k);}
function validate(input={}){const a={...DEFAULTS,...input},bounds={price:[0,50],smallShare:[0,1],costScale:[0,5],smallCostF:[0,2000000],largeCostF:[0,2000000],smallFixed:[0,1000000],largeFixed:[0,1000000],smallTonnesJob:[.1,100],largeTonnesJob:[.1,100],discount:[0,.3],surveyCost:[0,1000000]};for(const[k,[lo,hi]]of Object.entries(bounds)){a[k]=Number(a[k]);if(!Number.isFinite(a[k])||a[k]<lo||a[k]>hi)throw Error('Check the economic assumption '+k+'.');}return a;}
function annual(catchTonnes,F,input){
 const a=input,share=a.smallShare;
 const smallCatch=catchTonnes*share,largeCatch=catchTonnes*(1-share);
 const smallRevenue=smallCatch*1000*a.price,largeRevenue=largeCatch*1000*a.price;
 const smallCost=share>0?a.smallFixed+a.costScale*a.smallCostF*F*share:0;
 const largeCost=share<1?a.largeFixed+a.costScale*a.largeCostF*F*(1-share):0;
 const smallJobs=smallCatch/a.smallTonnesJob,largeJobs=largeCatch/a.largeTonnesJob;
 return{revenue:smallRevenue+largeRevenue,cost:smallCost+largeCost,profit:smallRevenue+largeRevenue-smallCost-largeCost,jobs:smallJobs+largeJobs,small:{catch:smallCatch,revenue:smallRevenue,cost:smallCost,profit:smallRevenue-smallCost,jobs:smallJobs},large:{catch:largeCatch,revenue:largeRevenue,cost:largeCost,profit:largeRevenue-largeCost,jobs:largeJobs}};
}
function evaluate(result,input={},withBands=true){
 const a=validate(input),years=result.config.years,reps=result.config.reps;
 const surveys=result.rules[0].path.survey.filter(v=>v!==null).length;
 const agencyAnnual=surveys*a.surveyCost/years;
 const rules=result.rules.map(rule=>{
  const data=rule.economicTrials;if(!data||data.catch.length!==years*reps||data.F.length!==years*reps)throw Error('Update the simulation to generate the economic trajectories.');
  let revenue=0,cost=0,jobs=0,lossYears=0,negativeNPV=0,smallProfit=0,largeProfit=0,smallJobs=0,largeJobs=0;
  const npvs=[],annualProfits=withBands?Array.from({length:years},()=>[]):null,totals=years*reps;
  for(let j=0;j<reps;j++){
   let npv=0;
   for(let t=0;t<years;t++){
    const i=j*years+t,v=annual(data.catch[i],data.F[i],a);
    revenue+=v.revenue;cost+=v.cost;jobs+=v.jobs;smallProfit+=v.small.profit;largeProfit+=v.large.profit;smallJobs+=v.small.jobs;largeJobs+=v.large.jobs;
    if(v.profit<0)lossYears++;npv+=v.profit/(1+a.discount)**(t+1);if(withBands)annualProfits[t].push(v.profit);
   }
   npvs.push(npv);if(npv<0)negativeNPV++;
  }
  const metrics={revenue:revenue/totals,cost:cost/totals,profit:(revenue-cost)/totals,jobs:jobs/totals,lossYears:lossYears/totals,negativeNPV:negativeNPV/reps,npv:sum(npvs)/reps,npv10:quantile(npvs,.1),npv90:quantile(npvs,.9),agencyAnnual,netAfterSurvey:(revenue-cost)/totals-agencyAnnual,smallProfit:smallProfit/totals,largeProfit:largeProfit/totals,smallJobs:smallJobs/totals,largeJobs:largeJobs/totals};
  return{id:rule.id,name:rule.name,short:rule.short,metrics,biology:rule.metrics,profitBands:withBands?annualProfits.map((v,t)=>({x:t+1,lo:quantile(v,.1),mid:quantile(v,.5),hi:quantile(v,.9)})):[],path:rule.path.catch.map((C,t)=>annual(C,rule.path.F[t],a).profit)};
 });
 return{assumptions:a,years,reps,agencyAnnual,rules};
}
function scoreCriteria(rule,targets=TARGETS){
 const t={...TARGETS,...targets};for(const key of Object.keys(TARGETS))if(!Number.isFinite(+t[key])||+t[key]<=0)throw Error('Objective targets must be positive.');
 return{safety:100*(1-rule.biology.risk),profit:100*clamp(rule.metrics.profit/t.profit),jobs:100*clamp(rule.metrics.jobs/t.jobs),catch:100*clamp(rule.biology.meanCatch/t.catch),stability:100*clamp(1-rule.biology.change/t.change)};
}
function roleScore(criteria,role){const total=sum(CRITERIA.map(c=>Number(role.weights[c.id]||0)));if(total<=0)return null;return sum(CRITERIA.map(c=>criteria[c.id]*Number(role.weights[c.id]||0)))/total;}
function guardrailFailures(rule,input=GUARDRAILS){const g={...GUARDRAILS,...input};if(!g.enabled)return[];const failures=[];if(rule.biology.risk>g.risk+1e-10)failures.push('biological risk');if(rule.metrics.profit<g.profit-1e-10)failures.push('profit floor');if(rule.metrics.jobs<g.jobs-1e-10)failures.push('livelihoods floor');if(rule.metrics.agencyAnnual>g.budget+1e-10)failures.push('survey budget');return failures;}
function rank(economics,roles=ROLES,targets=TARGETS,guardrails=GUARDRAILS){
 const active=roles.filter(r=>r.enabled&&Number(r.influence)>0),influence=sum(active.map(r=>Number(r.influence)));
 const rows=economics.rules.map(rule=>{
  const criteria=scoreCriteria(rule,targets),scores=Object.fromEntries(active.map(r=>[r.id,roleScore(criteria,r)]));
  const valid=active.length>0&&Object.values(scores).every(v=>v!==null);
  const failures=guardrailFailures(rule,guardrails),passes=active.filter(r=>scores[r.id]!==null&&scores[r.id]+1e-10>=r.minimum).length;
  return{...rule,criteria,scores,weighted:valid?sum(active.map(r=>scores[r.id]*r.influence))/influence:null,passes,totalGroups:active.length,failures,commonGround:valid&&failures.length===0&&passes===active.length};
 });
 for(const r of rows)r.nonDominated=!rows.some(other=>other!==r&&other.biology.risk<=r.biology.risk&&other.metrics.profit>=r.metrics.profit&&other.metrics.jobs>=r.metrics.jobs&&other.biology.change<=r.biology.change&&(other.biology.risk<r.biology.risk||other.metrics.profit>r.metrics.profit||other.metrics.jobs>r.metrics.jobs||other.biology.change<r.biology.change));
 rows.sort((a,b)=>(b.weighted??-Infinity)-(a.weighted??-Infinity));
 return{rows,active,leader:rows.find(r=>r.failures.length===0&&r.weighted!==null)||null,common:rows.filter(r=>r.commonGround)};
}
const api={DEFAULTS,TARGETS,GUARDRAILS,CRITERIA,ROLES,validate,annual,evaluate,scoreCriteria,roleScore,guardrailFailures,rank};root.MSEEconomics=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
