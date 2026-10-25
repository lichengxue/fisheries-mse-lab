const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../src/tradeoffs.js'),E=require('../src/economics.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const rules=[
 {id:'a',name:'MP A',short:'A',biology:{risk:.1,meanCatch:40,change:10},metrics:{profit:100000,jobs:6}},
 {id:'b',name:'MP B',short:'B',biology:{risk:.6,meanCatch:100,change:60},metrics:{profit:-5000,jobs:20}},
 {id:'c',name:'MP C',short:'C',biology:{risk:0,meanCatch:0,change:0},metrics:{profit:0,jobs:0}}
];
test('Radar uses the shared objective scales and preserves original units',()=>{
 const [a,b]=T.profiles({rules},['a','b']);
 assert.deepEqual(a.raw,{safety:.1,catch:40,profit:100000,jobs:6,stability:10});
 assert.deepEqual(a.scores,E.scoreCriteria(rules[0]));near(a.scores.safety,90);near(a.scores.catch,50);near(a.scores.profit,50);near(a.scores.jobs,50);near(a.scores.stability,80);
 near(b.scores.profit,0);near(b.scores.stability,0);near(b.scores.catch,100);near(b.scores.jobs,100);
 assert.ok(Object.values(b.scores).every(v=>v>=0&&v<=100));
});
test('Adding or removing comparison MPs never rescales another MP',()=>{
 const before=structuredClone(rules),alone=T.profiles({rules},['a']),together=T.profiles({rules},['c','b','a']);
 assert.deepEqual(alone[0],together[2]);assert.deepEqual(rules,before);
 const changed=T.profiles({rules},['a'],{...E.TARGETS,catch:160})[0];near(changed.scores.catch,25);
 for(const key of ['safety','profit','jobs','stability'])near(changed.scores[key],alone[0].scores[key]);
});
test('Comparison selection is limited and never implies a preferred MP',()=>{
 assert.deepEqual(T.defaultSelection(['a','b','c'],'c'),['c','a','b']);
 assert.deepEqual(T.defaultSelection(['framp','fixed','smooth','ramp']),'framp,fixed,smooth'.split(','));
 for(const ids of [[],['a','a'],['missing'],['a','b','c','d']])assert.throws(()=>T.profiles({rules},ids));
 assert.throws(()=>T.profiles({rules},['a'],{catch:0}));
});
