export type MapStyle = 'Light' | 'Dark' | 'Satellite';
export const mapStyles: MapStyle[] = ['Light', 'Dark', 'Satellite'];
export const chiangMaiCenter = {lat: 18.7883, lng: 98.9853};
export type MapSelectionSource = 'list' | 'marker' | 'route';

export function centerOnUserLocation(map: Pick<google.maps.Map,'getZoom'|'setZoom'|'panTo'>, position: {lat: number; lng: number}) {
  if((map.getZoom()??0)<15)map.setZoom(15);
  map.panTo(position);
}

export function selectionZoom(desktop: boolean, source: MapSelectionSource, hasSelected: boolean) {
  if (hasSelected) return undefined;
  if (source === 'route') return desktop ? undefined : 15;
  return desktop || source === 'list' ? 15 : undefined;
}

export function mapsConfig(env: Record<string, string | undefined>) {
  const apiKey = env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const mapId = env.VITE_GOOGLE_MAPS_MAP_ID?.trim();
  return apiKey && mapId ? {apiKey, mapId} : null;
}

// Leave room for the source's 380px popup and 22px edge inset in actual pixels.
export function detailPanOffset(width: number) {
  return Math.max(0, 374 - width / 2);
}

export function mapStyleOptions(style: MapStyle, scheme: 'LIGHT' | 'DARK') {
  return {mapTypeId: style === 'Satellite' ? 'satellite' : 'roadmap',
    colorScheme: style === 'Satellite' ? scheme : style === 'Dark' ? 'DARK' : 'LIGHT'};
}
