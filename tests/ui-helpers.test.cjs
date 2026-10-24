const test=require('node:test');const assert=require('node:assert/strict');const {buildHistory,parseCSV}=require('../src/ui-helpers.js');
test('history builder keeps requested years, endpoints and turning point',()=>{
 assert.deepEqual(buildHistory({shape:'ramp',years:3,start:0,end:.4}),[0,.2,.4]);
 assert.deepEqual(buildHistory({shape:'flat',years:2,start:.3}),[.3,.3]);
 const f=buildHistory({shape:'rebuild',years:7,start:.1,peak:.7,end:.1,turn:4});
 assert.equal(f.length,7);assert.equal(f[0],.1);assert.equal(f[3],.7);assert.equal(f[6],.1);
 assert.deepEqual(buildHistory({shape:'ramp',years:1,start:.2}),[.2]);
 assert.throws(()=>buildHistory({years:151}));assert.throws(()=>buildHistory({start:-.1}));
});
test('history importer accepts exported history, F columns and year/F pairs',()=>{
 assert.deepEqual(parseCSV('F\n0.1\n0.2'),[.1,.2]);
 assert.deepEqual(parseCSV('1,0.1\n2,0.2'),[.1,.2]);
 assert.deepEqual(parseCSV('"model_version","historical_fishing_year","prescribed_F_per_year","note"\r\n"1.2.0","1","0.15","comma, in note"\r\n"1.2.0","2","0.35",""'),[.15,.35]);
 assert.deepEqual(parseCSV('year;F\n1;0\n2;0.5'),[0,.5]);
 assert.throws(()=>parseCSV('F\n-1'));assert.throws(()=>parseCSV('F\n'));assert.throws(()=>parseCSV('year,catch\n1,100'));assert.throws(()=>parseCSV('F\n"0.3'));
});
