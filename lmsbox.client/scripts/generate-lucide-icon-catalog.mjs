import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const iconsDir = path.join(clientRoot, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const clientOut = path.join(clientRoot, 'src', 'data', 'lucideIconCatalog.json');
const hostOut = path.resolve(clientRoot, '..', 'lmsbox.host', 'Assets', 'icons', 'lucide-icons.json');

const VOID_TAGS = new Set(['path', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect']);

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function iconNodeToInnerHtml(iconNode) {
  return iconNode
    .map(([tag, attrs]) => {
      const attrText = Object.entries(attrs || {})
        .filter(([key]) => key !== 'key')
        .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
        .join(' ');
      if (VOID_TAGS.has(tag)) {
        return attrText ? `<${tag} ${attrText}/>` : `<${tag}/>`;
      }
      return attrText ? `<${tag} ${attrText}></${tag}>` : `<${tag}></${tag}>`;
    })
    .join('');
}

const files = (await readdir(iconsDir)).filter((name) => name.endsWith('.js') && name !== 'index.js');
const catalog = {};

for (const fileName of files) {
  const source = await readFile(path.join(iconsDir, fileName), 'utf8');
  if (!source.includes('const __iconNode =')) continue;

  const match = source.match(/const __iconNode = (\[[\s\S]*?\]);\s*\nconst /);
  if (!match) continue;

  let iconNode;
  try {
    iconNode = Function(`"use strict"; return (${match[1]});`)();
  } catch {
    continue;
  }

  if (!Array.isArray(iconNode) || iconNode.length === 0) continue;
  const iconName = fileName.replace(/\.js$/, '');
  catalog[iconName] = iconNodeToInnerHtml(iconNode);
}

const names = Object.keys(catalog).sort();
const sorted = {};
for (const name of names) {
  sorted[name] = catalog[name];
}

const json = `${JSON.stringify(sorted)}\n`;
await mkdir(path.dirname(clientOut), { recursive: true });
await mkdir(path.dirname(hostOut), { recursive: true });
await writeFile(clientOut, json);
await writeFile(hostOut, json);

const longest = names.reduce((max, name) => (name.length > max.length ? name : max), '');
console.log(`Wrote ${names.length} Lucide icons.`);
console.log(`Longest name: ${longest} (${longest.length} chars)`);
console.log(`Client: ${clientOut}`);
console.log(`Host: ${hostOut}`);
