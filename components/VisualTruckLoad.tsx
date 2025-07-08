
import React from 'react';
import { LoadingPlanItem } from '../types';
import { useLocale } from '../LocaleContext';
import Card from '../components/Card'; 

interface VisualTruckLoadProps {
  items: LoadingPlanItem[];
  truckCapacityM3?: number; 
  planDetails?: string;
}

const HEX_COLORS = {
  cyan: { base: '#0891b2', light: '#22d3ee' },
  blue: { base: '#2563eb', light: '#60a5fa' },
  indigo: { base: '#4f46e5', light: '#818cf8' },
  purple: { base: '#9333ea', light: '#c084fc' },
  pink: { base: '#db2777', light: '#f9a8d4' },
  rose: { base: '#e11d48', light: '#fb7185' },
  sky: { base: '#0284c7', light: '#38bdf8' },
  teal: { base: '#0d9488', light: '#2dd4bf' },
  emerald: { base: '#059669', light: '#34d399' },
  lime: { base: '#65a30d', light: '#a3e635' },
  amber: { base: '#d97706', light: '#fcd34d' },
  orange: { base: '#ea580c', light: '#fb923c' },
};
const ITEM_COLOR_KEYS = Object.keys(HEX_COLORS);


const VisualTruckLoad: React.FC<VisualTruckLoadProps> = ({ items, truckCapacityM3 = 25, planDetails }) => {
  const { t } = useLocale();

  if (!items || items.length === 0) {
    return (
      <Card title={t('adminTruckPlanning_visualTruck_title')} className="bg-slate-800 shadow-lg">
         <div className="text-center text-slate-400 py-4">{t('adminTruckPlanning_visualTruck_noItems')}</div>
      </Card>
    );
  }

  const truckWidth = 800; 
  const truckHeight = 200; 
  const perspective = 30; // for 3D effect
  
  const floorY = truckHeight - perspective;
  const usableWidth = truckWidth * 0.95; 
  const usableHeight = floorY * 0.7;
  const startX = (truckWidth - usableWidth) / 2;

  // Map unique destination names to colors
  const uniqueDestinations = Array.from(new Set(items.map(item => item.destinationName || t('status_unknown'))));
  const destinationColorMap = new Map<string, keyof typeof HEX_COLORS>();
  uniqueDestinations.forEach((dest, index) => {
    destinationColorMap.set(dest, ITEM_COLOR_KEYS[index % ITEM_COLOR_KEYS.length] as keyof typeof HEX_COLORS);
  });

  const sortedItems = [...items].sort((a, b) => {
    if (a.dropOffOrder !== undefined && b.dropOffOrder !== undefined) {
      return (b.dropOffOrder || 0) - (a.dropOffOrder || 0); // LIFO
    }
    return 0;
  });

  let totalVolumeLoaded = 0;
  sortedItems.forEach(item => {
    const volumeStr = String(item.volumeM3 || '0').replace(/[^\d.-]/g, '');
    totalVolumeLoaded += parseFloat(volumeStr);
  });
  
  const totalVolumeForScaling = Math.max(totalVolumeLoaded, truckCapacityM3); 

  let currentX = startX + usableWidth; // Start from the back (right)

  return (
    <Card title={t('adminTruckPlanning_visualTruck_title')} className="bg-slate-800 shadow-lg">
      <div className="p-4 overflow-x-auto">
        {planDetails && <p className="text-sm text-slate-300 mb-3">{planDetails}</p>}
        
        <svg viewBox={`0 0 ${truckWidth} ${truckHeight}`} width="100%" preserveAspectRatio="xMidYMid meet" aria-labelledby="truck-load-title" className="min-w-[700px]">
          <title id="truck-load-title">{t('adminTruckPlanning_visualTruck_svgTitle')}</title>
          
           <defs>
            {Object.entries(HEX_COLORS).map(([key, {base, light}]) => (
                 <linearGradient key={key} id={`grad-${key}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={light} />
                    <stop offset="100%" stopColor={base} />
                </linearGradient>
            ))}
          </defs>

          {/* Truck Bed 3D */}
          <g>
            <path d={`M${startX - perspective},${floorY + perspective} L${startX},${floorY} L${startX + usableWidth},${floorY} L${startX + usableWidth - perspective},${floorY + perspective} Z`} className="fill-slate-600" />
            <path d={`M${startX + usableWidth}, ${floorY} L${startX + usableWidth}, ${floorY - usableHeight} L${startX + usableWidth - perspective}, ${floorY - usableHeight + perspective} L${startX + usableWidth - perspective}, ${floorY + perspective} Z`} className="fill-slate-500" />
            <rect x={startX} y={floorY-usableHeight} width={usableWidth} height={usableHeight} className="fill-slate-700/50" />
          </g>

          {sortedItems.map((item, index) => {
            const itemVolume = parseFloat(String(item.volumeM3 || '0').replace(/[^\d.-]/g, ''));
            const itemWidth = totalVolumeForScaling > 0 ? (itemVolume / totalVolumeForScaling) * usableWidth : 0;
            const itemHeight = usableHeight * 0.95;
            
            if (itemWidth <= 0) return null;

            currentX -= itemWidth;
            const itemX = currentX;

            const colorKey = destinationColorMap.get(item.destinationName || t('status_unknown')) || 'cyan';

            return (
              <g key={`item-${index}`} className="truck-item-group" transform={`translate(${itemX}, ${floorY - itemHeight})`}>
                 <title>{`${item.name} (${item.volumeM3 || 'N/A'} m³)\n${t('adminTruckPlanning_visualTruck_destination')}: ${item.destinationName || 'N/A'}\n${t('adminTruckPlanning_visualTruck_dropOrder')}: ${item.dropOffOrder || 'N/A'}`}</title>
                 <path d={`M${-perspective},${perspective} L0,0 L${itemWidth},0 L${itemWidth - perspective},${perspective} Z`} fill={HEX_COLORS[colorKey].light} opacity="0.6"/>
                 <path d={`M${itemWidth},0 L${itemWidth},${itemHeight} L${itemWidth - perspective},${itemHeight + perspective} L${itemWidth - perspective},${perspective} Z`} fill={HEX_COLORS[colorKey].base} opacity="0.8"/>
                 <rect
                  width={itemWidth - perspective}
                  height={itemHeight}
                  fill={`url(#grad-${colorKey})`}
                  className="stroke-slate-900/50"
                  strokeWidth="1"
                />
                
                <text
                    x={(itemWidth - perspective) / 2}
                    y={itemHeight / 2}
                    dy=".35em"
                    textAnchor="middle"
                    className="text-lg fill-white font-bold pointer-events-none select-none drop-shadow-md"
                  >
                  {item.dropOffOrder}
                </text>
              </g>
            );
          })}
           <text x={startX - perspective + 10} y={truckHeight - 5} className="text-sm fill-slate-400">{t('adminTruckPlanning_visualTruck_doorEnd')}</text>
           <text x={startX + usableWidth - perspective - 10} y={truckHeight - 5} textAnchor="end" className="text-sm fill-slate-400">{t('adminTruckPlanning_visualTruck_cabEnd')}</text>
        </svg>
        <div className="mt-4 p-2 bg-slate-700/30 rounded-md">
            <h4 className="text-base font-semibold text-slate-200 mb-2">{t('adminTruckPlanning_visualTruck_legend')}</h4>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                 {uniqueDestinations.map((destName) => {
                     const colorKey = destinationColorMap.get(destName) || 'cyan';
                     return(
                        <div key={destName} className="flex items-center text-sm">
                            <span className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: HEX_COLORS[colorKey].base}}></span>
                            <span className="text-slate-300">{destName}</span>
                        </div>
                     )
                 })}
            </div>
             <p className="text-xs text-slate-400 mt-3">{t('adminTruckPlanning_visualTruck_totalVolumeLoaded', { volume: totalVolumeLoaded.toFixed(2) })} / {truckCapacityM3} m³ ({((totalVolumeLoaded / truckCapacityM3) * 100).toFixed(1)}%)</p>
        </div>
      </div>
    </Card>
  );
};

export default VisualTruckLoad;
