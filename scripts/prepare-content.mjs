import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { categories, publicPlaces } from './content.mjs';
import {areaGroups, areaFor} from '../src/guide.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const places = JSON.parse(await readFile(resolve(root, 'content/places.json'), 'utf8'));
const site = JSON.parse(await readFile(resolve(root, 'content/site.json'), 'utf8'));
assert(typeof site.name === 'string' && site.name.trim(), 'site name required');
for (const field of ['shortName', 'city', 'description', 'contactEmail']) {
  assert(site[field] == null || typeof site[field] === 'string', `site.${field} must be text`);
}
assert.deepEqual(site.categories, categories, 'site categories must be Eat / Drink / Shop / Do');
const published = publicPlaces(places);
for (const key of ['name', 'areas', 'slugs']) {
  const values=areaGroups.flatMap(group=>group[key]);
  assert(values.every(value=>typeof value==='string'&&value.trim()), `invalid area group ${key}`);
  assert(new Set(values).size===values.length, `duplicate area group ${key}`);
}
for (const group of areaGroups) for (const slug of group.slugs)
  assert(places.some(place=>place.slug===slug), `area override must name an existing place: ${slug}`);
for (const place of published) assert(areaFor(place), `${place.slug}: assign its area in content/areas.json`);
for (const place of published) for (const photo of place.photos) {
  if (photo.src.startsWith('/images/')) await access(resolve(root, 'public', `.${photo.src}`));
}
await mkdir(resolve(root, 'src/generated'), {recursive: true});
await writeFile(resolve(root, 'src/generated/places.json'), JSON.stringify(published, null, 2));
await writeFile(resolve(root, 'src/generated/site.json'), JSON.stringify({
  name: site.name, shortName: site.shortName || site.name, city: site.city || 'Chiang Mai',
  description: site.description || '', categories,
  contactEmail: typeof site.contactEmail === 'string' ? site.contactEmail : '',
}, null, 2));
console.log(`Content checked: ${published.length} published, ${places.length - published.length} unpublished.`);
