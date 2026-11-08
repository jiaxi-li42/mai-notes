import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import useEmblaCarousel from 'embla-carousel-react';
import records from './generated/places.json';
import site from './generated/site.json';
import type { Category, Place } from './types.ts';
import { areas, categories, filterPlaces, normalizeArea, queryForPlace, readCategory, setCategory, setQuery } from './guide.ts';
import { mapsConfig } from './maps.ts';
import {usePlacePhotos} from './usePlacePhotos.ts';
import {formatHours} from './hours.ts';
import {Icon} from './Icon.tsx';

const places = records as Place[];
const GuideMap = lazy(() => import('./GuideMap.tsx'));
const mapConfig = mapsConfig(import.meta.env);

class MapBoundary extends React.Component<{children: React.ReactNode; fallback: React.ReactNode; onError: () => void}, {failed: boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onError();}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function Wordmark({small = false}: {small?: boolean}) {
  return <span className={`wordmark ${small ? 'wordmark-small' : ''}`} aria-label={site.name}>
    <span>Mai</span><span>Notes<span className="wordmark-check" aria-hidden="true">✔</span></span>
  </span>;
}

function Categories({selected, onChange}: {selected: Category | ''; onChange: (category: string) => void}) {
  return <nav className="categories" aria-label="Place categories">
    {['All', ...categories].map((category, index, all) => <React.Fragment key={category}>
      <button type="button" aria-pressed={category === 'All' ? !selected : selected === category}
        onClick={() => onChange(category)}>
        {category}{(category === 'All' ? !selected : selected === category)&&<span className="check" aria-hidden="true">✔</span>}
      </button>{index !== all.length - 1 && <span aria-hidden="true">,</span>}
    </React.Fragment>)}
  </nav>;
}

function Filters({query, area, change, count, reset}: {query: string; area: string; change: (key: string, value: string) => void; count: number; reset: () => void}) {
  return <form className="filters" role="search" onSubmit={event => event.preventDefault()}>
    <label className="search-field"><span>Search</span><input aria-label="Search places" type="search" value={query} onChange={e => change('q', e.target.value)} placeholder="Name or place" /></label>
    <label><span>Area</span><div className="area-select"><select aria-label="Area" value={area} onChange={e => change('area', e.target.value)}><option value="">All areas</option>{areas.map(value => <option key={value}>{value}</option>)}</select><Icon name="keyboard_arrow_down"/></div></label>
    <div className="filter-status"><output className="sr-only" aria-live="polite">{count} {count === 1 ? 'place' : 'places'}</output><button type="button" onClick={reset}>Reset</button></div>
  </form>;
}

function AboutCopy({onOpen}: {onOpen: () => void}) {
  return <section className="about-copy"><p>{site.description}</p><p><button type="button" className="text-link" onClick={onOpen}>About {site.shortName} ↗</button></p></section>;
}

function PhotoStrip({place, href, onOpen}: {place: Place; href?: string; onOpen?: (trigger: HTMLAnchorElement) => void}) {
  const loaded = usePlacePhotos(place);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const photos = loaded.photos.filter(photo => !failed.includes(photo.src));
  const [viewport, carousel] = useEmblaCarousel({loop:true});
  useEffect(() => {
    if (!carousel) return;
    const sync = () => setActive(carousel.selectedScrollSnap());
    sync(); carousel.on('select',sync); carousel.on('reInit',sync);
    return () => {carousel.off('select',sync);carousel.off('reInit',sync);};
  }, [carousel]);
  const canRetry=Boolean(place.googlePlaceId&&(loaded.error||failed.length));
  if (!photos.length) return <div ref={loaded.ref} className="photo-empty" role={canRetry?'group':'img'} aria-label={`No photograph available for ${place.name}`}><span>{place.category}</span><span className="empty-photo-name">{place.name}</span>{canRetry&&<button type="button" className="photo-retry" disabled={loaded.loading} onClick={()=>{setFailed([]);loaded.retry();}}>Retry photos</button>}<span>Chiang Mai</span></div>;
  return <div ref={loaded.ref} className="photo-strip" role="region" aria-label={`Photos of ${place.name}`} onKeyDown={event => {
    if(event.key==='ArrowRight'){event.preventDefault();carousel?.scrollNext(window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
    if(event.key==='ArrowLeft'){event.preventDefault();carousel?.scrollPrev(window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
  }}>
    <div className="photo-carousel"><div className="photo-track" ref={viewport}><div className="photo-slides">
      {photos.map((photo,i) => <figure key={photo.src} aria-hidden={i!==active}>{href ? <Link to={href} state={{mapSelectionSource:'list'}} onClick={event=>onOpen?.(event.currentTarget)} tabIndex={i===active?0:-1}><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" width="800" height="500" onError={() => setFailed(old => [...old, photo.src])}/></Link> : <img src={photo.src} alt={photo.alt} loading="eager" decoding="async" width="800" height="500" onError={() => setFailed(old => [...old, photo.src])}/>}</figure>)}
    </div></div>
    {photos.length > 1 && <div className="photo-controls" aria-label={`Photos of ${place.name}`}>{photos.map((photo, i) => <button type="button" key={photo.src} aria-label={`Photo ${i + 1} of ${photos.length}`} aria-pressed={i === active} onClick={() => carousel?.scrollTo(i,window.matchMedia('(prefers-reduced-motion: reduce)').matches)}/>)}</div>}
    </div>
  </div>;
}

function PlaceFacts({place, showEmptyHours = false}: {place: Place; showEmptyHours?: boolean}) {
  const closure=place.googleBusinessStatus==='CLOSED_PERMANENTLY'?'Reported permanently closed':place.googleBusinessStatus==='CLOSED_TEMPORARILY'?'Reported temporarily closed':'';
  return <div className="place-facts">
    <div className="fact-address"><h3>Address</h3><p>{place.address}</p></div>
    {place.priceNote && <div className="fact-address"><h3>Price</h3><p>{place.priceNote}</p></div>}
    {(place.hours || closure || showEmptyHours) && <div className="fact-hours"><h3>Hours</h3><p>{closure || formatHours(place.hours || '') || 'Not available'}</p></div>}
    <div className="fact-links"><h3>Links</h3><a href={place.googleMapsUrl} target="_blank" rel="noreferrer">↗ Google Maps</a>{place.websiteUrl && <a href={place.websiteUrl} target="_blank" rel="noreferrer">↗ Website</a>}</div>
    {place.goodToKnow && <div className="fact-address"><h3>Good to know</h3><p>{place.goodToKnow}</p></div>}
  </div>;
}

function PlaceCard({place, index, selected, query, onSelect}: {place: Place; index: number; selected: boolean; query: string; onSelect: (trigger: HTMLAnchorElement) => void}) {
  return <article id={`place-${place.slug}`} className={`place-card ${selected ? 'is-selected' : ''}`}>
    <div className="card-inner"><div className="card-index"><span>{index + 1}</span><span className="vertical-category" aria-hidden="true">{place.category.split('').map((letter,i)=><span key={i}>{letter}</span>)}</span></div><div className="card-body">
      <div className="card-heading"><PhotoStrip place={place} href={`${selected ? '/' : `/places/${place.slug}`}${query}`} onOpen={onSelect}/>
      <div className="card-title"><h2><Link to={{pathname: selected ? '/' : `/places/${place.slug}`, search: query}} state={{mapSelectionSource:'list'}} onClick={event=>onSelect(event.currentTarget)} aria-current={selected ? 'page' : undefined}>{place.name}</Link></h2><p className="card-area"><span className="sr-only">{place.category} · </span>{place.area}</p></div></div>
      <p className="card-description">{place.description}</p>
      <div className="card-details"><PlaceFacts place={place}/></div>
    </div></div>
  </article>;
}

function Detail({place: selectedPlace, index: selectedIndex, invalid, anchored = false, onClose}: {place?: Place; index: number; invalid: boolean; anchored?: boolean; onClose: () => void}) {
  const [content, setContent] = useState({place:selectedPlace,index:selectedIndex,invalid});
  // Keep the last open content while the native dialog finishes its exit transition.
  if((selectedPlace||invalid)&&(content.place!==selectedPlace||content.index!==selectedIndex||content.invalid!==invalid))
    setContent({place:selectedPlace,index:selectedIndex,invalid});
  const {place,index}=content;
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const desktopClose = useRef<HTMLButtonElement>(null);
  const titleId = 'detail-title';
  useLayoutEffect(() => {
    if(anchored){
      const frame=requestAnimationFrame(()=>desktopClose.current?.focus({preventScroll:true}));
      return()=>cancelAnimationFrame(frame);
    }
    const node = dialog.current;
    if (!node) return;
    const open = Boolean(selectedPlace || invalid);
    const update = () => {
      if (node.open) node.close();
      if (open) {
        const mobile=window.matchMedia('(max-width: 1023px)').matches;
        if (mobile) node.showModal(); else node.show();
        (mobile?closeButton:desktopClose).current?.focus({preventScroll:true});
      }
    };
    const screen = window.matchMedia('(max-width: 1023px)');
    update(); screen.addEventListener('change', update);
    return () => { screen.removeEventListener('change', update); if(node.open) node.close(); };
  }, [selectedPlace?.slug, invalid, anchored]);
  const startY = useRef<number | null>(null);
  const contents=<>
    {place && <span className="detail-marker" aria-hidden="true">{index}</span>}
    <button ref={desktopClose} type="button" className="desktop-detail-close" onClick={onClose} aria-label="Close place details"><Icon name="close"/></button>
    <div className="detail-scroll">
    <header className="detail-header" onTouchStart={e => {startY.current=e.touches[0].clientY;}} onTouchEnd={e => {if(startY.current!==null&&e.changedTouches[0].clientY-startY.current>80)onClose();startY.current=null;}}>
      <h2 id={titleId}>{place && <span className="detail-mobile-index">{index}. </span>}{place?.name || 'Place not found'}</h2><button ref={closeButton} type="button" onClick={onClose} aria-label="Close place details"><Icon name="close"/></button>
    </header>
    {place ? <div className="detail-content"><p>{place.description}</p><PlaceFacts place={place} showEmptyHours/></div> : <div className="detail-content"><p>This place is not in the published guide. It may have moved or been removed.</p><button type="button" className="text-link" onClick={onClose}>Back to all places ↗</button></div>}
    </div></>;
  if(anchored)return <section className="detail-panel anchored-detail" aria-labelledby={titleId}>{contents}</section>;
  return <dialog ref={dialog} className="detail-panel" aria-labelledby={titleId}
    onKeyDown={event => {if(event.key === 'Escape') {event.preventDefault(); onClose();}}}
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {if(event.target === dialog.current) {const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}}}>{contents}</dialog>;
}

export default function Guide() {
  const navigate=useNavigate(), location=useLocation(), navigationType=useNavigationType();
  const [params,setParams]=useSearchParams();
  const selectedCategory = readCategory(params);
  const area=normalizeArea(params.get('area')||'');
  const query=params.get('q')||'';
  const shown=filterPlaces(places,{category:selectedCategory,area,query});
  const match=matchPath('/places/:slug',location.pathname);
  const selected=places.find(place=>place.slug===match?.params.slug);
  const selectionSource=navigationType==='POP'?'route':location.state?.mapSelectionSource==='marker'?'marker':location.state?.mapSelectionSource==='list'?'list':'route';
  const invalid=location.pathname!=='/'&&!selected;
  const [showMap,setShowMap]=useState(false), [listExpanded,setListExpanded]=useState(true), [showInfo,setShowInfo]=useState(false);
  const [desktop,setDesktop]=useState(()=>window.matchMedia('(min-width: 1024px)').matches);
  const [mapRequested,setMapRequested]=useState(()=>window.matchMedia('(min-width: 1024px)').matches);
  const [mapReady,setMapReady]=useState(false);
  const [listScrollTop,setListScrollTop]=useState(0);
  const info=useRef<HTMLDialogElement>(null), list=useRef<HTMLDivElement>(null);
  const tabletBrand=useRef<HTMLDivElement>(null);
  const lastTrigger=useRef<HTMLElement | null>(null);
  const hadDetail=useRef(false);
  const selectedIsShown=Boolean(selected&&shown.includes(selected));
  useLayoutEffect(()=>{
    list.current?.scrollTo({top:0,behavior:'instant'});
    setListScrollTop(0);
  },[selectedCategory,area,query]);
  useLayoutEffect(()=>{
    if(selected&&!desktop){
      setMapRequested(true);
      setShowMap(true);
    }
  },[selected?.slug,selectionSource,desktop]);
  useEffect(()=>{
    if(location.pathname!==window.location.pathname||location.search!==window.location.search)return;
    const current=new URLSearchParams(location.search);
    const next=selected?queryForPlace(current,selected):setCategory(current,readCategory(current));
    if(next.toString()!==current.toString())navigate({pathname:location.pathname,search:next.toString()},{replace:true,preventScrollReset:true});
  },[location.pathname,location.search,selected,navigate]);
  useEffect(()=>{
    if(!selected||!selectedIsShown||selectionSource==='list')return;
    document.getElementById(`place-${selected.slug}`)?.scrollIntoView({block:desktop?'start':'center',behavior:'instant'});
  },[selected?.slug,selectedIsShown,desktop,selectionSource]);
  useEffect(()=>{
    const screen=window.matchMedia('(min-width: 1024px)');
    const sync=()=>{setDesktop(screen.matches);if(screen.matches)setMapRequested(true);};
    screen.addEventListener('change',sync);
    return()=>screen.removeEventListener('change',sync);
  },[]);
  useEffect(() => {document.title=selected ? `${selected.name} - ${site.name}` : invalid ? `Place not found - ${site.name}` : site.name;},[selected?.slug,invalid]);
  useEffect(() => {
    if(showInfo&&!info.current?.open) info.current?.showModal();
    else if(!showInfo&&info.current?.open) info.current?.close();
  },[showInfo]);
  useEffect(() => {
    const tablet=window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const sync=()=>setListScrollTop(tablet.matches?list.current?.scrollTop||0:0);
    tablet.addEventListener('change',sync);
    return ()=>tablet.removeEventListener('change',sync);
  },[]);
  useEffect(() => {
    if(selected||invalid){hadDetail.current=true;return;}
    if(!hadDetail.current)return;
    hadDetail.current=false;
    (lastTrigger.current?.isConnected?lastTrigger.current:list.current)?.focus({preventScroll:true});
  },[selected?.slug,invalid]);
  const updateFilters=(next: URLSearchParams)=>{
    if(selected||invalid){
      hadDetail.current=false;
      navigate({pathname:'/',search:next.toString()},{replace:true,preventScrollReset:true});
    }else setParams(next,{replace:true,preventScrollReset:true});
  };
  const change=(key:string,value:string)=>updateFilters(setQuery(new URLSearchParams(window.location.search),key,value));
  const changeCategories=(category:string)=>updateFilters(setCategory(new URLSearchParams(window.location.search),category));
  const reset=()=>updateFilters(new URLSearchParams());
  const close=()=>navigate({pathname:'/',search:location.search},{preventScrollReset:true});
  const filterProps={query,area,change,count:shown.length,reset};
  const brandOpacity=Math.max(0,1-Math.max(0,listScrollTop-100)/Math.max(1,(tabletBrand.current?.offsetHeight||0)-68));
  const mapToggle=<button type="button" className="map-toggle" onClick={()=>{setMapRequested(true);setShowMap(value=>!value);}} aria-label={showMap?'Show list':'Show map'} aria-controls="guide-map" aria-expanded={showMap}><span className="map-label" aria-hidden="true">Map</span><span className="list-label" aria-hidden="true">List</span></button>;
  const anchored=Boolean(desktop&&mapReady&&selected);
  const detail=<Detail place={selected} index={selected?places.indexOf(selected)+1:0} invalid={invalid} anchored={anchored} onClose={close}/>;
  const mapFallback=<div className="map-unavailable" role="status"><span>Google Maps isn't available</span><span className="map-external">{selected?<a href={selected.googleMapsUrl} target="_blank" rel="noreferrer">Open this place in Google Maps ↗</a>:<span>Select a place to open it in Google Maps.</span>}</span></div>;
  return <>
    <a className="skip-link" href="#places" onClick={event=>{event.preventDefault();setListExpanded(true);requestAnimationFrame(()=>list.current?.focus({preventScroll:true}));}}>Skip to places</a>
    <main className={`guide ${showMap?'mobile-map-open':''} ${!listExpanded?'list-collapsed':''} ${listScrollTop>100?'tablet-scrolled':''} ${showInfo?'info-open':''}`}>
      <h1 className="sr-only">{site.name}</h1>
      <header className="mobile-header"><button type="button" onClick={()=>setShowInfo(true)} className="info-trigger">INFO</button><Categories selected={selectedCategory} onChange={changeCategories}/>{mapToggle}</header>
      <div className="tablet-map-toggle">{mapToggle}</div>
      <section id="guide-map" className="map-region" aria-label="Map">{mapConfig&&mapRequested?<MapBoundary fallback={mapFallback} onError={()=>setMapReady(false)}><Suspense fallback={<div className="map-unavailable" role="status">Loading Google Maps…</div>}><GuideMap config={mapConfig} places={places} activePlaces={shown} selected={selected} selectionSource={selectionSource}
        desktop={desktop} visible={desktop||showMap} detail={anchored?detail:null} onReady={setMapReady} onClose={close}
        onSelect={(place,trigger)=>{
          if(selected?.slug===place.slug){close();return;}
          lastTrigger.current=trigger||null;
          setListExpanded(true);
          navigate({pathname:`/places/${place.slug}`,search:queryForPlace(new URLSearchParams(window.location.search),place).toString()},{preventScrollReset:true,state:{mapSelectionSource:'marker'}});
        }}/></Suspense></MapBoundary>:mapFallback}<button type="button" className="expand-list" onClick={()=>setListExpanded(value=>!value)} aria-label={listExpanded?'Hide place list':'Show place list'} aria-controls="places" aria-expanded={listExpanded}><Icon name={listExpanded?'arrow_forward':'arrow_back'}/></button></section>
      <section className="list-region" aria-label="Places">{!listExpanded&&<button type="button" className="collapsed-expand" aria-controls="places" aria-expanded={false} onClick={()=>setListExpanded(true)}>EXPAND</button>}<div ref={list} className="list-scroll" id="places" tabIndex={-1} onScroll={event=>{if(window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches)setListScrollTop(event.currentTarget.scrollTop);}}>
        <div className="list-cap"/>
        <div className="mobile-brand"><div ref={tabletBrand} className="responsive-brand" style={{'--tablet-brand-opacity':brandOpacity} as React.CSSProperties}><div className="tablet-categories"><Categories selected={selectedCategory} onChange={changeCategories}/></div><div className="mobile-wordmark" aria-hidden="true"><Wordmark/></div><AboutCopy onOpen={()=>setShowInfo(true)}/><footer className="guide-footer"><div><span className="label">Location</span><span>{site.city}</span></div><button type="button" onClick={()=>setShowInfo(true)}>INFO</button></footer></div><Filters {...filterProps}/></div>
        <div className="place-grid">{shown.length ? shown.map(place=><PlaceCard key={place.slug} place={place} index={places.indexOf(place)} query={location.search} selected={selected?.slug===place.slug} onSelect={trigger=>{lastTrigger.current=trigger;}}/>) : <div className="empty-state"><h2>{places.length ? 'No places found' : 'The collection is being prepared'}</h2><p>{places.length?'Try another category, area or search.':'New places will appear here once their details have been checked.'}</p>{places.length>0&&<button type="button" onClick={reset}>Clear filters ↗</button>}</div>}</div>
      </div></section>
      <aside className="brand-region" aria-label="About the guide"><Categories selected={selectedCategory} onChange={changeCategories}/><Filters {...filterProps}/><div className="brand-center" aria-hidden="true"><Wordmark/></div><AboutCopy onOpen={()=>setShowInfo(true)}/><footer className="guide-footer"><div><span className="label">Location</span><span>{site.city}</span></div><button type="button" onClick={()=>setShowInfo(true)}>INFO</button></footer></aside>
    </main>
    {!anchored&&detail}
    <dialog ref={info} className="info-panel" aria-labelledby="info-title" onCancel={event=>{event.preventDefault();setShowInfo(false);}}><header><button type="button" onClick={()=>setShowInfo(false)}>CLOSE</button></header><div className="info-body"><h2 id="info-title" className="sr-only">About {site.name}</h2><div className="info-main"><div className="info-logo"><Wordmark small/></div><div className="info-copy"><p>Our shared collection starts with recommendations from Lonely Planet. Each published place includes its location and useful links for planning a visit.</p><p>Addresses, opening hours and availability can change. Use the place's official links before heading out.</p><p>This is an independent guide for friends, with no affiliation to Lonely Planet or Trip Tips.</p><p><a href="/legal.html#terms" target="_blank" rel="noreferrer">Terms of use ↗</a> · <a href="/legal.html#privacy" target="_blank" rel="noreferrer">Privacy policy ↗</a></p></div><div className="info-space" aria-hidden="true"/></div><div className="info-location"><div><span className="label">Location</span><span>{site.city}</span></div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></div></div></dialog>
  </>;
}

