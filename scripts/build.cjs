'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const model = read('model.js');
const app = read('app.js');
const template = read('page.html');
for (const placeholder of ['/*__MODEL__*/', '/*__APP__*/']) {
  if (template.split(placeholder).length !== 2) throw Error('Expected one ' + placeholder);
}
const html = template.replace('/*__MODEL__*/', () => model).replace('/*__APP__*/', () => app);
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '');
console.log('Built index.html (offline GUI) and dist/index.html (GitHub Pages).');
