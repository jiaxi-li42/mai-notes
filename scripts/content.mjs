import assert from 'node:assert/strict';

export const categories = ['Eat', 'Drink', 'Shop', 'Do'];
const statuses = ['Published', 'Draft', 'Temporarily unavailable', 'Archived'];
const text = (value, field) => assert(typeof value === 'string' && value.trim(), `${field} is required`);
export function webUrl(value, field) {
  text(value, field);
  const url = new URL(value);
  assert(['http:', 'https:'].includes(url.protocol), `${field} must be an HTTP(S) URL`);
  assert(!url.username && !url.password, `${field} must not include credentials`);
  return value;
}
export function validatePlaces(places) {
  assert(Array.isArray(places), 'places must be an array');
  const seen = new Set();
  for (const place of places) {
    assert(place && typeof place === 'object', 'each place must be an object');
    assert(typeof place.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(place.slug), 'invalid slug');
    assert(!seen.has(place.slug), `duplicate slug: ${place.slug}`);
    seen.add(place.slug);
    assert(statuses.includes(place.status), `${place.slug}: invalid status`);
    if (place.status !== 'Published') continue;
    for (const field of ['id', 'name', 'area', 'address', 'description']) text(place[field], `${place.slug}.${field}`);
    for (const field of ['hours', 'priceNote', 'goodToKnow']) {
      assert(place[field] == null || typeof place[field] === 'string', `${place.slug}.${field} must be text`);
    }
    if (place.googlePlaceId != null) assert(typeof place.googlePlaceId === 'string' && /^[A-Za-z0-9_-]+$/.test(place.googlePlaceId), `${place.slug}: invalid Google Place ID`);
    assert(place.hoursSource == null || place.hoursSource === 'Google Maps', `${place.slug}: invalid hours source`);
    assert(place.googleBusinessStatus == null || ['OPERATIONAL','CLOSED_TEMPORARILY','CLOSED_PERMANENTLY'].includes(place.googleBusinessStatus), `${place.slug}: invalid Google business status`);
    assert(categories.includes(place.category), `${place.slug}: invalid category`);
    assert(Number.isFinite(place.lat) && Math.abs(place.lat) <= 90, `${place.slug}: invalid latitude`);
    assert(Number.isFinite(place.lng) && Math.abs(place.lng) <= 180, `${place.slug}: invalid longitude`);
    assert(typeof place.lastChecked === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(place.lastChecked) && new Date(place.lastChecked).toISOString().slice(0, 10) === place.lastChecked, `${place.slug}: invalid checked date`);
    webUrl(place.googleMapsUrl, `${place.slug}.googleMapsUrl`);
    if (place.websiteUrl) webUrl(place.websiteUrl, `${place.slug}.websiteUrl`);
    assert(Array.isArray(place.sources) && place.sources.length, `${place.slug}: sources required`);
    for (const source of place.sources) { text(source.title, 'source title'); webUrl(source.url, 'source URL'); }
    assert(Array.isArray(place.photos), `${place.slug}: photos must be an array`);
    for (const photo of place.photos) {
      text(photo.alt, `${place.slug}: photo alt`);
      text(photo.src, `${place.slug}: photo src`);
      for (const field of ['credit', 'license', 'changes']) {
        assert(photo[field] == null || typeof photo[field] === 'string', `${place.slug}: photo ${field} must be text`);
      }
      if (photo.src.startsWith('/images/')) {
        assert(!decodeURIComponent(photo.src).split('/').includes('..') && !photo.src.includes('\\'), 'invalid local photo path');
      } else webUrl(photo.src, 'photo src');
      if (photo.sourceUrl) webUrl(photo.sourceUrl, 'photo source URL');
      if (photo.licenseUrl) webUrl(photo.licenseUrl, 'photo license URL');
    }
  }
}

export function publicPlaces(places) {
  validatePlaces(places);
  return places.filter(p => p.status === 'Published').map(p => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, area: p.area,
    address: p.address, lat: p.lat, lng: p.lng, description: p.description,
    googleMapsUrl: p.googleMapsUrl, websiteUrl: p.websiteUrl || '',
    photos: p.photos.map(({src, alt, credit, sourceUrl, license, licenseUrl, changes}) => ({src, alt, credit, sourceUrl, license, licenseUrl, changes})),
    ...(p.hours ? {hours: p.hours} : {}), ...(p.priceNote ? {priceNote: p.priceNote} : {}),
    ...(p.googlePlaceId ? {googlePlaceId: p.googlePlaceId} : {}),
    ...(p.googleBusinessStatus ? {googleBusinessStatus: p.googleBusinessStatus} : {}),
    ...(p.goodToKnow ? {goodToKnow: p.goodToKnow} : {}),
  }));
}
