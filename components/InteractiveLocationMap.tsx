// components/InteractiveLocationMap.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockCompany, UserRole } from '../types';
import { useLocale } from '../LocaleContext';
import Button from './Button';
import { MapPinIcon, UserIcon, BuildingStorefrontIcon } from '@heroicons/react/24/solid';

interface InteractiveLocationMapProps {
  companies: MockCompany[];
  onSelectCompany: (company: MockCompany) => void;
  selectedCompanyId: string | null;
}

type FilterType = 'all' | UserRole.CUSTOMER | UserRole.MANUFACTURER;

const InteractiveLocationMap: React.FC<InteractiveLocationMapProps> = ({ companies, onSelectCompany, selectedCompanyId }) => {
  const { t } = useLocale();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [hoveredCompany, setHoveredCompany] = useState<MockCompany | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const companiesWithCoords = useMemo(() => 
    companies.filter(c => c.address?.latitude && c.address?.longitude),
    [companies]
  );
  
  const filteredCompanies = useMemo(() => {
    if (activeFilter === 'all') {
      return companiesWithCoords;
    }
    return companiesWithCoords.filter(c => c.role === activeFilter);
  }, [companiesWithCoords, activeFilter]);


  if (companiesWithCoords.length === 0) {
    return (
      <div className="text-center text-slate-400 py-8 bg-slate-700/30 rounded-lg">
        <p>{t('logisticsHub_no_companies_with_coords')}</p>
      </div>
    );
  }
  
  // Bounding box for Hungary and surrounding areas
  const MIN_LON = 16.0;
  const MAX_LON = 23.5;
  const MIN_LAT = 45.5;
  const MAX_LAT = 48.8;

  const mapWidth = 800;
  const mapHeight = 500;
  const padding = 20;

  const getPosition = (lat: number, lon: number) => {
    const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (mapWidth - 2 * padding) + padding;
    const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (mapHeight - 2 * padding) + padding;
    return { x, y };
  };

  const handleMouseEnter = (company: MockCompany, event: React.MouseEvent) => {
    setHoveredCompany(company);
    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const svgRect = (event.currentTarget as SVGGElement).ownerSVGElement!.getBoundingClientRect();
    setTooltipPosition({ x: rect.left - svgRect.left + rect.width / 2, y: rect.top - svgRect.top });
  };
  

  const handleMouseLeave = () => {
    setHoveredCompany(null);
  };
  
  const handlePointClick = (company: MockCompany) => {
      onSelectCompany(company);
  };


  return (
    <div className="space-y-4">
      <div className="flex justify-center space-x-2 bg-slate-900/50 p-2 rounded-md">
        <Button size="sm" variant={activeFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setActiveFilter('all')}>{t('logisticsHub_filter_all')}</Button>
        <Button size="sm" variant={activeFilter === UserRole.CUSTOMER ? 'primary' : 'secondary'} onClick={() => setActiveFilter(UserRole.CUSTOMER)}>{t('logisticsHub_filter_customers')}</Button>
        <Button size="sm" variant={activeFilter === UserRole.MANUFACTURER ? 'primary' : 'secondary'} onClick={() => setActiveFilter(UserRole.MANUFACTURER)}>{t('logisticsHub_filter_manufacturers')}</Button>
      </div>
      <div className="relative" onMouseLeave={handleMouseLeave}>
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-auto bg-slate-700 rounded-lg border border-slate-600">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {filteredCompanies.map(company => {
            const { x, y } = getPosition(company.address!.latitude!, company.address!.longitude!);
            const isHovered = hoveredCompany?.id === company.id;
            const isSelected = selectedCompanyId === company.id;
            const Icon = company.role === UserRole.CUSTOMER ? UserIcon : BuildingStorefrontIcon;
            const color = company.role === UserRole.CUSTOMER ? 'text-sky-400' : 'text-emerald-400';
            const ringColor = company.role === UserRole.CUSTOMER ? 'stroke-sky-400' : 'stroke-emerald-400';

            return (
              <g 
                key={company.id} 
                transform={`translate(${x}, ${y})`}
                className="cursor-pointer transition-transform duration-200 ease-in-out"
                style={{ transform: (isHovered || isSelected) ? 'scale(1.2)' : 'scale(1)', transformOrigin: 'center bottom' }}
                onClick={() => handlePointClick(company)}
                onMouseEnter={(e) => handleMouseEnter(company, e)}
              >
                {isSelected && <circle cx="0" cy="-16" r="10" className={`opacity-70 ${ringColor}`} strokeWidth="2" fill="none">
                    <animate attributeName="r" from="8" to="12" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>}
                <MapPinIcon 
                  className={`h-8 w-8 ${color} drop-shadow-lg`} 
                  style={{ transform: 'translate(-50%, -100%)', filter: isHovered ? 'url(#glow)' : 'none' }} 
                />
                <Icon className={`h-3.5 w-3.5 text-slate-800`} style={{ transform: 'translate(-50%, -240%)' }} />
                <title>{company.companyName}</title>
              </g>
            );
          })}
        </svg>

        {hoveredCompany && (
           <div 
             className="absolute p-3 bg-slate-800 text-white rounded-lg shadow-2xl text-xs w-48 pointer-events-none border border-cyan-500/50 z-50"
             style={{
                top: `${tooltipPosition.y - 10}px`, 
                left: `${tooltipPosition.x}px`,
                transform: 'translate(-50%, -100%)',
             }}
           >
              <p className="font-bold text-cyan-400">{hoveredCompany.companyName}</p>
              <p><strong className="text-slate-400">{t('logisticsHub_tooltip_role')}:</strong> {t(hoveredCompany.role === UserRole.CUSTOMER ? 'userRole_CUSTOMER' : 'userRole_MANUFACTURER')}</p>
              <p><strong className="text-slate-400">{t('logisticsHub_tooltip_address')}:</strong> {hoveredCompany.address?.city}, {hoveredCompany.address?.country}</p>
              <p className="text-slate-500 italic mt-1">{t('logisticsHub_tooltip_click_for_details')}</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveLocationMap;