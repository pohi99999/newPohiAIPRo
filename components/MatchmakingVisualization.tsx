import React, { useRef, useEffect, useState } from 'react';
import { DemandItem, StockItem, MatchmakingSuggestion, DemandStatus, StockStatus, ConfirmedMatch } from '../types';
import { useLocale } from '../LocaleContext';
import { InformationCircleIcon, PaperAirplaneIcon, CheckCircleIcon, ArchiveBoxIcon, BeakerIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { CONFIRMED_MATCHES_STORAGE_KEY } from '../constants';

interface MatchmakingVisualizationProps {
  suggestions: MatchmakingSuggestion[] | string;
  demands: DemandItem[];
  stockItems: StockItem[];
  onConfirmMatch: (suggestion: MatchmakingSuggestion) => void;
}

const MatchmakingVisualization: React.FC<MatchmakingVisualizationProps> = ({
  suggestions,
  demands,
  stockItems,
  onConfirmMatch,
}) => {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineCoordinates, setLineCoordinates] = useState<
    Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      midX: number;
      midY: number;
      suggestion: MatchmakingSuggestion;
      isConfirmed: boolean;
    }>
  >([]);
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null);
  const [confirmedMatchPairs, setConfirmedMatchPairs] = useState<Set<string>>(new Set());

   useEffect(() => {
    const storedConfirmedMatchesRaw = localStorage.getItem(CONFIRMED_MATCHES_STORAGE_KEY);
    if (storedConfirmedMatchesRaw) {
        try {
            const storedConfirmedMatches: ConfirmedMatch[] = JSON.parse(storedConfirmedMatchesRaw);
            const confirmedPairs = new Set(
                storedConfirmedMatches.map(match => `${match.demandId}-${match.stockId}`)
            );
            setConfirmedMatchPairs(confirmedPairs);
        } catch (e) {
            console.error("Failed to parse confirmed matches from localStorage", e);
        }
    }
  }, [suggestions]);


  const activeDemands = demands.filter(d => d.status === DemandStatus.RECEIVED);
  const availableStock = stockItems.filter(s => s.status === StockStatus.AVAILABLE);

  useEffect(() => {
    const calculateLines = () => {
      if (!Array.isArray(suggestions) || suggestions.length === 0 || !containerRef.current) {
        setLineCoordinates([]);
        return;
      }
      const newCoordinates: typeof lineCoordinates = [];
      const containerRect = containerRef.current.getBoundingClientRect();

      suggestions.forEach(suggestion => {
        try {
            if (!suggestion || !suggestion.id || !suggestion.demandId || !suggestion.stockId) {
                console.warn(`[MatchmakingVisualization] Invalid suggestion object encountered:`, suggestion);
                return;
            }
            const demandElement = document.getElementById(`demand-vis-${suggestion.demandId}`);
            const stockElement = document.getElementById(`stock-vis-${suggestion.stockId}`);

            if (!demandElement || !stockElement || demandElement.offsetParent === null || stockElement.offsetParent === null) {
                return; 
            }
            
            const demandRect = demandElement.getBoundingClientRect();
            const stockRect = stockElement.getBoundingClientRect();

            if (demandRect.width === 0 || stockRect.width === 0) return;

            const x1 = demandRect.right - containerRect.left;
            const y1 = demandRect.top + demandRect.height / 2 - containerRect.top;
            const x2 = stockRect.left - containerRect.left;
            const y2 = stockRect.top + stockRect.height / 2 - containerRect.top;
            
            if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

            newCoordinates.push({
                id: suggestion.id,
                x1, y1, x2, y2,
                midX: (x1 + x2) / 2,
                midY: (y1 + y2) / 2,
                suggestion,
                isConfirmed: confirmedMatchPairs.has(`${suggestion.demandId}-${suggestion.stockId}`)
            });
        } catch (error) {
            console.error(`[MatchmakingVisualization] Error processing suggestion ${suggestion?.id}:`, error);
        }
      });
      setLineCoordinates(newCoordinates);
    };
    
    const animationFrameId = requestAnimationFrame(calculateLines);
    
    const observer = new MutationObserver(calculateLines);
    if (containerRef.current) {
        const demandCol = containerRef.current.querySelector('#demand-column-vis');
        const stockCol = containerRef.current.querySelector('#stock-column-vis');
        if (demandCol) observer.observe(demandCol, { childList: true, subtree: true, attributes: true, characterData:true });
        if (stockCol) observer.observe(stockCol, { childList: true, subtree: true, attributes: true, characterData:true });
    }

    window.addEventListener('resize', calculateLines);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', calculateLines);
      observer.disconnect();
    };
  }, [suggestions, demands, stockItems, confirmedMatchPairs]);

  const handleConfirmClick = (e: React.MouseEvent, suggestion: MatchmakingSuggestion) => {
    e.stopPropagation(); 
    onConfirmMatch(suggestion);
    setConfirmedMatchPairs(prev => new Set(prev).add(`${suggestion.demandId}-${suggestion.stockId}`));
  };


  const getMatchColor = (strength?: string, score?: number, isConfirmed?: boolean) => {
    if (isConfirmed) return 'stroke-yellow-500'; 
    if (typeof score === 'number') {
      if (score >= 0.8) return 'stroke-green-400';
      if (score >= 0.5) return 'stroke-yellow-400';
      return 'stroke-red-400';
    }
    if (strength) {
      const lowerStrength = strength.toLowerCase();
      if (lowerStrength.includes('high')) return 'stroke-green-400';
      if (lowerStrength.includes('medium')) return 'stroke-yellow-400';
      return 'stroke-red-400';
    }
    return 'stroke-cyan-500'; 
  };
  
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    const messageToDisplay = typeof suggestions === 'string' ? suggestions : t('adminMatchmaking_noPairingSuggestions');
    return (
      <div className="text-center text-slate-400 py-6">
        <InformationCircleIcon className="h-10 w-10 mx-auto mb-2 text-cyan-500" />
        {messageToDisplay} 
      </div>
    );
  }
  
  const renderItemCard = (item: DemandItem | StockItem, type: 'demand' | 'stock') => {
    const isDemand = type === 'demand';
    const isPartOfSuggestion = lineCoordinates.some(lc => (isDemand && lc.suggestion.demandId === item.id) || (!isDemand && lc.suggestion.stockId === item.id));
    const isPartOfHoveredSuggestion = isPartOfSuggestion && lineCoordinates.some(lc => lc.suggestion.id === hoveredSuggestionId && ((isDemand && lc.suggestion.demandId === item.id) || (!isDemand && lc.suggestion.stockId === item.id)));
    
    return (
        <div 
            id={`${type}-vis-${item.id}`} 
            className={`p-3 rounded-lg shadow-lg text-xs mb-3 transition-all duration-200 ease-in-out relative border
                        ${isDemand ? 'bg-sky-900/50 border-sky-800' : 'bg-emerald-900/50 border-emerald-800'}
                        ${isPartOfHoveredSuggestion ? (isDemand ? 'border-cyan-300 shadow-cyan-400/20' : 'border-cyan-300 shadow-cyan-400/20') : ''}
                        `}
        >
            <p className={`font-semibold text-sm mb-1 ${isDemand ? 'text-sky-300' : 'text-emerald-300'}`}>
                {isDemand ? t('adminMatchmaking_demand') : t('adminMatchmaking_stock')}: {item.id?.substring(0, 10)}...
            </p>
            <div className="space-y-1.5 text-slate-300">
                <div className="flex items-center" title={item.productName || ''}>
                    <ArchiveBoxIcon className="h-4 w-4 mr-2 text-slate-400 shrink-0"/>
                    <span className="truncate">{item.productName || item.diameterType}, Ø{item.diameterFrom}-{item.diameterTo}cm, {item.length}m, {item.quantity}pcs</span>
                </div>
                 <div className="flex items-center">
                    <BeakerIcon className="h-4 w-4 mr-2 text-slate-400 shrink-0"/>
                    <span>{t('customerMyDemands_cubicMeters')}: {item.cubicMeters?.toFixed(2) ?? 'N/A'} m³</span>
                </div>
                {(item as StockItem).price && (
                    <div className="flex items-center">
                        <BanknotesIcon className="h-4 w-4 mr-2 text-slate-400 shrink-0"/>
                        <span>{t('manufacturerMyStock_price')}: {(item as StockItem).price}</span>
                    </div>
                )}
            </div>
        </div>
    );
  };

  return (
    <div ref={containerRef} className="relative grid grid-cols-[1fr_auto_1fr] md:grid-cols-[1fr_auto_1fr] gap-x-4 md:gap-x-8 p-4 bg-slate-900/50 rounded-lg min-h-[400px]">
      <div id="demand-column-vis" className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-lg font-semibold text-sky-400 mb-3 sticky top-0 bg-slate-900/50 py-2 z-10 backdrop-blur-sm">{t('adminMatchmaking_demand')} ({activeDemands.length})</h3>
        {activeDemands.length > 0 ? activeDemands.map(demand => renderItemCard(demand, 'demand')) : <p className="text-slate-400 text-sm p-4 text-center">{t('adminMatchmaking_noDemandsForCompany')}</p>}
      </div>

      <div className="flex-shrink-0 w-16 md:w-24" />

      <div id="stock-column-vis" className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-lg font-semibold text-emerald-400 mb-3 sticky top-0 bg-slate-900/50 py-2 z-10 backdrop-blur-sm">{t('adminMatchmaking_stock')} ({availableStock.length})</h3>
        {availableStock.length > 0 ? availableStock.map(stock => renderItemCard(stock, 'stock')) : <p className="text-slate-400 text-sm p-4 text-center">{t('adminMatchmaking_noStockForCompany')}</p>}
      </div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ top: 0, left: 0 }}>
        <defs>
            <marker id="arrowhead-matchmaking-cyan" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 8 2.5, 0 5" className="fill-current text-cyan-500 opacity-70" /></marker>
            <marker id="arrowhead-matchmaking-green" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 8 2.5, 0 5" className="fill-current text-green-400 opacity-70" /></marker>
            <marker id="arrowhead-matchmaking-yellow" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 8 2.5, 0 5" className="fill-current text-yellow-400 opacity-70" /></marker>
            <marker id="arrowhead-matchmaking-red" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 8 2.5, 0 5" className="fill-current text-red-400 opacity-70" /></marker>
            <marker id="arrowhead-matchmaking-gold" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 8 2.5, 0 5" className="fill-current text-yellow-500 opacity-90" /></marker>
            <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {lineCoordinates.map(coords => {
          if (isNaN(coords.x1) || isNaN(coords.y1) || isNaN(coords.x2) || isNaN(coords.y2)) return null; 
          const colorClass = getMatchColor(coords.suggestion.matchStrength, coords.suggestion.similarityScore, coords.isConfirmed);
          const markerId = coords.isConfirmed ? "arrowhead-matchmaking-gold" : colorClass.includes('green') ? "arrowhead-matchmaking-green" : colorClass.includes('yellow-400') ? "arrowhead-matchmaking-yellow" : colorClass.includes('red') ? "arrowhead-matchmaking-red" : "arrowhead-matchmaking-cyan";
          const pathData = `M ${coords.x1} ${coords.y1} C ${coords.x1 + 60} ${coords.y1}, ${coords.x2 - 60} ${coords.y2}, ${coords.x2} ${coords.y2}`;
          
          return (
          <g key={coords.id} className="match-line-group" onMouseEnter={() => setHoveredSuggestionId(coords.id)} onMouseLeave={() => setHoveredSuggestionId(null)}>
            <path
              d={pathData}
              className={`${colorClass} transition-all duration-300`}
              strokeWidth={hoveredSuggestionId === coords.id || coords.isConfirmed ? 3.5 : 2}
              strokeDasharray={coords.isConfirmed ? "none" : "4 2"}
              markerEnd={`url(#${markerId})`}
              fill="none"
              style={hoveredSuggestionId === coords.id ? { filter: 'url(#glow-filter)' } : {}}
            />
            <circle cx={coords.midX} cy={coords.midY} r="10" className="fill-transparent pointer-events-auto" onClick={(e) => !coords.isConfirmed && handleConfirmClick(e, coords.suggestion)} />
          </g>
        )})}
      </svg>
      
      {lineCoordinates.map(coords => {
            return (
                <g key={`interactive-${coords.id}`} className="pointer-events-auto" transform={`translate(${coords.midX}, ${coords.midY})`} onMouseEnter={() => setHoveredSuggestionId(coords.id)} onMouseLeave={() => setHoveredSuggestionId(null)} onClick={(e) => !coords.isConfirmed && handleConfirmClick(e, coords.suggestion)}>
                    <circle r="12" className={`${coords.isConfirmed ? 'fill-yellow-600/80' : 'fill-cyan-600/80'} ${!coords.isConfirmed ? 'hover:fill-cyan-500' : ''} transition-colors cursor-pointer`} />
                    {coords.isConfirmed ? <CheckCircleIcon className="h-4 w-4 text-slate-900 -translate-x-2 -translate-y-2" /> : <PaperAirplaneIcon className="h-4 w-4 text-slate-900 -translate-x-2 -translate-y-2" />}
                </g>
            );
      })}

      {lineCoordinates.map(coords => {
        if (hoveredSuggestionId === coords.id) {
            const isLeftHalf = coords.midX < (containerRef.current?.clientWidth || 0) / 2;
            const tooltipStyle: React.CSSProperties = {
                position: 'absolute',
                top: `${coords.midY}px`, 
                left: isLeftHalf ? `${coords.midX + 25}px` : undefined, 
                right: !isLeftHalf ? `${(containerRef.current?.clientWidth || 0) - coords.midX + 25}px` : undefined, 
                transform: 'translateY(-50%)', 
                zIndex: 50,
                pointerEvents: 'none', 
            };

            return (
                <div 
                    key={`tooltip-${coords.id}`}
                    className={`p-3 border rounded-lg shadow-2xl text-xs w-64 md:w-72 animate-fade-in
                                ${coords.isConfirmed ? 'bg-slate-900 border-yellow-500' : 'bg-slate-900 border-cyan-400'}`}
                    style={tooltipStyle}
                >
                    <p className={`font-bold mb-1.5 ${coords.isConfirmed ? 'text-yellow-400' : 'text-cyan-300'}`}>
                        {coords.isConfirmed ? t('adminMatchmaking_matchConfirmed_title') : t('adminMatchmaking_reason')}
                    </p>
                    <p className="text-slate-200 mb-1 whitespace-pre-wrap leading-snug">{coords.suggestion.reason}</p>
                    {coords.suggestion.matchStrength && (
                        <p className="text-slate-300"><strong className={coords.isConfirmed ? 'text-yellow-400' : 'text-cyan-300'}>{t('adminMatchmaking_matchStrength')}</strong> {coords.suggestion.matchStrength}</p>
                    )}
                    {coords.suggestion.similarityScore !== undefined && (
                        <p className="text-slate-300"><strong className={coords.isConfirmed ? 'text-yellow-400' : 'text-cyan-300'}>{t('adminMatchmaking_similarityScoreLabel')}</strong> {(coords.suggestion.similarityScore * 100).toFixed(0)}%</p>
                    )}
                    {coords.isConfirmed && <p className="mt-2 text-green-400 font-semibold">{t('adminMatchmaking_alreadyConfirmed')}</p>}
                </div>
            );
        }
        return null;
      })}
    </div>
  );
};

export default MatchmakingVisualization;