import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import {APIProvider} from '@vis.gl/react-google-maps';
import Guide from './App.tsx';
import {mapsConfig} from './maps.ts';
import './styles.css';

const config = mapsConfig(import.meta.env);
// URL-backed form controls must update synchronously to retain every keystroke.
const guide = <BrowserRouter useTransitions={false}><Guide/></BrowserRouter>;
createRoot(document.getElementById('root')!).render(config ?
  <APIProvider apiKey={config.apiKey} language="en" region="TH" version="quarterly" authReferrerPolicy="origin">{guide}</APIProvider> : guide);
