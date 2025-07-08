// pages/manufacturer/ManufacturerMatchesPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { DemandItem, StockItem, MatchmakingSuggestion, StockStatus, DemandStatus, UserRole, ConfirmedMatch, MockCompany } from '../../types';
import { useAppContext } from '../../App';
import { useLocale } from '../../LocaleContext';
import { MOCK_AI_RESPONSES, CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY, MOCK_COMPANIES_STORAGE_KEY, MATCH_INTERESTS_STORAGE_KEY, CONFIRMED_MATCHES_STORAGE_KEY } from '../../constants';
import { CheckBadgeIcon, InformationCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface MatchInterest {
    matchId: string;
    userId: string;
}

const getMatchStrengthColor = (strength?: string, score?: number): string => {
    if (typeof score === 'number') {
      if (score >= 0.8) return 'text-green-400';
      if (score >= 0.5) return 'text-yellow-400';
      return 'text-red-400';
    }
    if (strength) {
      const lowerStrength = strength.toLowerCase();
      if (lowerStrength.includes('high')) return 'text-green-400';
      if (lowerStrength.includes('medium')) return 'text-yellow-400';
      return 'text-red-400';
    }
    return 'text-cyan-400';
};

const ItemDetails: React.FC<{ item: DemandItem | StockItem, type: 'demand' | 'stock' }> = ({ item, type }) => {
    const { t } = useLocale();
    const isDemand = type === 'demand';
    
    return (
        <div className={`p-3 rounded-lg ${isDemand ? 'bg-slate-600/50' : 'bg-slate-700/50'}`}>
            <p className="font-semibold text-sm text-slate-200">{item.productName || 'N/A'}</p>
            <p className="text-xs text-slate-300">Ø{item.diameterFrom}-{item.diameterTo}cm, {item.length}m, {item.quantity}pcs</p>
            <p className="text-xs text-slate-400">~{item.cubicMeters?.toFixed(2)} m³</p>
            {'price' in item && item.price && <p className="text-xs text-green-300 mt-1">{item.price}</p>}
            {item.notes && <p className="text-xs text-slate-400 italic mt-1 truncate" title={item.notes}>"{item.notes}"</p>}
        </div>
    );
};

const ManufacturerMatchesPage: React.FC = () => {
    const { t } = useLocale();
    const { userRole } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [myStock, setMyStock] = useState<StockItem[]>([]);
    const [allDemands, setAllDemands] = useState<DemandItem[]>([]);
    const [suggestions, setSuggestions] = useState<MatchmakingSuggestion[]>([]);
    const [interests, setInterests] = useState<MatchInterest[]>([]);
    const [currentUser, setCurrentUser] = useState<MockCompany | { id: string, name: string } | null>(null);

    const loadAndProcessData = useCallback(() => {
        setIsLoading(true);
        try {
            const demandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
            const stockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
            const companiesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
            const interestsRaw = localStorage.getItem(MATCH_INTERESTS_STORAGE_KEY);
            
            const allUserStock: StockItem[] = stockRaw ? JSON.parse(stockRaw) : [];
            const companies: MockCompany[] = companiesRaw ? JSON.parse(companiesRaw) : [];
            const userCompany = companies.find(c => c.role === userRole) || { id: userRole!, name: userRole! };

            setCurrentUser(userCompany);
            setMyStock(allUserStock.filter(s => (s.uploadedByCompanyId === userCompany.id || !s.uploadedByCompanyId) && s.status === StockStatus.AVAILABLE));
            setAllDemands(demandsRaw ? JSON.parse(demandsRaw) : []);
            setInterests(interestsRaw ? JSON.parse(interestsRaw) : []);

            // Simulating fetching suggestions
            const mockSuggestions = MOCK_AI_RESPONSES.matchmakingSuggestions;
            setSuggestions(mockSuggestions);

        } catch (e) {
            console.error("Error loading data for matches page:", e);
        } finally {
            setIsLoading(false);
        }
    }, [userRole]);

    useEffect(() => {
        loadAndProcessData();
    }, [loadAndProcessData]);

    const createConfirmedMatch = (suggestion: MatchmakingSuggestion, partnerId: string) => {
        const demand = allDemands.find(d => d.id === suggestion.demandId);
        const stock = myStock.find(s => s.id === suggestion.stockId);
        if (!demand || !stock || !currentUser) return;
    
        const commissionRate = 0.05;
        let calculatedCommissionAmount = 0;
        if (stock.price) {
            const priceMatch = stock.price.match(/(\d+(\.\d+)?)\s*EUR\/(m³|db|pcs)/i);
            if (priceMatch) {
                const priceValue = parseFloat(priceMatch[1]);
                const priceUnit = priceMatch[3].toLowerCase();
                if ((priceUnit === 'm³' || priceUnit === 'm3') && stock.cubicMeters) {
                    calculatedCommissionAmount = priceValue * stock.cubicMeters * commissionRate;
                } else if ((priceUnit === 'db' || priceUnit === 'pcs') && stock.quantity) {
                    calculatedCommissionAmount = priceValue * parseInt(stock.quantity) * commissionRate;
                }
            }
        }
        calculatedCommissionAmount = parseFloat(calculatedCommissionAmount.toFixed(2));
    
        const newConfirmedMatch: ConfirmedMatch = {
            id: `CONF-${Date.now()}-${demand.id.slice(-4)}-${stock.id?.slice(-4)}`,
            demandId: demand.id,
            demandDetails: { ...demand },
            stockId: stock.id!,
            stockDetails: { ...stock },
            matchDate: new Date().toISOString(),
            commissionRate,
            commissionAmount: calculatedCommissionAmount,
            billed: false,
        };
    
        const allDemandsFromStorage: DemandItem[] = JSON.parse(localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY) || '[]');
        const updatedDemands = allDemandsFromStorage.map(d => d.id === demand.id ? { ...d, status: DemandStatus.PROCESSING } : d);
        localStorage.setItem(CUSTOMER_DEMANDS_STORAGE_KEY, JSON.stringify(updatedDemands));

        const allStockItems: StockItem[] = JSON.parse(localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY) || '[]');
        const updatedStock = allStockItems.map(s => s.id === stock.id ? { ...s, status: StockStatus.RESERVED } : s);
        localStorage.setItem(MANUFACTURER_STOCK_STORAGE_KEY, JSON.stringify(updatedStock));

        const allConfirmed: ConfirmedMatch[] = JSON.parse(localStorage.getItem(CONFIRMED_MATCHES_STORAGE_KEY) || '[]');
        localStorage.setItem(CONFIRMED_MATCHES_STORAGE_KEY, JSON.stringify([newConfirmedMatch, ...allConfirmed]));

        const updatedInterests = interests.filter(i => i.matchId !== suggestion.id);
        localStorage.setItem(MATCH_INTERESTS_STORAGE_KEY, JSON.stringify(updatedInterests));

        alert(t('matches_dealCreated_title') + '\n' + t('matches_dealCreated_body'));
        loadAndProcessData();
    };

    const handleConfirmInterest = (suggestion: MatchmakingSuggestion) => {
        if (!currentUser) return;
        
        const newInterest: MatchInterest = { matchId: suggestion.id, userId: currentUser.id };
        const updatedInterests = [...interests.filter(i => !(i.matchId === suggestion.id && i.userId === currentUser.id)), newInterest];

        setInterests(updatedInterests);
        localStorage.setItem(MATCH_INTERESTS_STORAGE_KEY, JSON.stringify(updatedInterests));

        const demandItem = allDemands.find(d => d.id === suggestion.demandId);
        const partnerId = demandItem?.submittedByCompanyId || 'customer-user-01'; // Fallback for prototype

        if (partnerId) {
            const partnerInterestExists = updatedInterests.some(i => i.matchId === suggestion.id && i.userId === partnerId);
            if (partnerInterestExists) {
                createConfirmedMatch(suggestion, partnerId);
            }
        }
    };
    
    const relevantSuggestions = useMemo(() => {
        const myStockIds = new Set(myStock.map(s => s.id));
        return suggestions
            .filter(s => myStockIds.has(s.stockId))
            .filter(s => {
                const demandItem = allDemands.find(d => d.id === s.demandId);
                return demandItem && demandItem.status === DemandStatus.RECEIVED;
            });
    }, [myStock, suggestions, allDemands]);

    if (isLoading) {
        return <LoadingSpinner text={t('manufacturerMyStock_loadingStock')} />;
    }

    return (
        <>
            <PageTitle title={t('manufacturerMatches_title')} subtitle={t('manufacturerMatches_subtitle')} icon={<CheckBadgeIcon className="h-8 w-8" />} />
            {relevantSuggestions.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <InformationCircleIcon className="h-16 w-16 text-cyan-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white">{t('matches_noSuggestions')}</h3>
                        <p className="text-slate-400 mt-2">{t('matches_suggestionsExplanation')}</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-6">
                    {relevantSuggestions.map(suggestion => {
                        const stock = myStock.find(s => s.id === suggestion.stockId);
                        const demand = allDemands.find(d => d.id === suggestion.demandId);
                        if (!stock || !demand) return null;

                        const isConfirmedByMe = interests.some(i => i.matchId === suggestion.id && i.userId === currentUser?.id);

                        return (
                            <Card key={suggestion.id} className="hover-glow transition-all duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                                    <div>
                                        <h4 className="text-md font-semibold text-emerald-300 mb-2">{t('matches_yourStock')}</h4>
                                        <ItemDetails item={stock} type="stock" />
                                    </div>
                                    <div className="text-center my-4 md:my-0">
                                        <PaperAirplaneIcon className={`h-8 w-8 mx-auto transform rotate-45 ${getMatchStrengthColor(suggestion.matchStrength, suggestion.similarityScore)}`} />
                                        <p className={`text-sm font-bold mt-1 ${getMatchStrengthColor(suggestion.matchStrength, suggestion.similarityScore)}`}>
                                            {suggestion.matchStrength} ({((suggestion.similarityScore || 0) * 100).toFixed(0)}%)
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-md font-semibold text-sky-300 mb-2">{t('matches_suggestedDemand')}</h4>
                                        <ItemDetails item={demand} type="demand" />
                                         <p className="text-xs text-slate-400 mt-1">{t('matches_byCompany', {companyName: demand.submittedByCompanyName || 'N/A'})}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <h5 className="text-sm font-semibold text-yellow-300">{t('matches_aiReason')}</h5>
                                    <p className="text-sm text-slate-200 mt-1 mb-3">{suggestion.reason}</p>
                                    <Button
                                        onClick={() => handleConfirmInterest(suggestion)}
                                        disabled={isConfirmedByMe}
                                        className={isConfirmedByMe ? 'bg-green-700 hover:bg-green-700 cursor-not-allowed' : ''}
                                        leftIcon={isConfirmedByMe ? <CheckBadgeIcon className="h-5 w-5"/> : <PaperAirplaneIcon className="h-5 w-5"/>}
                                    >
                                        {isConfirmedByMe ? t('matches_interestConfirmed') : t('matches_confirmInterest')}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default ManufacturerMatchesPage;