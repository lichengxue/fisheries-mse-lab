/* Classroom MSE model: age-based biology, survey data and a sequential assessment. */
(function (root) {
  'use strict';
  const VERSION = '1.4.0';
  const PRESETS = {
    short: {name:'Short lived', example:'Anchovy-like', A:7, M:0.90, k:0.75, winf:0.10, mat50:1.5, matSlope:3, selectAge:1},
    medium:{name:'Medium lived',example:'Hake-like',A:16,M:0.25,k:0.25,winf:2.0,mat50:3,matSlope:1.8,selectAge:4},
    long:{name:'Long lived',example:'Rockfish-like',A:75,M:0.07,k:0.12,winf:5.0,mat50:9,matSlope:0.9,selectAge:10}
  };
  const RULES = [
    {id:'catchLow',name:'Fixed catch A',short:'Catch A'},
    {id:'fixed', name:'Fixed catch B', short:'Catch B'},
    {id:'catchHigh',name:'Fixed catch C',short:'Catch C'},
    {id:'proportional',name:'Catch a fixed share',short:'Fixed share'},
    {id:'ramp',name:'Stock-based catch',short:'Stock rule'},
    {id:'smooth',name:'Stock rule + steady catch',short:'Steady catch'},
    {id:'fmsy',name:'FMSY target',short:'FMSY target'},
    {id:'framp',name:'FMSY with a stock limit',short:'FMSY + limit'}
  ];
  const DEFAULTS={species:'medium',surveyCV:0.25,surveyBias:0,surveyEvery:1,
    surveyData:'both',surveyQ:0.1,surveyMinAge:1,ageSample:100,
    estimator:'assessment',useAgeData:1,assumedQ:0.1,assessmentProcessCV:0.15,recruitCV:0.45,implementationCV:0.10,historicalF:historicalPreset('development'),
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
    if(c.estimator==='filter')c.estimator='assessment'; // Earlier saved scenarios.
    if(!['direct','mean','assessment'].includes(c.estimator))throw Error('Choose an assessment method.');
    if(!['index','both','ages'].includes(c.surveyData))throw Error('Choose what the survey provides.');
    if(c.surveyData==='ages'&&c.estimator!=='assessment')throw Error('Age samples alone require the age-structured assessment.');
    if(![0,1].includes(+c.useAgeData))throw Error('Choose whether the assessment uses age samples.');
    c.useAgeData=+c.useAgeData;
    if(c.surveyData==='ages'&&!c.useAgeData)throw Error('With age samples only, include those samples in the assessment.');
    if(c.srType!=='BH')throw Error('This population uses Beverton–Holt stock–recruitment.');
    c.historicalF=parseHistoricalF(c.historicalF);
    const bounds={surveyQ:[0.001,10],assumedQ:[0.001,10],surveyMinAge:[1,PRESETS[c.species].A],ageSample:[10,1000],assessmentProcessCV:[0,0.6],surveyCV:[0,1.5],surveyBias:[-0.75,1],surveyEvery:[1,5],recruitCV:[0,1.5],implementationCV:[0,1],harvest:[0,0.8],limit:[0.05,0.7],trigger:[0.1,1],smoothCap:[0,1],Mfactor:[0.5,1.5],steepness:[0.21,0.99],catchLow:[0,1000],fixedCatch:[0,1000],catchHigh:[0,1000],Fmultiplier:[0,2],years:[5,150],reps:[1,1000],seed:[0,4294967295]};
    for(const [k,[lo,hi]]of Object.entries(bounds))if(!Number.isFinite(+c[k])||+c[k]<lo||+c[k]>hi)throw Error(k+' is outside the allowed range.');else c[k]=+c[k];
    if(c.limit>=c.trigger)throw Error('The biomass trigger must be above the closure limit.');
    for(const k of ['years','reps','seed','surveyEvery','surveyMinAge','ageSample'])c[k]=Math.round(c[k]);
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
  // One survey visit can produce an aggregate biomass index, ages, or both.
  // Age proportions describe sampled NUMBERS, not biomass; q cancels from them.
  function surveySelectivity(stock,c){return stock.ages.map(a=>a>=c.surveyMinAge?1:0);}
  function surveyExpectation(N,stock,c,q=c.surveyQ){
    const sel=surveySelectivity(stock,c),numbers=N.map((v,a)=>v*sel[a]),total=sum(numbers);
    return {index:q*dot(numbers,stock.w),proportions:numbers.map(v=>total>0?v/total:0)};
  }
  function sampleAges(proportions,n,seed){
    const random=rng(seed),counts=Array(proportions.length).fill(0),cdf=[];let total=0;
    for(const p of proportions){total+=p;cdf.push(total);}
    if(total<=0)return counts;
    for(let j=0;j<n;j++){
      const u=random()*total;let lo=0,hi=cdf.length-1;
      while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]>u)hi=mid;else lo=mid+1;}counts[lo]++;
    }
    return counts;
  }
  function observeSurvey(N,stock,c,t,z,offset=0){
    if((t+offset)%c.surveyEvery!==0)return {visited:false,index:null,counts:null,sampleSize:0};
    const expected=surveyExpectation(N,stock,c),hasIndex=c.surveyData!=='ages',hasAges=c.surveyData!=='index';
    const counts=hasAges?sampleAges(expected.proportions,c.ageSample,z.ageSeeds[t]):null;
    return {visited:true,index:hasIndex?expected.index*(1+c.surveyBias)*multiplier(c.surveyCV,z.obs[t]):null,
      counts,sampleSize:counts?sum(counts):0};
  }
  function makeEstimator(stock,c){
    // stock supplies no true state. The assessment builds its own assumed biology.
    const assumed=makeStock(c.species,c.Mfactor);
    return {stock:assumed,N:assumed.unfished.slice(),P:Array(assumed.A).fill(.6*.6),
      variance:.36,history:[],last:assumed.S0,fit:null,previousF:null,catchShortfall:false};
  }
  // Expected-information matrix: diagonal minus one rank + one rank.
  // This O(A) solve keeps a fitted assessment affordable inside every MSE year.
  function assessmentInformation(priorP,p,v,n,V){
    const d=priorP.map((P,a)=>1/(1/Math.max(P,1e-7)+n*p[a])),u=d.map((x,a)=>x*p[a]);
    const alpha=n/Math.max(1e-12,1-n*dot(p,u));
    const base=b=>{const k=alpha*dot(u,b);return d.map((x,a)=>x*b[a]+u[a]*k);};
    const w=base(v),beta=V===null?0:1/(V+dot(v,w));
    const solve=b=>{const y=base(b),k=beta*dot(w,b);return y.map((x,a)=>x-w[a]*k);};
    return {solve,diag:d.map((x,a)=>Math.max(1e-8,x+alpha*u[a]*u[a]-beta*w[a]*w[a]))};
  }
  function fitAssessment(state,observation,c){
    const s=state.stock,sel=surveySelectivity(s,c),prior=state.N.map(v=>Math.log(Math.max(v,1e-12))),priorP=state.P.slice();
    const counts=observation.counts,n=counts?sum(counts):0;
    const hasIndex=Number.isFinite(observation.index)&&observation.index>0;
    const observedV=varianceLog(c.surveyCV),V=hasIndex?Math.max(1e-6,observedV):null;
    const y=hasIndex?Math.log(observation.index)+observedV/2:null;
    const evaluate=x=>{
      const N=x.map(Math.exp),sample=N.map((v,a)=>v*sel[a]),total=Math.max(sum(sample),1e-30),B=Math.max(dot(sample,s.w),1e-30);
      const p=sample.map(v=>v/total),v=sample.map((z,a)=>z*s.w[a]/B);
      const residual=hasIndex?Math.log(c.assumedQ*B)-y:0;
      let objective=hasIndex?residual*residual/(2*V):0;
      const gradient=x.map((z,a)=>{objective+=(z-prior[a])**2/(2*priorP[a]);if(counts?.[a])objective-=counts[a]*Math.log(Math.max(p[a],1e-30));
        return (z-prior[a])/priorP[a]+(hasIndex?residual*v[a]/V:0)+(n?p[a]*n-counts[a]:0);});
      return {N,p,v,objective,gradient,index:c.assumedQ*B,residual};
    };
    let x=prior.slice(),e=evaluate(x),before=e.objective,iterations=0,converged=!hasIndex&&!n;
    for(;iterations<18&&(hasIndex||n);iterations++){
      const info=assessmentInformation(priorP,e.p,e.v,n,V),step=info.solve(e.gradient),max=Math.max(...step.map(Math.abs));
      if(max<1e-5){converged=true;break;}
      let rate=Math.min(1,2/Math.max(max,1e-12)),accepted=false;
      for(let j=0;j<14;j++,rate/=2){
        const candidate=x.map((z,a)=>clamp(z-rate*step[a],-27,37)),next=evaluate(candidate);
        if(next.objective<=e.objective+1e-9){x=candidate;e=next;accepted=true;break;}
      }
      if(!accepted)break;
    }
    const info=assessmentInformation(priorP,e.p,e.v,n,V),S=dot(e.N,s.sw),shares=e.N.map((v,a)=>v*s.sw[a]/Math.max(S,1e-30));
    state.N=e.N;state.P=info.diag;state.last=S;
    state.variance=Math.max(0,dot(shares,info.solve(shares)));
    state.fit={iterations,converged,objectiveBefore:before,objectiveAfter:e.objective,
      priorIndex:evaluate(prior).index,fittedIndex:e.index,priorSSB:dot(prior.map(Math.exp),s.sw),
      indexResidual:hasIndex?-e.residual/Math.sqrt(V):null};
    return S;
  }
  function estimate(state,data,c){
    const observation=typeof data==='number'||data===null?{index:data,counts:null}:data;
    if(c.estimator==='assessment')return fitAssessment(state,c.useAgeData?observation:{...observation,counts:null},c);
    // These two comparators assume a fixed unfished age shape and calibrated q.
    // They are deliberately labelled index shortcuts, not age-structured fits.
    if(Number.isFinite(observation.index)){
      const perSSB=surveyExpectation(state.stock.unfished,state.stock,c,c.assumedQ).index/state.stock.S0;
      const calibrated=Math.max(1e-12,observation.index)/perSSB;
      state.history.push(calibrated);if(state.history.length>3)state.history.shift();
      state.last=c.estimator==='mean'?sum(state.history)/state.history.length:calibrated;
    }
    state.N=state.stock.unfished.map(v=>v*state.last/state.stock.S0);state.fit=null;
    return state.last;
  }
  function assessmentSnapshot(state,observation,c){
    const expected=surveyExpectation(state.N,state.stock,c,c.assumedQ),sd=Math.sqrt(Math.max(0,state.variance));
    return {ssb:state.last,lo:c.estimator==='assessment'?state.last*Math.exp(-1.281551566*sd):null,
      hi:c.estimator==='assessment'?state.last*Math.exp(1.281551566*sd):null,
      fittedIndex:expected.index,fittedAge:expected.proportions,N:state.N.slice(),
      observedAge:observation.counts?.slice()||null,sampleSize:observation.sampleSize||0,
      visited:observation.visited,previousF:state.previousF,catchShortfall:state.catchShortfall,...state.fit};
  }
  function predictEstimator(state,actualCatch,c){
    if(c.estimator!=='assessment')return;
    const s=state.stock,S=dot(state.N,s.sw),fit=invertCatch(state.N,s,actualCatch),oldN=state.N,oldP=state.P;
    state.N=advance(oldN,s,fit.F,recruitment(S,s,c.steepness));state.previousF=fit.F;state.catchShortfall=fit.capped;
    const process=varianceLog(c.assessmentProcessCV),nextP=Array(s.A).fill(0);
    nextP[0]=Math.max(1e-6,varianceLog(c.recruitCV)+process);
    for(let a=1;a<s.A-1;a++)nextP[a]=Math.min(4,oldP[a-1]+process);
    const j=s.A-1,enter=oldN[j-1]*Math.exp(-s.M-fit.F*s.sel[j-1]),stay=oldN[j]*Math.exp(-s.M-fit.F*s.sel[j]),total=Math.max(enter+stay,1e-30);
    nextP[j]=Math.min(4,(enter/total)**2*oldP[j-1]+(stay/total)**2*oldP[j]+process);
    state.P=nextP.map(v=>Math.max(v,1e-7));
  }
  function conditionEstimator(stock,c,history,z){
    // Only observations and reported catch enter the fitted assessment.
    const state=makeEstimator(stock,c),view={survey:[],estimate:[],ageComp:[],assessment:[]};
    for(let t=0;t<history.years;t++){
      const obs=observeSurvey(history.N[t],stock,c,t,z);
      view.survey.push(obs.index);view.estimate.push(estimate(state,obs,c));view.ageComp.push(obs.counts);
      view.assessment.push(assessmentSnapshot(state,obs,c));predictEstimator(state,history.catch[t],c);
    }
    return {state,view,previous:history.catch[history.years-1],surveyOffset:history.years};
  }
  function cloneEstimator(state){return {...state,N:state.N.slice(),P:state.P.slice(),history:state.history.slice(),fit:state.fit?{...state.fit}:null};}
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
    // Only the fitted assessment estimates age composition; shortcuts assume an
    // unfished age shape scaled to their survey-based SSB. Never use true N here.
    return c.estimator==='assessment'?state.N:state.stock.unfished.map(v=>v*estimated/state.stock.S0);
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
    const ageRandom=rng(((seed>>>0)^Math.imul(rep+1,0x85EBCA6B)^0xC0A6E)>>>0);
    return {rec:Array.from({length:years},()=>normal(random)),obs:Array.from({length:years},()=>normal(random)),impl:Array.from({length:years},()=>normal(random)),
      ageSeeds:Array.from({length:years},()=>Math.floor(ageRandom()*4294967296))};
  }
  function trial(c,stock,start,rule,z,retainAges=false,reference=null,conditioned=null){
    let N=start.N.slice(),state=conditioned?cloneEstimator(conditioned.state):makeEstimator(stock,c),previous=conditioned?conditioned.previous:null;
    reference=reference||referencePoints(state.stock,c);
    const out={ssb:[dot(N,stock.sw)],estimate:[],survey:[],advice:[],catch:[],F:[],targetF:[],recruits:[],capped:0};
    if(retainAges){out.N=[N.slice()];out.assessment=[];out.ageComp=[];out.surveyVisits=[];}
    for(let t=0;t<c.years;t++){
      const S=dot(N,stock.sw);
      const observation=observeSurvey(N,stock,c,t,z,conditioned?.surveyOffset||0),I=observation.index;
      const estimated=estimate(state,observation,c);
      if(retainAges){out.assessment.push(assessmentSnapshot(state,observation,c));out.ageComp.push(observation.counts);out.surveyVisits.push(observation.visited);}
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
      const economicTrials={catch:new Float64Array(c.reps*c.years),F:new Float64Array(c.reps*c.years)};
      x.forEach((trial,j)=>{economicTrials.catch.set(trial.catch,j*c.years);economicTrials.F.set(trial.F,j*c.years);});
      return {...rule,name,economicTrials,metrics:{risk:crossings/c.reps,crossings,riskInterval:wilson(crossings,c.reps),
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
    surveySelectivity,surveyExpectation,sampleAges,observeSurvey,fitAssessment,assessmentInformation,assessmentSnapshot,
    makeEstimator,estimate,predictEstimator,advice,targetF,managementNumbers,decision,shocks,trial,runEnsemble,dot,sum};
  root.MSELab=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
