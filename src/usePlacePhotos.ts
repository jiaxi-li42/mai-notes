import {useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import type {Photo, Place} from './types.ts';
import {googlePhotos} from './google-places.ts';

export function usePlacePhotos(place: Place) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<{id: string; photos: Photo[]} | null>(null);
  const [attempt,setAttempt]=useState(0);
  const [error,setError]=useState(false),[loading,setLoading]=useState(false);
  const library = useMapsLibrary('places');
  useEffect(() => {
    if (!place.googlePlaceId || !ref.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {setVisible(true); observer.disconnect();}
    }, {rootMargin: '200px'});
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [place.googlePlaceId]);
  useEffect(() => {
    const id=place.googlePlaceId;
    if (!visible || !library || !id) return;
    let cancelled = false;
    setLoading(true);setError(false);
    googlePhotos(library, id, place.name, attempt>0).then(photos => {
      if (!cancelled) {setResult({id,photos});setLoading(false);}
    }).catch(() => {if (!cancelled) {setResult({id,photos:[]});setError(true);setLoading(false);}});
    return () => {cancelled = true;};
  }, [visible, library, place.googlePlaceId, place.name, attempt]);
  const current=result?.id===place.googlePlaceId?result:null;
  return {ref, photos: current?.photos.length ? current.photos : place.photos,error,loading,
    retry:()=>{setResult(null);setError(false);setLoading(true);setAttempt(value=>value+1);}};
}
