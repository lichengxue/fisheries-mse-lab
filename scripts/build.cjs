'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const model = read('model.js');
const app = read('app.js');
const ui = read('ui.js');
const uiHelpers = read('ui-helpers.js');
const uiCSS = read('ui.css');
const economics = read('economics.js');
const workshop = read('workshop.js');
const workshopCSS = read('workshop.css');
const clarity = read('clarity.js');
const clarityCSS = read('clarity.css');
const visuals = read('visuals.js');
const readabilityCSS = read('readability.css');
const template = read('page.html');
const assessmentUI = fs.existsSync(path.join(root,'src','assessment-ui.js')) ? read('assessment-ui.js') : '';
const assessmentCSS = fs.existsSync(path.join(root,'src','assessment.css')) ? read('assessment.css') : '';
const tradeoffCore = fs.existsSync(path.join(root,'src','tradeoffs.js')) ? read('tradeoffs.js') : '';
const tradeoffUI = fs.existsSync(path.join(root,'src','tradeoff-ui.js')) ? read('tradeoff-ui.js') : '';
const tradeoffCSS = fs.existsSync(path.join(root,'src','tradeoff.css')) ? read('tradeoff.css') : '';
// Keep the previous template buildable while interface files are updated.
const required = ['/*__MODEL__*/', '/*__APP__*/'];
if (template.includes('id="tab-stock"')) required.push('/*__UI__*/', '/*__UI_HELPERS__*/', '/*__UI_CSS__*/');
if (template.includes('id="tab-people"')) required.push('/*__ECONOMICS__*/', '/*__WORKSHOP__*/', '/*__WORKSHOP_CSS__*/');
if (template.includes('/*__CLARITY__*/')) required.push('/*__CLARITY__*/', '/*__CLARITY_CSS__*/');
if (template.includes('/*__VISUALS__*/')) required.push('/*__VISUALS__*/', '/*__READABILITY_CSS__*/');
if (template.includes('id="tab-assessment"')) {
  required.push('/*__ASSESSMENT_UI__*/','/*__ASSESSMENT_CSS__*/');
  if (!assessmentUI || !assessmentCSS) throw Error('Assessment interface files are required.');
}
if (template.includes('id="radar-chart"')) {
  required.push('/*__TRADEOFF_CORE__*/','/*__TRADEOFF_UI__*/','/*__TRADEOFF_CSS__*/');
  if (!tradeoffCore || !tradeoffUI || !tradeoffCSS) throw Error('Trade-off interface files are required.');
}
for (const placeholder of required) {
  if (template.split(placeholder).length !== 2) throw Error('Expected one ' + placeholder);
}
const html = template.replace('/*__MODEL__*/', () => model).replace('/*__APP__*/', () => app).replace('/*__UI__*/', () => ui).replace('/*__UI_HELPERS__*/', () => uiHelpers).replace('/*__UI_CSS__*/', () => uiCSS).replace('/*__ECONOMICS__*/',()=>economics).replace('/*__WORKSHOP__*/',()=>workshop).replace('/*__WORKSHOP_CSS__*/',()=>workshopCSS).replace('/*__CLARITY__*/',()=>clarity).replace('/*__CLARITY_CSS__*/',()=>clarityCSS).replace('/*__VISUALS__*/',()=>visuals).replace('/*__READABILITY_CSS__*/',()=>readabilityCSS).replace('/*__ASSESSMENT_UI__*/',()=>assessmentUI).replace('/*__ASSESSMENT_CSS__*/',()=>assessmentCSS).replace('/*__TRADEOFF_CORE__*/',()=>tradeoffCore).replace('/*__TRADEOFF_UI__*/',()=>tradeoffUI).replace('/*__TRADEOFF_CSS__*/',()=>tradeoffCSS);
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '');
console.log('Built index.html (offline GUI) and dist/index.html (GitHub Pages).');
