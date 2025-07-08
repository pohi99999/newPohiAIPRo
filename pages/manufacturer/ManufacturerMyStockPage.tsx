import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { StockItem, StockStatus, ListingQualityFeedback } from '../../types';
import { CubeTransparentIcon, InformationCircleIcon, CalendarDaysIcon, HashtagIcon, ArchiveBoxIcon, BeakerIcon, BanknotesIcon, ShieldCheckIcon, BuildingStorefrontIcon, CheckBadgeIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useLocale } from '../../LocaleContext';
import { getTranslatedStockStatus } from '../../locales';
import { MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants';
import AiFeatureButton from '../../components/AiFeatureButton';
import { GenerateContentResponse } from "@google/genai";
import { ai } from '../../lib/gemini';
import type { TranslationKey } from '../../locales';

const getStockStatusBadgeColor = (status?: StockStatus): string => {
  if (!status) return 'bg-slate-500 text-slate-50';
  switch (status) {
    case StockStatus.AVAILABLE:
      return 'bg-green-600 text-green-50';
    case StockStatus.RESERVED:
      return 'bg-yellow-500 text-yellow-50';
    case StockStatus.SOLD:
      return 'bg-red-600 text-red-50';
    default:
      return 'bg-slate-500 text-slate-50';
  }
};

const ManufacturerMyStockPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qualityCheckLoading, setQualityCheckLoading] = useState<string | null>(null);
  const [qualityCheckResults, setQualityCheckResults] = useState<Record<string, ListingQualityFeedback | string>>({});

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
      if (storedStockRaw) {
        const parsedStock: StockItem[] = JSON.parse(storedStockRaw);
        const ownStock = parsedStock.filter(item => !item.uploadedByCompanyId);
        ownStock.sort((a, b) => {
            if (a.uploadDate && b.uploadDate) {
                return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
            }
            return 0;
        });
        setStockItems(ownStock);
      }
    } catch (error) {
      console.error("Error loading stock items:", error);
    }
    setIsLoading(false);
  }, []);
  
  const parseJsonFromGeminiResponse = useCallback(function <T>(textValue: string, featureNameKey: TranslationKey): T | string {
    let jsonStrToParse = textValue.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const matchResult = jsonStrToParse.match(fenceRegex);
    if (matchResult && matchResult[2]) {
      jsonStrToParse = matchResult[2].trim();
    }
    try {
      return JSON.parse(jsonStrToParse) as T;
    } catch (error: any) {
      const featureNameText = t(featureNameKey);
      console.error(`Failed to parse JSON response for ${featureNameText}:`, error, "Raw text:", textValue);
      return t('customerNewDemand_error_failedToParseJson', { featureName: featureNameText, rawResponse: textValue.substring(0,100) });
    }
  }, [t]);

  const analyzeListingQualityWithGemini = useCallback(async (item: StockItem): Promise<ListingQualityFeedback | string> => {
    if (!ai) return t('customerNewDemand_error_aiUnavailable');

    const productDetails = `Product: ${item.productName || item.diameterType}, Ø${item.diameterFrom}-${item.diameterTo}cm, Length: ${item.length}m, Quantity: ${item.quantity}pcs`;
    const promptLang = locale === 'hu' ? 'Hungarian' : (locale === 'de' ? 'German' : 'English');
    
    const prompt = `As a timber marketplace expert, analyze the following stock listing from a manufacturer. Provide feedback to help them improve it.
The response must be a JSON object with these exact keys:
- "score": A numerical score from 0 to 100, where 100 is a perfect listing. Score is based on completeness, clarity, and appeal. A good listing has a specific product name, all dimensions, a price, notes on quality/use, and sustainability info. A bad listing is generic and missing key details.
- "overallFeedback": A single, concise sentence summarizing the quality of the listing in ${promptLang}.
- "positivePoints": A JSON array of 1-3 strings in ${promptLang}, highlighting what is good about the listing.
- "areasForImprovement": A JSON array of 1-3 strings in ${promptLang}, suggesting specific, actionable improvements.

Listing Data to Analyze:
- Product Details: ${productDetails}
- Price: ${item.price || 'Not specified'}
- Sustainability Info: ${item.sustainabilityInfo || 'Not specified'}
- Notes: ${item.notes || 'Not specified'}

The response MUST ONLY be the valid JSON object. Do not include any other text or markdown.`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const parsedResult = parseJsonFromGeminiResponse<ListingQualityFeedback>(response.text, "manufacturerMyStock_ai_qualityCheck_resultsTitle" as TranslationKey);

      if (typeof parsedResult === 'string') {
        return parsedResult;
      }

      if (typeof parsedResult.score !== 'number' || typeof parsedResult.overallFeedback !== 'string' || !Array.isArray(parsedResult.positivePoints) || !Array.isArray(parsedResult.areasForImprovement)) {
        throw new Error("Invalid JSON structure from AI.");
      }
      return parsedResult;

    } catch (error) {
      console.error("Error generating listing quality check with Gemini:", error);
      return t('manufacturerMyStock_error_qualityCheckGeneric');
    }
  }, [ai, locale, t, parseJsonFromGeminiResponse]);
  
  const handleQualityCheck = async (item: StockItem) => {
    if (!item.id) return;
    if (qualityCheckLoading) return;

    if (qualityCheckResults[item.id]) {
      setQualityCheckResults(prev => {
        const newResults = { ...prev };
        delete newResults[item.id!];
        return newResults;
      });
      return;
    }

    setQualityCheckLoading(item.id);
    const result = await analyzeListingQualityWithGemini(item);
    setQualityCheckResults(prev => ({ ...prev, [item.id!]: result }));
    setQualityCheckLoading(null);
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <>
        <PageTitle title={t('manufacturerMyStock_title')} subtitle={t('manufacturerMyStock_subtitle')} icon={<CubeTransparentIcon className="h-8 w-8" />} />
        <LoadingSpinner text={t('manufacturerMyStock_loadingStock')} />
      </>
    );
  }

  return (
    <>
      <PageTitle title={t('manufacturerMyStock_title')} subtitle={t('manufacturerMyStock_subtitle')} icon={<CubeTransparentIcon className="h-8 w-8" />} />
      
      {stockItems.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <InformationCircleIcon className="h-16 w-16 text-cyan-500 mx-auto mb-4" />
            <p className="text-slate-300 text-lg">{t('manufacturerMyStock_noStock')}</p>
            <p className="text-slate-400 text-sm mt-2">{t('manufacturerMyStock_uploadNewStockPrompt')}</p>
            <Button variant="primary" size="md" className="mt-6">
              <NavLink to="/manufacturer/new-stock">{t('menu_manufacturer_new_stock')}</NavLink>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stockItems.map(item => (
            <Card key={item.id} className="flex flex-col justify-between hover-glow transition-shadow duration-300">
              <div>
                <div className="p-4 border-b border-slate-700">
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-semibold text-cyan-400 flex items-center">
                        <HashtagIcon className="h-5 w-5 mr-2 text-cyan-500" />
                        {t('manufacturerMyStock_stockId')}: {item.id?.substring(0, 10)}...
                        </h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStockStatusBadgeColor(item.status)}`}>
                            {getTranslatedStockStatus(item.status, t)}
                        </span>
                    </div>
                     {item.uploadDate && (
                        <p className="text-xs text-slate-400 flex items-center mt-1">
                        <CalendarDaysIcon className="h-4 w-4 mr-1 text-slate-500" />
                        {t('manufacturerMyStock_uploaded')}: {new Date(item.uploadDate).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                     )}
                     {item.uploadedByCompanyName && (
                        <p className="text-xs text-slate-400 flex items-center mt-1">
                            <BuildingStorefrontIcon className="h-4 w-4 mr-1 text-slate-500" />
                             {t('manufacturerMyStock_byCompany', { companyName: item.uploadedByCompanyName })}
                        </p>
                     )}
                  </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start text-sm text-slate-300">
                    <ArchiveBoxIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium text-slate-100">{t('customerMyDemands_features')}:</span> {item.diameterType}, Ø {item.diameterFrom}-{item.diameterTo}cm, {t('customerNewDemand_length').toLowerCase()}: {item.length}m, {item.quantity}pcs
                    </span>
                  </div>
                   <div className="flex items-center text-sm text-slate-300">
                    <BeakerIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0" />
                    <span>
                        <span className="font-medium text-slate-100">{t('customerMyDemands_cubicMeters')}:</span> {item.cubicMeters?.toFixed(3) || 'N/A'} m³
                    </span>
                  </div>
                  {item.price && (
                    <div className="flex items-center text-sm text-slate-300">
                        <BanknotesIcon className="h-5 w-5 mr-2 text-cyan-400 shrink-0" />
                        <span>
                            <span className="font-medium text-slate-100">{t('manufacturerMyStock_price')}:</span> {item.price}
                        </span>
                    </div>
                  )}
                   {item.sustainabilityInfo && (
                    <div className="flex items-start text-sm text-slate-300">
                        <ShieldCheckIcon className="h-5 w-5 mr-2 text-green-400 shrink-0 mt-0.5" />
                        <span>
                            <span className="font-medium text-slate-100">{t('manufacturerMyStock_sustainability')}:</span> {item.sustainabilityInfo.length > 70 ? `${item.sustainabilityInfo.substring(0, 70)}...` : item.sustainabilityInfo}
                        </span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400">{t('notes')}:</p>
                      <p className="text-sm text-slate-300 break-words">{item.notes.length > 100 ? `${item.notes.substring(0, 100)}...` : item.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                <AiFeatureButton
                    text={qualityCheckResults[item.id!] ? t('manufacturerMyStock_ai_hideQualityCheck') : t('manufacturerMyStock_ai_qualityCheck')}
                    onClick={() => handleQualityCheck(item)}
                    isLoading={qualityCheckLoading === item.id}
                    disabled={!!qualityCheckLoading && qualityCheckLoading !== item.id}
                    leftIcon={<CheckBadgeIcon className="h-5 w-5 text-yellow-400" />}
                />
                 {qualityCheckLoading === item.id && <LoadingSpinner text={t('manufacturerMyStock_ai_qualityCheck_loading')} />}
                 {qualityCheckResults[item.id!] && qualityCheckLoading !== item.id && (
                    <div className="mt-3 text-xs text-slate-200 space-y-2">
                        {typeof qualityCheckResults[item.id!] === 'string' ? (
                            <p className="text-red-300">{qualityCheckResults[item.id!] as string}</p>
                        ) : (
                            <div className="space-y-2">
                                <h5 className="font-semibold text-cyan-300">{t('manufacturerMyStock_ai_qualityCheck_resultsTitle')}</h5>
                                <div>
                                    <strong className="text-slate-100">{t('manufacturerMyStock_ai_qualityScore')}:</strong>
                                    <span className={`font-bold text-base ml-2 ${getScoreColor((qualityCheckResults[item.id!] as ListingQualityFeedback).score)}`}>
                                        {(qualityCheckResults[item.id!] as ListingQualityFeedback).score} / 100
                                    </span>
                                </div>
                                <div>
                                    <p><strong className="text-slate-100">{t('manufacturerMyStock_ai_overallFeedback')}:</strong> {(qualityCheckResults[item.id!] as ListingQualityFeedback).overallFeedback}</p>
                                </div>
                                 {(qualityCheckResults[item.id!] as ListingQualityFeedback).positivePoints?.length > 0 && <div>
                                    <strong className="text-green-300">{t('manufacturerMyStock_ai_positivePoints')}:</strong>
                                    <ul className="list-disc list-inside pl-2">
                                    {(qualityCheckResults[item.id!] as ListingQualityFeedback).positivePoints.map((point, i) => <li key={`pos-${i}`}>{point}</li>)}
                                    </ul>
                                </div>}
                                {(qualityCheckResults[item.id!] as ListingQualityFeedback).areasForImprovement?.length > 0 && <div>
                                    <strong className="text-yellow-300">{t('manufacturerMyStock_ai_areasForImprovement')}:</strong>
                                    <ul className="list-disc list-inside pl-2">
                                    {(qualityCheckResults[item.id!] as ListingQualityFeedback).areasForImprovement.map((point, i) => <li key={`imp-${i}`}>{point}</li>)}
                                    </ul>
                                </div>}
                            </div>
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

export default ManufacturerMyStockPage;