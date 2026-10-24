(function(root){
'use strict';
const validate=values=>{if(values.length<1||values.length>150||values.some(v=>!Number.isFinite(v)||v<0||v>3))throw Error('Use 1–150 annual F values between 0 and 3 / year.');return values;};
function buildHistory({shape='ramp',years=30,start=.02,peak=.65,end=.45,turn=20}){
 years=Number(years);start=Number(start);peak=Number(peak);end=Number(end);turn=Number(turn);
 if(!Number.isInteger(years)||years<1||years>150)throw Error('Choose 1–150 historical years.');
 validate([start,peak,end]);
 if(!['flat','ramp','rebuild'].includes(shape))throw Error('Choose a history shape.');
 turn=Math.max(2,Math.min(years-1,Math.round(turn)||2));
 return validate(Array.from({length:years},(_,i)=>{
  let value=start;
  if(shape!=='flat'&&years>1)value=shape==='rebuild'&&years>2?(i<turn?start+(peak-start)*i/(turn-1):peak+(end-peak)*(i-turn+1)/(years-turn)):start+(end-start)*i/(years-1);
  return Math.round(value*1000)/1000;
 }));
}
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c===';'||c==='\t')){row.push(cell.trim());cell='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('The CSV has an unfinished quoted field.');
 row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);
 if(!rows.length)throw Error('The file is empty.');
 const numeric=x=>x!==''&&Number.isFinite(Number(x));
 let column=0,data=rows;
 if(!rows[0].every(numeric)){
  const keys=['f','historicalf','prescribedfperyear','fperyear','fishingmortality'];
  column=rows[0].findIndex(x=>keys.includes(x.toLowerCase().replace(/[^a-z0-9]/g,'')));
  if(column<0)throw Error('Use a column named F or prescribed_F_per_year, or a file with one F value per row.');
  data=rows.slice(1);
 }else if(rows[0].length===2)column=1;
 else if(rows[0].length!==1)throw Error('Use one F column, or two columns containing year and F.');
 if(data.some(r=>!numeric(r[column]??'')))throw Error('Each row must contain a numeric F value.');
 return validate(data.map(r=>Number(r[column])));
}
const api={buildHistory,parseCSV};root.MSEInterface=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
