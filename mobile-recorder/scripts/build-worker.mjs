/* Embed the existing static app in a dependency-free Sites Worker ESM artifact. */
import {readFileSync, writeFileSync, readdirSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'};
const assets = {};
function visit(directory, prefix = '') {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (['server', '.openai'].includes(entry.name)) continue;
    const key = prefix + entry.name, filename = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(filename, key + '/');
    else {
      const type = types[path.extname(entry.name)];
      if (!type) throw new Error('Unexpected browser asset: ' + key);
      assets[key] = {type, body: readFileSync(filename).toString('base64')};
    }
  }
}
visit(dist);
// Any asset edit changes the Worker bytes, so installed clients can detect every release.
const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 12);
const replaceAsset = (name, transform) => { assets[name].body = Buffer.from(transform(Buffer.from(assets[name].body, 'base64').toString('utf8'))).toString('base64'); };
replaceAsset('index.html', text => text.replace('name="recorder-build" content="dev"', 'name="recorder-build" content="' + version + '"'));
replaceAsset('sw.js', text => text.replace(/suilian-shell-v\d+/, 'suilian-shell-' + version));
assets['version.json'].body = Buffer.from(JSON.stringify({version})).toString('base64');
const manifest = JSON.parse(readFileSync(path.join(root, '.openai/hosting.json'), 'utf8'));
if (manifest.static || manifest.r2 !== 'BUCKET') throw new Error('Worker hosting requires r2: BUCKET and no static directory');
mkdirSync(path.join(dist, 'server'), {recursive: true});
mkdirSync(path.join(dist, '.openai'), {recursive: true});
writeFileSync(path.join(dist, '.openai/hosting.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(path.join(dist, 'server/index.js'), 'const RECORDER_ASSETS=' + JSON.stringify(assets) + ';\n' + readFileSync(path.join(dist, 'core.js'), 'utf8') + '\n' + readFileSync(path.join(root, 'worker/handler.mjs'), 'utf8'));
console.log('Built recorder Worker with ' + Object.keys(assets).length + ' browser assets. No recommendation or draft data bundled.');
