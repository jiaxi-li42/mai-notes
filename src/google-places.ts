/// <reference types="google.maps" />
import type {Photo} from './types.ts';

const requests = new Map<string, Promise<Photo[]>>();

export function googlePhotos(library: google.maps.PlacesLibrary, id: string, name: string, refresh = false) {
  if(refresh)requests.delete(id);
  let request = requests.get(id);
  if (!request) {
    request = (async () => {
      const place = new library.Place({id, requestedLanguage: 'en', requestedRegion: 'TH'});
      await place.fetchFields({fields: ['photos']});
      return (place.photos || []).slice(0, 3).map(photo => ({
        src: photo.getURI({maxWidth: 800, maxHeight: 500}), alt: `${name} — photo from Google Maps`,
      }));
    })();
    requests.set(id, request);
    request.catch(() => requests.delete(id));
  }
  return request;
}
