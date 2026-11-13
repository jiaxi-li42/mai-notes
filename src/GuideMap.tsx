import {useCallback, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {APILoadingStatus, AdvancedMarker, CollisionBehavior, InfoWindow, Map as GoogleMap,
  useAdvancedMarkerRef, useApiLoadingStatus, useMap} from '@vis.gl/react-google-maps';
import type {MapCameraChangedEvent} from '@vis.gl/react-google-maps';
import type {Place} from './types.ts';
import {Icon} from './Icon.tsx';
import {centerOnUserLocation, chiangMaiCenter, detailPanOffset, mapStyleOptions, mapStyles, selectionZoom} from './maps.ts';
import type {MapSelectionSource, MapStyle} from './maps.ts';
import type {UserPosition} from './useCurrentLocation.ts';

let diagnosticInstance = 0;

interface Props {
  config: {apiKey: string; mapId: string}; places: Place[]; activePlaces: Place[]; selected?: Place;
  userPosition?: UserPosition;
  selectionSource: MapSelectionSource;
  desktop: boolean; visible: boolean; detail: ReactNode;
  onSelect: (place: Place, trigger?: HTMLElement) => void;
  onClose: () => void; onReady: (ready: boolean) => void;
}

function CurrentLocationMarker({position}: {position: UserPosition}) {
  const map=useMap();
  return <AdvancedMarker position={position} title="Your location. Click to center the map."
    className="user-location-marker" anchorLeft="-50%" anchorTop="-50%" zIndex={2} clickable
    collisionBehavior={CollisionBehavior.REQUIRED} onClick={()=>{if(map)centerOnUserLocation(map,position);}}>
    <span aria-hidden="true"/>
  </AdvancedMarker>;
}

function PlaceMarker({place, index, selected, inactive, desktop, detail, onSelect, onClose}: {
  place: Place; index: number; selected: boolean; inactive: boolean; desktop: boolean; detail: ReactNode;
  onSelect: Props['onSelect']; onClose: Props['onClose'];
}) {
  const [ref, marker] = useAdvancedMarkerRef();
  return <>
    <AdvancedMarker ref={ref} position={{lat:place.lat,lng:place.lng}} title={`${index}. ${place.name}`}
      className={`map-marker ${inactive?'is-inactive':''} ${selected?'is-selected':''}`} anchorLeft="-50%" anchorTop="-50%"
      zIndex={selected?1:0} clickable
      collisionBehavior={CollisionBehavior.REQUIRED}
      onClick={event=>onSelect(place,event.target instanceof HTMLElement?event.target:undefined)}>
      <span aria-hidden="true">{index}</span>
    </AdvancedMarker>
    {selected&&desktop&&detail&&<InfoWindow anchor={marker} pixelOffset={[10,23]} headerDisabled disableAutoPan
      shouldFocus={false} onCloseClick={onClose} className="map-popup">{detail}</InfoWindow>}
  </>;
}

function Camera({selected, selectionSource, desktop, visible, onReady}: Pick<Props,'selected'|'selectionSource'|'desktop'|'visible'|'onReady'>) {
  const map=useMap();
  const lastSelection=useRef<string | null>(null);
  const hasSelected=useRef(false);
  const previousLayout=useRef({desktop,visible});
  const pendingAlignment=useRef<{remove:()=>void} | null>(null);
  const alignSelection=useCallback(()=>{
    pendingAlignment.current?.remove();
    pendingAlignment.current=null;
    if(!map||!selected)return;
    const center={lat:selected.lat,lng:selected.lng};
    if(!desktop){map.panTo(center);return;}
    const projection=map.getProjection();
    if(!projection){pendingAlignment.current=map.addListener('projection_changed',alignSelection);return;}
    const rect=map.getDiv().getBoundingClientRect();
    const point=projection.fromLatLngToPoint(center);
    // One pan target keeps an asynchronous panTo from overwriting the popup offset.
    if(point)point.x+=detailPanOffset(rect.width)/2**(map.getZoom()??15);
    map.panTo(point?projection.fromPointToLatLng(point)||center:center);
  },[map,selected,desktop]);
  useEffect(()=>()=>{pendingAlignment.current?.remove();},[alignSelection]);
  useEffect(()=>{
    // Development-only label lets browser checks verify map reuse across layouts.
    if(import.meta.env.DEV&&map)map.getDiv().dataset.guideMapInstance=String(++diagnosticInstance);
  },[map]);
  useEffect(()=>{onReady(Boolean(map));return()=>onReady(false);},[map,onReady]);
  useEffect(()=>{
    if(map&&visible)map.moveCamera({center:map.getCenter(),zoom:map.getZoom()});
  },[map,visible]);
  useEffect(()=>{
    const layoutChanged=desktop!==previousLayout.current.desktop;
    const becameVisible=visible&&!previousLayout.current.visible;
    previousLayout.current={desktop,visible};
    if(!selected){lastSelection.current=null;return;}
    if(!map||!visible)return;
    if(lastSelection.current!==selected.slug){
      const zoom=selectionZoom(desktop,selectionSource,hasSelected.current);
      if(zoom!==undefined)map.setZoom(zoom);
      alignSelection();
      lastSelection.current=selected.slug;
      hasSelected.current=true;
    }else if(layoutChanged||becameVisible)alignSelection();
  },[map,selected,selectionSource,desktop,visible,alignSelection]);
  useEffect(()=>{
    if(!map||!selected||!visible)return;
    // On mobile, viewport changes matter; map expansion must not trigger a second pan.
    const container=desktop?map.getDiv():map.getDiv().closest('.guide')||map.getDiv();
    const initial=container.getBoundingClientRect();
    let previousWidth=initial.width,previousHeight=initial.height;
    let timer: number | undefined;
    const observer=new ResizeObserver(([entry])=>{
      const {width,height}=entry.contentRect;
      if(!width||!height||Math.abs(width-previousWidth)<.5&&Math.abs(height-previousHeight)<.5)return;
      previousWidth=width;previousHeight=height;
      window.clearTimeout(timer);
      timer=window.setTimeout(alignSelection,120);
    });
    observer.observe(container);
    return()=>{observer.disconnect();window.clearTimeout(timer);};
  },[map,selected,desktop,visible,alignSelection]);
  return null;
}

function MapRuntime(props: Props) {
  const {config,places,activePlaces,selected,userPosition,selectionSource,desktop,visible,detail,onSelect,onClose,onReady}=props;
  const status=useApiLoadingStatus();
  const [style,setStyle]=useState<MapStyle>('Satellite');
  const [scheme,setScheme]=useState<'LIGHT'|'DARK'>('LIGHT');
  const [menu,setMenu]=useState(false), [tilesLoaded,setTilesLoaded]=useState(false);
  const menuTrigger=useRef<HTMLButtonElement>(null);
  const camera=useRef({center:places.length?{lat:places[0].lat,lng:places[0].lng}:chiangMaiCenter,zoom:desktop?13:15,heading:0,tilt:0});
  const options=mapStyleOptions(style,scheme);
  const loaded=status===APILoadingStatus.LOADED;
  const failed=status===APILoadingStatus.FAILED||status===APILoadingStatus.AUTH_FAILURE;
  const changeStyle=(next: MapStyle)=>{
    if(next!=='Satellite')setScheme(next==='Dark'?'DARK':'LIGHT');
    setStyle(next);setMenu(false);
    if(document.activeElement?.closest('#map-style-options'))menuTrigger.current?.focus();
  };
  const trackCamera=(event: MapCameraChangedEvent)=>{
    const {center,zoom,heading,tilt}=event.detail;
    camera.current={center,zoom,heading,tilt};
  };
  return <div className="live-map" onKeyDownCapture={event=>{
    if(event.key!=='Escape')return;
    if(menu){event.preventDefault();event.stopPropagation();setMenu(false);menuTrigger.current?.focus();}
    else if(selected){event.preventDefault();event.stopPropagation();onClose();}
  }}>
    {loaded&&<GoogleMap mapId={config.mapId} defaultCenter={camera.current.center} defaultZoom={camera.current.zoom}
      defaultHeading={camera.current.heading} defaultTilt={camera.current.tilt} {...options}
      disableDefaultUI clickableIcons={false} gestureHandling="greedy" keyboardShortcuts
      onCameraChanged={trackCamera} onTilesLoaded={()=>setTilesLoaded(true)} onClick={()=>{setMenu(false);if(selected)onClose();}}>
      {places.map((place,index)=><PlaceMarker key={place.slug} place={place} index={index+1}
        selected={place.slug===selected?.slug} inactive={!activePlaces.includes(place)} desktop={desktop} detail={detail} onSelect={onSelect} onClose={onClose}/>)}
      {userPosition&&<CurrentLocationMarker position={userPosition}/>}
    </GoogleMap>}
    {/* Keep selection history when a map style change replaces the SDK instance. */}
    <Camera selected={selected} selectionSource={selectionSource} desktop={desktop} visible={visible} onReady={onReady}/>
    {(!loaded||!tilesLoaded)&&<div className={`map-unavailable map-loading ${failed?'map-failed':''}`} role="status">
      <span>{failed?"Google Maps isn't available":'Loading Google Maps…'}</span>
      <span className="map-external">{selected?<a href={selected.googleMapsUrl} target="_blank" rel="noreferrer">Open this place in Google Maps ↗</a>:<span>You can keep browsing the place list.</span>}</span>
    </div>}
    {loaded&&<div className="map-style-controls" aria-label="Map style">
      <div className="map-style-pills">{mapStyles.map(value=><button type="button" key={value} aria-pressed={style===value} onClick={()=>changeStyle(value)}>{value}</button>)}</div>
      <div className="map-style-dropdown"><button ref={menuTrigger} type="button" aria-expanded={menu} aria-controls="map-style-options" onClick={()=>setMenu(!menu)}>{style}<Icon name="keyboard_arrow_down"/></button>
        <div id="map-style-options" className={menu?'is-open':''} inert={!menu} aria-hidden={!menu}>{mapStyles.map(value=><button type="button" key={value} aria-pressed={style===value} onClick={()=>changeStyle(value)}>{value}</button>)}</div>
      </div>
    </div>}
  </div>;
}

export default function GuideMap(props: Props) {
  return <MapRuntime {...props}/>;
}
