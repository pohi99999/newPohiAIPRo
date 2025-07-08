

import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import AiFeatureButton from '../../components/AiFeatureButton';
import { DemandItem, DemandStatus, AiStockSuggestion, StockItem, StockStatus } from '../../types';
import { DocumentTextIcon, InformationCircleIcon, CalendarDaysIcon, HashtagIcon, ArchiveBoxIcon, BeakerIcon, SparklesIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useLocale } from '../../LocaleContext';
import { getTranslatedDemandStatus } from '../../locales';
import type { TranslationKey } from '../../locales';
import { CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants';
import { GenerateContentResponse } from "@google/genai";
import { ai } from '../../lib/gemini';

const getDemandStatusBadgeColor = (status: DemandStatus): string => {
  switch (status) {
    case DemandStatus.RECEIVED:
      return 'bg-sky-500 text-sky-50';
    case DemandStatus.PROCESSING:
      return 'bg-amber-500 text-amber-50';
    case DemandStatus.COMPLETED:
      return 'bg-green-500 text-green-50';
    case DemandStatus.CANCELLED:
      return 'bg-red-500 text-red-50';
    default:
      return 'bg-slate-500 text-slate-50';
  }
};

const CustomerMyDemandsPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [explanationLoading, setExplanationLoading] = useState<string | null>(null);
  const [statusExplanations, setStatusExplanations] = useState<Record<string, string>>({});

  const [suggestionLoading, setSuggestionLoading] = useState<string | null>(null);
  const [stockSuggestions, setStockSuggestions] = useState<Record<string, AiStockSuggestion[] | string>>({});
  const [allStock, setAllStock] = useState<StockItem[]>([]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
      const allDemands: DemandItem[] = storedDemandsRaw ? JSON.parse(storedDemandsRaw) : [];
      // Assuming a customer view would not show company-specific demands from admin
      const ownDemands = allDemands.filter(item => !item.submittedByCompanyId);
      ownDemands.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
      setDemands(ownDemands);
      
      const storedStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
      const allStockItems: StockItem[] = storedStockRaw ? JSON.parse(storedStockRaw) : [];
      setAllStock(allStockItems);

    } catch (error) {
      console.error("Error loading demands:", error);
    }
    setIsLoading(false);
  }, []);

  const explainDemandStatusWithGemini = useCallback(async (demand: DemandItem): Promise<string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');

    const productDetails = `${demand.productName || demand.diameterType}, Ø${demand.diameterFrom}-${demand.diameterTo}cm, Length: ${demand.length}m`;
    const promptLang = locale === 'hu' ? 'Hungarian' : (locale === 'de' ? 'German' : 'English');
    const translatedStatus = getTranslatedDemandStatus(demand.status, t);
    
    const prompt = `As an AI assistant for a timber marketplace, explain what the status "${translatedStatus}" means for the customer's demand in ${promptLang}.
Keep it concise (1-2 sentences) and reassuring.
Demand Details:
- Product: ${productDetails}
- Status: ${translatedStatus}
The response should only contain the explanation text.`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return response.text || t('customerMyDemands_error_failedToGenerateExplanation');
    } catch (error) {
      console.error("Error generating status explanation with Gemini:", error);
      return t('customerMyDemands_error_aiStatusExplanationGeneric');
    }
  }, [ai, locale, t]);
  
  const handleExplainStatus = async (demand: DemandItem) => {
    if (explanationLoading) return;
    if (statusExplanations[demand.id]) {
      setStatusExplanations(prev => {
        const newExplanations = { ...prev };
        delete newExplanations[demand.id];
        return newExplanations;
      });
      return;
    }
    setExplanationLoading(demand.id);
    const result = await explainDemandStatusWithGemini(demand);
    setStatusExplanations(prev => ({ ...prev, [demand.id]: result }));
    setExplanationLoading(null);
  };
  
  const suggestStockForDemandWithGemini = useCallback(async (demand: DemandItem): Promise<AiStockSuggestion[] | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');
    
    const availableStock = allStock.filter(s => s.status === StockStatus.AVAILABLE);
    if (availableStock.length === 0) {
      return t('customerMyDemands_ai_suggestStock_noStockAvailable');
    }
    
    const summarizedStock = availableStock.slice(0, 20).map(s => ({
        stockItemId: s.id,
        productName: s.productName,
        dimensions: `Ø${s.diameterFrom}-${s.diameterTo}cm, ${s.length}m, ${s.quantity}pcs`,
        notes: s.notes
    }));

    const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
    const prompt = `You are an AI matchmaking assistant for a timber marketplace.
A customer has the following demand:
- Demand ID: ${demand.id}
- Product: ${demand.productName}, Ø${demand.diameterFrom}-${demand.diameterTo}cm, ${demand.length}m, ${demand.quantity}pcs
- Notes: ${demand.notes}

Based on this demand, find the best matching stock items from the list of available stock below.
Provide your response as a JSON array of objects, where each object has these fields:
- "stockItemId": string (the ID of the matching stock item)
- "reason": string (a concise explanation in ${promptLang} of why this is a good match)
- "matchStrength": string (a qualitative assessment like "High", "Medium", "Low")
- "similarityScore": number (a numeric score from 0.0 to 1.0)

Return up to 3 best matches. If no good matches are found, return an empty array.
The response MUST ONLY contain the JSON array.

Available Stock:
${JSON.stringify(summarizedStock, null, 2)}`;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const parsedResult = JSON.parse(response.text.replace(/^```json\n?/, '').replace(/\n?```$/, ''));
        if (Array.isArray(parsedResult)) {
            return parsedResult as AiStockSuggestion[];
        }
        return t('customerNewDemand_error_aiResponseNotArray');
    } catch(e) {
        console.error("Error generating stock suggestions", e);
        return t('customerMyDemands_ai_suggestStock_errorGeneric');
    }

  }, [ai, locale, t, allStock]);

  const handleSuggestStock = async (demand: DemandItem) => {
    if (suggestionLoading) return;
    if (stockSuggestions[demand.id]) {
      setStockSuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[demand.id];
        return newSuggestions;
      });
      return;
    }
    setSuggestionLoading(demand.id);
    const result = await suggestStockForDemandWithGemini(demand);
    setStockSuggestions(prev => ({ ...prev, [demand.id]: result }));
    setSuggestionLoading(null);
  };
  
  if (isLoading) {
    return (
      <>
        <PageTitle title={t('customerMyDemands_title')} subtitle={t('customerMyDemands_subtitle')} icon={<DocumentTextIcon className="h-8 w-8" />} />
        <LoadingSpinner text={t('customerMyDemands_loadingDemands')} />
      </>
    );
  }

  return (
    <>
      <PageTitle title={t('customerMyDemands_title')} subtitle={t('customerMyDemands_subtitle')} icon={<DocumentTextIcon className="h-8 w-8" />} />
      
      {demands.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <InformationCircleIcon className="h-16 w-16 text-cyan-500 mx-auto mb-4" />
            <p className="text-slate-300 text-lg">{t('customerMyDemands_noDemands')}</p>
            <p className="text-slate-400 text-sm mt-2">{t('customerMyDemands_submitNewDemandPrompt')}</p>
            <Button variant="primary" size="md" className="mt-6">
              <NavLink to="/customer/new-demand">{t('menu_customer_new_demand')}</NavLink>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demands.map(demand => (
            <Card key={demand.id} className="flex flex-col justify-between hover-glow transition-shadow duration-300">
              <div>
                <div className="p-4 border-b border-slate-700">
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-semibold text-cyan-400 flex items-center">
                        <HashtagIcon className="h-5 w-5 mr-2 text-cyan-500" />
                        {t('customerMyDemands_demandId')}: {demand.id?.substring(0, 12)}...
                        </h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getDemandStatusBadgeColor(demand.status)}`}>
                            {getTranslatedDemandStatus(demand.status, t)}
                        </span>
                    </div>
                     <p className="text-xs text-slate-400 flex items-center mt-1">
                        <CalendarDaysIcon className="h-4 w-4 mr-1 text-slate-500" />
                        {t('customerMyDemands_submitted')}: {new Date(demand.submissionDate).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                     </p>
                  </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start text-sm text-slate-300">
                    <ArchiveBoxIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium text-slate-100">{t('customerMyDemands_features')}:</span> {demand.productName}, {demand.diameterType}, Ø {demand.diameterFrom}-{demand.diameterTo}cm, {t('customerNewDemand_length').toLowerCase()}: {demand.length}m, {demand.quantity}pcs
                    </span>
                  </div>
                   <div className="flex items-center text-sm text-slate-300">
                    <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0" />
                    <span>
                        <span className="font-medium text-slate-100">{t('customerMyDemands_cubicMeters')}:</span> {demand.cubicMeters?.toFixed(3) || 'N/A'} m³
                    </span>
                  </div>
                  {demand.notes && (
                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400">{t('notes')}:</p>
                      <p className="text-sm text-slate-300 break-words">{demand.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-2">
                <AiFeatureButton
                    text={statusExplanations[demand.id] ? t('customerMyDemands_ai_hideExplanation') : t('customerMyDemands_ai_requestStatusExplanation')}
                    onClick={() => handleExplainStatus(demand)}
                    isLoading={explanationLoading === demand.id}
                    disabled={!!explanationLoading && explanationLoading !== demand.id}
                    leftIcon={<InformationCircleIcon className="h-5 w-5 text-yellow-400" />}
                />
                 {explanationLoading === demand.id && <LoadingSpinner text={t('customerMyDemands_ai_analysisInProgress')} />}
                 {statusExplanations[demand.id] && explanationLoading !== demand.id && (
                    <div className="text-xs text-slate-200 p-2 bg-slate-700 rounded">
                        <strong className="text-cyan-300">{t('customerMyDemands_ai_explanationTitle')}</strong> {statusExplanations[demand.id]}
                    </div>
                 )}
                 <AiFeatureButton
                    text={stockSuggestions[demand.id] ? t('customerMyDemands_ai_suggestStock_hideSuggestions') : t('customerMyDemands_ai_suggestStock_button')}
                    onClick={() => handleSuggestStock(demand)}
                    isLoading={suggestionLoading === demand.id}
                    disabled={!!suggestionLoading && suggestionLoading !== demand.id}
                    leftIcon={<EyeIcon className="h-5 w-5 text-purple-400" />}
                 />
                 {suggestionLoading === demand.id && <LoadingSpinner text={t('customerMyDemands_ai_suggestStock_loading')} />}
                 {stockSuggestions[demand.id] && suggestionLoading !== demand.id && (
                    <div className="mt-2 space-y-2">
                      <h5 className="font-semibold text-cyan-300 text-sm">{t('customerMyDemands_ai_suggestStock_title')}</h5>
                      {typeof stockSuggestions[demand.id] === 'string' ? (
                          <p className="text-red-300 text-xs p-2 bg-red-900/30 rounded">{stockSuggestions[demand.id] as string}</p>
                      ) : (stockSuggestions[demand.id] as AiStockSuggestion[]).length === 0 ? (
                          <p className="text-slate-400 text-xs">{t('customerMyDemands_ai_suggestStock_noMatches')}</p>
                      ) : (
                          (stockSuggestions[demand.id] as AiStockSuggestion[]).map(suggestion => {
                              const stockItem = allStock.find(s => s.id === suggestion.stockItemId);
                              if (!stockItem) return <p key={suggestion.stockItemId} className="text-xs text-red-400">{t('customerMyDemands_ai_suggestStock_stockItemDetailsNotFound', {id: suggestion.stockItemId})}</p>
                              return (
                                  <div key={suggestion.stockItemId} className="p-2 bg-slate-700 rounded text-xs space-y-1">
                                    <p className="font-semibold text-emerald-300">{stockItem.productName}</p>
                                    <p>{`Ø${stockItem.diameterFrom}-${stockItem.diameterTo}cm, ${stockItem.length}m, ${stockItem.quantity}pcs`}</p>
                                    <p className="italic text-slate-300">"{suggestion.reason}"</p>
                                    <p className="text-yellow-300">Match: {suggestion.matchStrength} ({(suggestion.similarityScore * 100).toFixed(0)}%)</p>
                                  </div>
                              )
                          })
                      )}
                    </div>
                 )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default CustomerMyDemandsPage;