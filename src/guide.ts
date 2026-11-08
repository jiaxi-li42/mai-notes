import type { Category, Place } from './types.ts';
import areaGroups from '../content/areas.json' with {type:'json'};

export const categories: Category[] = ['Eat','Drink','Shop','Do'];
export {areaGroups};
export const areas = areaGroups.map(group=>group.name);
export function areaFor(place: Pick<Place,'slug'|'area'>) {
  return (areaGroups.find(group=>group.slugs.includes(place.slug)) ||
    areaGroups.find(group=>group.areas.includes(place.area)))?.name || '';
}
export function normalizeArea(value: string) {
  return areaGroups.find(group=>group.name===value||group.areas.includes(value))?.name || '';
}
export function cleanQuery(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').trim();
}
export function filterPlaces(places: Place[], filters: {category: Category | ''; area: string; query: string}) {
  const query = cleanQuery(filters.query);
  const area = normalizeArea(filters.area);
  return places.filter(place =>
    (!filters.category || filters.category === place.category) &&
    (!area || area === areaFor(place)) &&
    (!query || cleanQuery(`${place.name} ${place.area} ${areaFor(place)} ${place.description}`).includes(query))
  );
}
export function setQuery(params: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value); else next.delete(key);
  return next;
}

export function readCategory(params: URLSearchParams): Category | '' {
  // Older shared URLs may contain several categories; keep the first valid choice.
  return (params.get('category')||'').split(',').find((value): value is Category=>categories.includes(value as Category)) || '';
}
export function setCategory(params: URLSearchParams, category: string) {
  return setQuery(params,'category',categories.includes(category as Category)?category:'');
}
export function queryForPlace(params: URLSearchParams, place: Place) {
  const category=readCategory(params);
  let next=setCategory(params,category===place.category?category:'');
  const area=normalizeArea(next.get('area')||'');
  if(area&&area!==areaFor(place))next=setQuery(next,'area','');
  if(!filterPlaces([place],{category:'',area:'',query:next.get('q')||''}).length)next=setQuery(next,'q','');
  return next;
}
