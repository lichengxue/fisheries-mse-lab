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
const template = read('page.html');
// Keep the previous template buildable while interface files are updated.
const required = ['/*__MODEL__*/', '/*__APP__*/'];
if (template.includes('id="tab-stock"')) required.push('/*__UI__*/', '/*__UI_HELPERS__*/', '/*__UI_CSS__*/');
for (const placeholder of required) {
  if (template.split(placeholder).length !== 2) throw Error('Expected one ' + placeholder);
}
const html = template.replace('/*__MODEL__*/', () => model).replace('/*__APP__*/', () => app).replace('/*__UI__*/', () => ui).replace('/*__UI_HELPERS__*/', () => uiHelpers).replace('/*__UI_CSS__*/', () => uiCSS);
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '');
console.log('Built index.html (offline GUI) and dist/index.html (GitHub Pages).');
