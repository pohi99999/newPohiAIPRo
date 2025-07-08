
import React from 'react';
import { Waypoint, MockCompany } from '../types';
import { MapPinIcon } from '@heroicons/react/24/solid'; 
import { useLocale } from '../LocaleContext';
import Card from '../components/Card';

interface SimulatedRouteMapProps {
  waypoints: Waypoint[];
  optimizedRouteDescription?: string;
  companies: MockCompany[];
}

const SimulatedRouteMap: React.FC<SimulatedRouteMapProps> = ({ waypoints, optimizedRouteDescription, companies }) => {
  const { t } = useLocale();

  if (!waypoints || waypoints.length === 0) {
     return (
      <Card title={t('adminTruckPlanning_routeMap_title')} className="bg-slate-800 shadow-lg">
        <div className="text-center text-slate-400 py-4">{t('adminTruckPlanning_routeMap_noWaypoints')}</div>
      </Card>
    );
  }

  const mapWidth = 800;
  const mapHeight = 500;
  const padding = 40; 

  // Bounding box for Hungary and surrounding areas
  const MIN_LON = 16.0;
  const MAX_LON = 23.5;
  const MIN_LAT = 45.5;
  const MAX_LAT = 48.8;

  const getPositionFromCoords = (lat: number, lon: number) => {
    const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (mapWidth - 2 * padding) + padding;
    const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (mapHeight - 2 * padding) + padding;
    return { 
      x: Math.max(padding, Math.min(x, mapWidth - padding)),
      y: Math.max(padding, Math.min(y, mapHeight - padding)),
    };
  };

  const waypointsWithCoords = waypoints.map(wp => {
    const companyName = wp.name.split(' - ')[0]; // Extract company name from "Company - Pickup"
    const company = companies.find(c => c.companyName === companyName);
    if (company && company.address?.latitude && company.address?.longitude) {
      return { ...wp, coords: getPositionFromCoords(company.address.latitude, company.address.longitude) };
    }
    // Fallback for companies without coords - random placement, but consistent based on name
    const hash = companyName.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const x = (hash & 0xffff) % (mapWidth - 2 * padding) + padding;
    const y = ((hash >> 16) & 0xffff) % (mapHeight - 2 * padding) + padding;
    return { ...wp, coords: { x, y } };
  }).sort((a,b) => a.order - b.order);


  const pathData = waypointsWithCoords.map((wp, i) => {
    if (i === 0) return `M ${wp.coords.x} ${wp.coords.y}`;
    
    const prevWp = waypointsWithCoords[i-1];
    
    // Using a quadratic Bézier curve for a smooth path
    const midX = (prevWp.coords.x + wp.coords.x) / 2;
    const midY = (prevWp.coords.y + wp.coords.y) / 2;
    
    // Add some variation to the control point to avoid perfectly straight lines looking odd when curved
    const controlPointOffset = Math.sqrt(Math.pow(wp.coords.x - prevWp.coords.x, 2) + Math.pow(wp.coords.y - prevWp.coords.y, 2)) / 3;
    const angle = Math.atan2(wp.coords.y - prevWp.coords.y, wp.coords.x - prevWp.coords.x) - Math.PI / 2;

    const controlX = midX + controlPointOffset * Math.cos(angle);
    const controlY = midY + controlPointOffset * Math.sin(angle);

    return `Q ${controlX} ${controlY}, ${wp.coords.x} ${wp.coords.y}`;
  }).join(' ');

  return (
    <Card title={t('adminTruckPlanning_routeMap_title')} className="bg-slate-800 shadow-lg">
      <div className="p-4">
        {optimizedRouteDescription && (
          <p className="text-sm text-slate-300 mb-3">{t('adminTruckPlanning_routeMap_description')}: {optimizedRouteDescription}</p>
        )}
        <div className="bg-slate-900/50 p-2 rounded-lg relative overflow-hidden">
          <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} width="100%" preserveAspectRatio="xMidYMin meet" aria-labelledby="route-map-title-svg">
            <title id="route-map-title-svg">{t('adminTruckPlanning_routeMap_svgTitle')}</title>
            
            {/* Google Maps-like background */}
            <rect width={mapWidth} height={mapHeight} className="fill-slate-800"/>
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 0 5 L 30 5 M 5 0 L 5 30" className="stroke-slate-700/50" strokeWidth="0.5" />
              </pattern>
               <filter id="map-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <path d="M -10,300 Q 150,250 300,320 T 650,350 L 650,510 L -10,510 Z" className="fill-blue-900/30" />
            <path d="M 500,20 Q 550,80 580,200 L 450,250 Q 480,100 500,20 Z" className="fill-green-900/20" />
            <path d="M 100,0 L 120,500" className="stroke-slate-700/60" strokeWidth="1.5" />
             <path d="M 0,150 L 800,180" className="stroke-slate-700/60" strokeWidth="1" />

            {/* Route Path */}
            <path
              d={pathData}
              className="stroke-cyan-500"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="8 4"
            >
                <animate attributeName="stroke-dashoffset" from="1000" to="0" dur="20s" repeatCount="indefinite" />
            </path>
            
            {waypointsWithCoords.map((waypoint, i) => {
              const { x, y } = waypoint.coords;
              const isPickup = waypoint.type === 'pickup';
              const iconColor = isPickup ? 'text-emerald-400' : 'text-red-400';

              return (
                <g key={`waypoint-${i}`} transform={`translate(${x}, ${y})`} className="cursor-pointer group"> 
                   <title>{`${waypoint.order + 1}. ${waypoint.name} (${t(isPickup ? 'adminTruckPlanning_routeMap_pickup' : 'adminTruckPlanning_routeMap_dropoff')})`}</title>
                   <circle cx="0" cy="0" r="12" className={`${isPickup ? 'fill-emerald-900/50' : 'fill-red-900/50'} stroke-2 ${isPickup ? 'stroke-emerald-400' : 'stroke-red-400'} opacity-50 group-hover:opacity-80 transition-opacity`} />
                   <MapPinIcon className={`h-8 w-8 ${iconColor} drop-shadow-lg transform -translate-x-1/2 -translate-y-full group-hover:scale-110 transition-transform`} style={{filter: 'url(#map-glow)'}}/>
                   <text x="0" y="8" textAnchor="middle" className="text-xs fill-white font-bold pointer-events-none select-none">
                       {waypoint.order + 1}
                   </text>
                   <text x="0" y="-35" textAnchor="middle" className="text-sm fill-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none drop-shadow-lg">
                       {waypoint.name}
                   </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-3">
            <h4 className="text-sm font-semibold text-cyan-300 mb-1">{t('adminTruckPlanning_routeMap_waypointList')}:</h4>
            <ul className="text-sm text-slate-300 space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-2">
                {waypointsWithCoords.map(wp => ( 
                    <li key={`${wp.order}-${wp.name}`} className="flex items-center">
                       <span className={`inline-block w-4 h-4 rounded-full mr-2 border-2 ${wp.type === 'pickup' ? 'bg-emerald-500 border-emerald-300' : 'bg-red-500 border-red-300'}`} />
                       {wp.order + 1}. {wp.name} ({t(wp.type === 'pickup' ? 'adminTruckPlanning_routeMap_pickup' : 'adminTruckPlanning_routeMap_dropoff')})
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </Card>
  );
};

export default SimulatedRouteMap;
