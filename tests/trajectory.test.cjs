const test=require('node:test'),assert=require('node:assert/strict'),m=require('../src/model.js'),T=require('../src/trajectory.js');
const result=m.runEnsemble({years:9,reps:2,assessmentEvery:3,seed:12345}),ids=['framp','fixed','smooth'];
test('The shared timeline joins exact historical and MP state values at time zero',()=>{
 const s=T.series(result,ids,0);assert.equal(s.historySSB.length,result.history.years+1);
 assert.deepEqual(s.historySSB.at(-1),{x:0,y:result.initial.SSB});
 for(const p of s.rules)assert.deepEqual(p.ssb,[{x:0,y:result.initial.SSB}]);
 assert.deepEqual(s.historyCatch.at(-1),{x:0,y:result.history.catch.at(-1)});
});
test('Historical playback shows known history and no future MP states or advice',()=>{
 const s=T.series(result,ids,-10,3);assert.equal(s.history,true);assert.equal(s.cursor,-10);
 for(const p of s.rules){assert.deepEqual(p.ssb,[]);assert.deepEqual(p.catchTaken,[]);assert.deepEqual(p.advice,[]);}
 for(const p of T.snapshots(result,ids,-10,3)){assert.equal(p.ssb,result.history.ssb[result.history.years-10]);assert.equal(p.advice,null);}
});
test('SSB and catch reveal only completed annual transitions for every MP together',()=>{
 const before=T.series(result,ids,4,2),after=T.series(result,ids,4,3);
 for(let j=0;j<ids.length;j++){
  const p=result.rules.find(r=>r.id===ids[j]).path;
  assert.deepEqual(before.rules[j].ssb.at(-1),{x:4,y:p.ssb[4]});
  assert.deepEqual(after.rules[j].ssb.at(-1),{x:5,y:p.ssb[5]});
  assert.equal(before.rules[j].catchTaken.length,4);assert.equal(after.rules[j].catchTaken.length,5);
 }
 assert.notEqual(after.rules[0].ssb.at(-1).y,after.rules[1].ssb.at(-1).y);
});
test('Advice appears after the decision and may extend only to the next assessment',()=>{
 assert.equal(T.series(result,ids,0,1).adviceThrough,0);
 assert.equal(T.series(result,ids,0,2).adviceThrough,3);
 assert.equal(T.series(result,ids,2,0).adviceThrough,3);
 assert.equal(T.series(result,ids,3,1).adviceThrough,3);
 const s=T.series(result,ids,3,2);assert.equal(s.adviceThrough,6);
 for(const p of s.rules){assert.equal(p.advice.at(-1).x,6);assert.ok(p.advice.every(q=>q.x<=6));}
 const cards=T.snapshots(result,ids,3,1);assert.ok(cards.every(p=>p.estimate!==null&&p.advice===null));
});
test('The final frame contains every simulated year and the exact terminal population for each chosen MP',()=>{
 const s=T.series(result,ids,result.config.years);
 assert.equal(s.complete,true);assert.equal(s.cursor,9);
 for(const p of s.rules){const raw=result.rules.find(r=>r.id===p.id).path;assert.equal(p.ssb.length,10);assert.equal(p.catchTaken.length,9);assert.deepEqual(p.ssb.at(-1),{x:9,y:raw.ssb[9]});}
 assert.deepEqual(T.series(result,ids,999),s);
});
test('MP selection permits any subset, preserves order and never changes trajectories',()=>{
 const available=result.rules.map(r=>r.id);assert.equal(T.selection(available,available).length,8);
 for(const bad of [[],['fixed','fixed'],['missing']])assert.throws(()=>T.selection(bad,available));
 const alone=T.series(result,['smooth'],7,3).rules[0],together=T.series(result,ids,7,3).rules.find(r=>r.id==='smooth');assert.deepEqual(alone,together);
 assert.deepEqual(T.defaults(available),['framp','fixed','smooth']);
});
