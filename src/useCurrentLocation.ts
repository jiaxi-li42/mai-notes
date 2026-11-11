import {useEffect, useRef, useState} from 'react';

export interface UserPosition {lat: number; lng: number}
export const locationMessages = {
  denied: 'Location access was denied. Enable location in your browser settings to show your position.',
  timeout: 'Finding your location took too long. Please try again.',
  unavailable: "Your location couldn't be found. Check your device's location settings and try again.",
  unsupported: "This browser doesn't support location. You can still browse all places.",
  insecure: 'Location requires a secure connection. Open this guide using HTTPS.'
};
type LocationError = keyof typeof locationMessages;
interface LocationResult {position?: UserPosition; error?: LocationError}

export function requestCurrentLocation(): Promise<LocationResult> {
  return new Promise(resolve=>{
    if(!globalThis.isSecureContext){resolve({error:'insecure'});return;}
    if(typeof navigator==='undefined'||!navigator.geolocation){resolve({error:'unsupported'});return;}
    try {
      navigator.geolocation.getCurrentPosition(({coords})=>{
        const {latitude:lat,longitude:lng}=coords;
        if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){
          resolve({error:'unavailable'});return;
        }
        resolve({position:{lat,lng}});
      },error=>resolve({error:error.code===1?'denied':error.code===3?'timeout':'unavailable'}),
      {timeout:10_000,maximumAge:60_000,enableHighAccuracy:false});
    } catch {
      resolve({error:'unavailable'});
    }
  });
}

export function useCurrentLocation(enabled: boolean) {
  const [result,setResult]=useState<LocationResult>({});
  const [attempt,setAttempt]=useState(0);
  const request=useRef<{attempt: number; result: Promise<LocationResult>} | null>(null);
  useEffect(()=>{
    if(!enabled)return;
    // Reuse the request during StrictMode effect replay; map/layout changes do not retry it.
    if(request.current?.attempt!==attempt)request.current={attempt,result:requestCurrentLocation()};
    let cancelled=false;
    request.current.result.then(value=>{if(!cancelled)setResult(value);});
    return()=>{cancelled=true;};
  },[enabled,attempt]);
  return {...result,
    retry:()=>{setResult({});setAttempt(value=>value+1);},
    dismissError:()=>setResult(value=>({...value,error:undefined}))};
}
