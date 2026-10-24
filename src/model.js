/* Classroom MSE model, version 1.2.0. Historical F drives an age-based BH population. */
(function (root) {
  'use strict';
  const VERSION = '1.2.0';
  const PRESETS = {
    short: {name:'Short lived', example:'Anchovy-like', A:7, M:0.90, k:0.75, winf:0.10, mat50:1.5, matSlope:3, selectAge:1},
    medium:{name:'Medium lived',example:'Hake-like',A:16,M:0.25,k:0.25,winf:2.0,mat50:3,matSlope:1.8,selectAge:4},
    long:{name:'Long lived',example:'Rockfish-like',A:75,M:0.07,k:0.12,winf:5.0,mat50:9,matSlope:0.9,selectAge:10}
  };
  const RULES = [
    {id:'catchLow',name:'Fixed catch A',short:'Catch A'},
    {id:'fixed', name:'Fixed catch B', short:'Catch B'},
    {id:'catchHigh',name:'Fixed catch C',short:'Catch C'},
    {id:'proportional',name:'Proportional catch',short:'Proportional'},
    {id:'ramp',name:'Biomass ramp',short:'Biomass ramp'},
    {id:'smooth',name:'Ramp + catch smoothing',short:'Ramp + smoothing'},
    {id:'fmsy',name:'Constant F target',short:'F target'},
    {id:'framp',name:'F-based biomass ramp',short:'F ramp'}
  ];
  const DEFAULTS={species:'medium',surveyCV:0.25,surveyBias:0,surveyEvery:1,
    estimator:'direct',recruitCV:0.45,implementationCV:0.10,historicalF:historicalPreset('development'),
    harvest:0.18,limit:0.20,trigger:0.50,smoothCap:0.20,Mfactor:1,
    srType:'BH',steepness:0.75,catchLow:50,fixedCatch:100,catchHigh:150,Fmultiplier:1,
    years:60,reps:200,seed:38617,rule:'framp'};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const dot=(a,b)=>a.reduce((x,v,i)=>x+v*b[i],0);
  const varianceLog=cv=>Math.log1p(cv*cv);
  function historicalPreset(name){
    const round=x=>Math.round(x*1000)/1000;
    if(name==='unfished')return Array(30).fill(0);
    if(name==='constant')return Array(30).fill(.2);
    if(name==='rebuilding')return Array.from({length:30},(_,i)=>round(i<20?.02+.63*i/19:.65-.55*(i-19)/10));
    return Array.from({length:30},(_,i)=>round(.02+.43*i/29));
  }
  function parseHistoricalF(value){
    const a=Array.isArray(value)?value.slice():String(value??'').trim().split(/[\s,;]+/).filter(Boolean).map(Number);
    if(a.length<1||a.length>150)throw Error('Enter 1–150 annual historical F values, oldest first.');
    if(a.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>3))throw Error('Each historical F must be a number from 0 to 3 per year. Enter F values only, without a year column.');
    return a;
  }
  function rng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function normal(random){return Math.sqrt(-2*Math.log(Math.max(1e-14,random())))*Math.cos(2*Math.PI*random());}
  function multiplier(cv,z){const v=varianceLog(cv);return Math.exp(Math.sqrt(v)*z-v/2);}
  function quantile(a,p){const b=a.slice().sort((x,y)=>x-y),i=(b.length-1)*p,k=Math.floor(i);return b[k]+(b[Math.min(k+1,b.length-1)]-b[k])*(i-k);}
  function wilson(k,n){const z=1.95996398454,p=k/n,d=1+z*z/n,m=(p+z*z/(2*n))/d,w=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,m-w),Math.min(1,m+w)];}
  function check(input){
    const c={...DEFAULTS,...input};
    if(!PRESETS[c.species])throw Error('Choose a life history.');
    if(!['direct','mean','filter'].includes(c.estimator))throw Error('Choose an estimation model.');
    if(c.srType!=='BH')throw Error('This population uses Beverton–Holt stock–recruitment.');
    c.historicalF=parseHistoricalF(c.historicalF);
    const bounds={surveyCV:[0,1.5],surveyBias:[-0.75,1],surveyEvery:[1,5],recruitCV:[0,1.5],implementationCV:[0,1],harvest:[0,0.8],limit:[0.05,0.7],trigger:[0.1,1],smoothCap:[0,1],Mfactor:[0.5,1.5],steepness:[0.21,0.99],catchLow:[0,1000],fixedCatch:[0,1000],catchHigh:[0,1000],Fmultiplier:[0,2],years:[5,150],reps:[1,1000],seed:[0,4294967295]};
    for(const [k,[lo,hi]]of Object.entries(bounds))if(!Number.isFinite(+c[k])||+c[k]<lo||+c[k]>hi)throw Error(k+' is outside the allowed range.');else c[k]=+c[k];
    if(c.limit>=c.trigger)throw Error('The biomass trigger must be above the closure limit.');
    for(const k of ['years','reps','seed','surveyEvery'])c[k]=Math.round(c[k]);
    return c;
  }
  function survivorship(stock,F){
    const n=Array(stock.A).fill(0);n[0]=1;
    for(let a=1;a<stock.A;a++)n[a]=n[a-1]*Math.exp(-stock.M-F*stock.sel[a-1]);
    const z=stock.M+F*stock.sel[stock.A-1];n[stock.A-1]/=-Math.expm1(-z);return n;
  }
  function makeStock(key,Mfactor=1){
    const b=PRESETS[key],A=b.A;
    const stock={...b,M:b.M*Mfactor,ages:Array.from({length:A},(_,i)=>i+1),S0:1000,Fcap:3};
    stock.w=stock.ages.map(a=>b.winf*Math.pow(1-Math.exp(-b.k*(a+0.2)),3)/1000); // tonnes per fish
    stock.mat=stock.ages.map(a=>1/(1+Math.exp(-b.matSlope*(a-b.mat50))));
    stock.sw=stock.w.map((w,i)=>w*stock.mat[i]);
    stock.sel=stock.ages.map(a=>a>=b.selectAge?1:0); // knife-edge fishing selectivity
    const n=survivorship(stock,0);stock.R0=stock.S0/dot(n,stock.sw);
    stock.unfished=n.map(v=>v*stock.R0);return stock;
  }
  function recruitment(ssb,stock,h){
    if(ssb<=0)return 0;
    return 4*h*stock.R0*ssb/(stock.S0*(1-h)+(5*h-1)*ssb);
  }
  function equilibrium(stock,h,F){
    const per=survivorship(stock,F),phi=dot(per,stock.sw);
    const R=Math.max(0,(4*h*stock.R0*phi-stock.S0*(1-h))/((5*h-1)*phi));
    const N=per.map(v=>v*R);return {N,SSB:dot(N,stock.sw),F};
  }
  // Equilibrium diagnostic only; the MSE population starts from historicalPopulation.
  function equilibriumAtDepletion(stock,h,depletion,srType='BH'){
    let lo=0,hi=stock.Fcap;
    for(let i=0;i<55;i++){const m=(lo+hi)/2;if(equilibrium(stock,h,m,srType).SSB/stock.S0>depletion)lo=m;else hi=m;}
    const e=equilibrium(stock,h,(lo+hi)/2,srType),target=depletion*stock.S0;
    e.scaledForInitialization=Math.abs(e.SSB-target)>1e-7;
    if(e.scaledForInitialization){const ratio=target/Math.max(e.SSB,1e-30);e.N=e.N.map(x=>x*ratio);e.SSB=dot(e.N,stock.sw);}
    return e;
  }
  function vulnerableBiomass(N,stock){let b=0;for(let a=0;a<N.length;a++)if(stock.sel[a])b+=N[a]*stock.w[a];return b;}
  function catchFactor(F,M){if(F===0)return 0;return F/(F+M)*(-Math.expm1(-(F+M)));}
  function catchAtF(N,stock,F){return vulnerableBiomass(N,stock)*catchFactor(F,stock.M);}
  function referencePoints(stock,c){
    // Deterministic equilibrium MSY, with the selected recruitment relationship.
    const yieldAt=F=>{const e=equilibrium(stock,c.steepness,F,c.srType);return catchAtF(e.N,stock,F);};
    const n=240,grid=Array.from({length:n+1},(_,i)=>({F:stock.Fcap*i/n,y:yieldAt(stock.Fcap*i/n)}));
    let best=0;for(let i=1;i<grid.length;i++)if(grid[i].y>grid[best].y)best=i;
    let lo=grid[Math.max(0,best-1)].F,hi=grid[Math.min(n,best+1)].F;
    const g=(Math.sqrt(5)-1)/2;let x1=hi-g*(hi-lo),x2=lo+g*(hi-lo),y1=yieldAt(x1),y2=yieldAt(x2);
    for(let i=0;i<65;i++){if(y1<y2){lo=x1;x1=x2;y1=y2;x2=lo+g*(hi-lo);y2=yieldAt(x2);}else{hi=x2;x2=x1;y2=y1;x1=hi-g*(hi-lo);y1=yieldAt(x1);}}
    const Fmsy=(lo+hi)/2,e=equilibrium(stock,c.steepness,Fmsy,c.srType),MSY=yieldAt(Fmsy);
    const xmax=Math.min(stock.Fcap,Math.max(.2,3*Fmsy));
    return {Fmsy,MSY,SSBmsy:e.SSB,Rmsy:e.N[0],xmax,
      curve:Array.from({length:241},(_,i)=>{const F=xmax*i/240;return{x:F,y:yieldAt(F)};})};
  }
  function invertCatch(N,stock,quota){
    const vb=vulnerableBiomass(N,stock),capacity=vb*catchFactor(stock.Fcap,stock.M);
    if(quota<=0||vb<=0)return {F:0,catch:0,capped:false};
    if(quota>=capacity)return {F:stock.Fcap,catch:capacity,capped:quota>capacity*(1+1e-10)};
    let lo=0,hi=stock.Fcap;const fraction=quota/vb;
    for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(catchFactor(mid,stock.M)>fraction)hi=mid;else lo=mid;}
    const F=(lo+hi)/2;return {F,catch:vb*catchFactor(F,stock.M),capped:false};
  }
  function advance(N,stock,F,R){
    const next=Array(stock.A).fill(0);next[0]=Math.max(0,R);
    for(let a=0;a<stock.A;a++){const survivors=N[a]*Math.exp(-stock.M-F*stock.sel[a]);next[Math.min(a+1,stock.A-1)]+=survivors;}
    return next;
  }
  function historicalPopulation(stock,c){
    // Supplied, fully selected annual F is applied directly to true age classes.
    // Historical recruitment follows the BH mean; no HCR or quota inversion here.
    let N=stock.unfished.slice();
    const out={years:c.historicalF.length,F:c.historicalF.slice(),N:[N.slice()],ssb:[dot(N,stock.sw)],catch:[],recruits:[]};
    for(const F of c.historicalF){
      const S=dot(N,stock.sw),R=recruitment(S,stock,c.steepness);
      out.catch.push(catchAtF(N,stock,F));out.recruits.push(R);
      N=advance(N,stock,F,R);out.N.push(N.slice());out.ssb.push(dot(N,stock.sw));
    }
    return out;
  }
  function makeEstimator(stock,c){
    const assumed=makeStock(c.species,c.Mfactor);
    return {stock:assumed,N:assumed.unfished.slice(),variance:0.30*0.30,
      history:[],last:stock.S0};
  }
  function estimate(state,index,c){
    const observed=Number.isFinite(index)?Math.max(index,1e-12):null;
    if(c.estimator==='filter'){
      let prediction=Math.max(1e-12,dot(state.N,state.stock.sw));
      if(observed!==null){
        const V=varianceLog(c.surveyCV),P=state.variance;
        const gain=V===0?1:P/(P+V);
        const mu=Math.log(prediction)+gain*(Math.log(observed)+V/2-Math.log(prediction));
        state.variance=(1-gain)*P;
        const updated=Math.exp(clamp(mu+state.variance/2,-30,30));
        const scale=updated/prediction;state.N=state.N.map(x=>x*scale);prediction=updated;
      }
      state.last=prediction;
    }else if(observed!==null){
      state.history.push(observed);if(state.history.length>3)state.history.shift();
      state.last=c.estimator==='mean'?sum(state.history)/state.history.length:observed;
    }
    return state.last;
  }
  function predictEstimator(state,actualCatch,c){
    if(c.estimator!=='filter')return;
    const S=dot(state.N,state.stock.sw),fit=invertCatch(state.N,state.stock,actualCatch);
    state.N=advance(state.N,state.stock,fit.F,recruitment(S,state.stock,c.steepness,c.srType));
    // Deliberately simple process-variance allowance, not a fitted assessment.
    const q=0.02+c.recruitCV*0.25/Math.sqrt(state.stock.mat50);
    state.variance=Math.min(1.5,state.variance+q*q);
  }
  function conditionEstimator(stock,c,history,z){
    // Historical noisy surveys and reported catches condition the manager's state.
    // The supplied true F and true age classes are not passed to the estimator.
    const state=makeEstimator(stock,c),view={survey:[],estimate:[]};
    for(let t=0;t<history.years;t++){
      const I=t%c.surveyEvery===0?history.ssb[t]*(1+c.surveyBias)*multiplier(c.surveyCV,z.obs[t]):null;
      view.survey.push(I);view.estimate.push(estimate(state,I,c));
      predictEstimator(state,history.catch[t],c);
    }
    return {state,view,previous:history.catch[history.years-1],surveyOffset:history.years};
  }
  function cloneEstimator(state){return {...state,N:state.N.slice(),history:state.history.slice()};}
  function advice(rule,ssb,c,previous=null){
    const d=ssb/1000;
    if(rule==='catchLow')return c.catchLow;
    if(rule==='fixed')return c.fixedCatch;
    if(rule==='catchHigh')return c.catchHigh;
    if(rule==='proportional')return c.harvest*ssb;
    if(d<=c.limit)return 0; // closure overrides smoothing
    const ramp=clamp((d-c.limit)/(c.trigger-c.limit),0,1);
    const raw=c.harvest*ssb*ramp;
    if(rule==='ramp'||previous===null)return raw;
    // After a closure, reopen at the unsmoothed rule to avoid a zero-catch lock.
    if(previous<=0)return raw;
    return clamp(raw,previous*(1-c.smoothCap),previous*(1+c.smoothCap));
  }
  function targetF(rule,ssb,c,reference){
    const ramp=rule==='framp'?clamp((ssb/1000-c.limit)/(c.trigger-c.limit),0,1):1;
    return Math.min(3,c.Fmultiplier*reference.Fmsy)*ramp;
  }
  function managementNumbers(state,estimated,c){
    // Only the filter estimates age composition; other estimators use an assumed
    // unfished age shape scaled to their survey-based SSB. Never use true N here.
    return c.estimator==='filter'?state.N:state.stock.unfished.map(v=>v*estimated/state.stock.S0);
  }
  function decision(rule,estimated,c,previous,state,reference){
    if(rule==='fmsy'||rule==='framp'){
      const F=targetF(rule,estimated,c,reference);
      return {catch:catchAtF(managementNumbers(state,estimated,c),state.stock,F),targetF:F};
    }
    return {catch:advice(rule,estimated,c,previous),targetF:null};
  }
  function shocks(seed,rep,years){
    const random=rng(((seed>>>0)^Math.imul(rep+1,0x9E3779B9))>>>0);
    return {rec:Array.from({length:years},()=>normal(random)),obs:Array.from({length:years},()=>normal(random)),impl:Array.from({length:years},()=>normal(random))};
  }
  function trial(c,stock,start,rule,z,retainAges=false,reference=null,conditioned=null){
    let N=start.N.slice(),state=conditioned?cloneEstimator(conditioned.state):makeEstimator(stock,c),previous=conditioned?conditioned.previous:null;
    reference=reference||referencePoints(state.stock,c);
    const out={ssb:[dot(N,stock.sw)],estimate:[],survey:[],advice:[],catch:[],F:[],targetF:[],recruits:[],capped:0};
    if(retainAges)out.N=[N.slice()];
    for(let t=0;t<c.years;t++){
      const S=dot(N,stock.sw);
      const I=(t+(conditioned?.surveyOffset||0))%c.surveyEvery===0?S*(1+c.surveyBias)*multiplier(c.surveyCV,z.obs[t]):null;
      const estimated=estimate(state,I,c);
      const action=decision(rule,estimated,c,previous,state,reference),quota=Math.max(0,action.catch);
      const desired=quota*multiplier(c.implementationCV,z.impl[t]);
      const fishing=invertCatch(N,stock,desired);
      const R=recruitment(S,stock,c.steepness,c.srType)*multiplier(c.recruitCV,z.rec[t]);
      out.estimate.push(estimated);out.survey.push(I);out.advice.push(quota);out.catch.push(fishing.catch);out.F.push(fishing.F);
      out.targetF.push(action.targetF);out.recruits.push(R);
      if(fishing.capped)out.capped++;
      predictEstimator(state,fishing.catch,c);
      N=advance(N,stock,fishing.F,R);out.ssb.push(dot(N,stock.sw));
      if(retainAges)out.N.push(N.slice());previous=quota;
    }
    out.crossed=out.ssb.slice(1).some(x=>x<stock.S0*c.limit);
    out.meanCatch=sum(out.catch)/c.years;
    out.change=sum(out.catch.slice(1).map((v,i)=>Math.abs(v-out.catch[i])))/(c.years-1);
    out.closed=out.advice.filter(v=>v===0).length/c.years;
    return out;
  }
  function bands(trials,key,length){
    return Array.from({length},(_,t)=>{const a=trials.map(r=>r[key][t]);return {x:t,lo:quantile(a,.1),mid:quantile(a,.5),hi:quantile(a,.9)};});
  }
  function runEnsemble(input,onProgress){
    const c=check(input),stock=makeStock(c.species),history=historicalPopulation(stock,c);
    const start={N:history.N[history.years].slice(),SSB:history.ssb[history.years],F:history.F[history.years-1],source:'historicalF'};
    const reference={truth:referencePoints(stock,c),manager:referencePoints(makeStock(c.species,c.Mfactor),c)};
    const runs=Object.fromEntries(RULES.map(r=>[r.id,[]]));let historicalView;
    for(let j=0;j<c.reps;j++){
      const z=shocks(c.seed,j,c.years);
      const conditioned=conditionEstimator(stock,c,history,shocks((c.seed^0xA17E57)>>>0,j,history.years));
      if(j===0)historicalView=conditioned.view;
      for(const r of RULES)runs[r.id].push(trial(c,stock,start,r.id,z,j===0,reference.manager,conditioned));
      if(onProgress&&(j%10===0||j===c.reps-1))onProgress((j+1)/c.reps);
    }
    const rules=RULES.map(rule=>{
      const x=runs[rule.id],crossings=x.filter(t=>t.crossed).length;
      const catchLevel={catchLow:c.catchLow,fixed:c.fixedCatch,catchHigh:c.catchHigh}[rule.id];
      const name=catchLevel===undefined?rule.name:rule.name+' · '+catchLevel+' t';
      return {...rule,name,metrics:{risk:crossings/c.reps,crossings,riskInterval:wilson(crossings,c.reps),
        meanCatch:sum(x.map(t=>t.meanCatch))/c.reps,change:sum(x.map(t=>t.change))/c.reps,
        terminal:quantile(x.map(t=>t.ssb[c.years]/stock.S0),.5),closed:sum(x.map(t=>t.closed))/c.reps,
        capFraction:sum(x.map(t=>t.capped))/(c.reps*c.years)},
        biomass:bands(x,'ssb',c.years+1),catches:bands(x,'catch',c.years),path:x[0]};
    });
    return {version:VERSION,config:c,stock,initial:start,history,historicalView,reference,rules};
  }
  const api={VERSION,PRESETS,RULES,DEFAULTS,check,rng,normal,multiplier,quantile,wilson,makeStock,
    survivorship,recruitment,equilibrium,equilibriumAtDepletion,catchFactor,catchAtF,invertCatch,advance,referencePoints,
    historicalPreset,parseHistoricalF,historicalPopulation,conditionEstimator,cloneEstimator,
    makeEstimator,estimate,predictEstimator,advice,targetF,managementNumbers,decision,shocks,trial,runEnsemble,dot,sum};
  root.MSELab=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
