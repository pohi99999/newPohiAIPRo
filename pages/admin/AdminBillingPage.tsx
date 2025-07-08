// pages/admin/AdminBillingPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import LoadingSpinner from '../../components/LoadingSpinner';
import SimpleBarChart from '../../components/SimpleBarChart';
import AiFeatureButton from '../../components/AiFeatureButton';
import Textarea from '../../components/Textarea';
import { BanknotesIcon, ChartPieIcon, DocumentMagnifyingGlassIcon, CurrencyDollarIcon, PencilSquareIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { ConfirmedMatch, MockCompany, SuccessfulMatchEntry, AiGeneratedInvoice, CommissionSourceAnalysis, MarketPriceCommissionAdvice, UserRole } from '../../types';
import { TranslationKey } from '../../locales';
import { useLocale } from '../../LocaleContext';
import { ai } from '../../lib/gemini';
import { CONFIRMED_MATCHES_STORAGE_KEY, MOCK_COMPANIES_STORAGE_KEY } from '../../constants';
import { GenerateContentResponse } from '@google/genai';

interface AdminBillingState {
  isLoading: Record<string, boolean>;
  confirmedMatches: ConfirmedMatch[];
  mockCompanies: MockCompany[];
  
  // For company-wide invoice
  selectedCompanyForInvoice: string;
  billingPeriodForInvoice: string;
  generatedInvoice: AiGeneratedInvoice | null;
  invoiceError: string | null;

  commissionAnalysis: CommissionSourceAnalysis | null;
  commissionAnalysisError: string | null;
  commissionByProductChartData: SuccessfulMatchEntry[];

  marketPriceProductType: string;
  marketPriceAdvice: MarketPriceCommissionAdvice | null;
  marketPriceError: string | null;

  monthlyCommissionChartData: SuccessfulMatchEntry[];

  // For per-match document generation
  expandedMatchId: string | null;
  generatedDocument: {
    matchId: string;
    type: 'invoice' | 'contract';
    text: string;
  } | null;
  documentError: string | null;
}

export const AdminBillingPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [state, setState] = useState<AdminBillingState>({
    isLoading: {},
    confirmedMatches: [],
    mockCompanies: [],
    selectedCompanyForInvoice: '',
    billingPeriodForInvoice: new Date().toLocaleString(locale === 'hu' ? 'hu-HU' : 'en-US', { month: 'long', year: 'numeric' }),
    generatedInvoice: null,
    invoiceError: null,
    commissionAnalysis: null,
    commissionAnalysisError: null,
    commissionByProductChartData: [],
    marketPriceProductType: t('productType_acaciaDebarkedSandedPost'),
    marketPriceAdvice: null,
    marketPriceError: null,
    monthlyCommissionChartData: [],
    expandedMatchId: null,
    generatedDocument: null,
    documentError: null,
  });

  const loadData = useCallback(() => {
    try {
      const matchesRaw = localStorage.getItem(CONFIRMED_MATCHES_STORAGE_KEY);
      const companiesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
      
      const loadedMatches: ConfirmedMatch[] = matchesRaw ? JSON.parse(matchesRaw) : [];
      loadedMatches.sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
      const loadedCompanies: MockCompany[] = companiesRaw ? JSON.parse(companiesRaw) : [];

      const monthlyCommissions: Record<string, { matchCount: number, totalCommission: number }> = {};
      loadedMatches.forEach(matchItem => {
          const monthYearKey = new Date(matchItem.matchDate).toLocaleString(locale === 'hu' ? 'hu-HU' : 'en-US', { month: 'short', year: 'numeric' });
          if (!monthlyCommissions[monthYearKey]) {
            monthlyCommissions[monthYearKey] = { matchCount: 0, totalCommission: 0 };
          }
          monthlyCommissions[monthYearKey].matchCount++;
          monthlyCommissions[monthYearKey].totalCommission += matchItem.commissionAmount;
      });

      const currentMonthlyCommissionChartData = Object.entries(monthlyCommissions)
        .map(([label, dataValue]) => ({ 
            id: label, 
            label: label,
            matchCount: dataValue.matchCount, 
            totalCommission: parseFloat(dataValue.totalCommission.toFixed(2))
        }))
        .sort((a, b) => {
            const dateA = new Date(a.label.replace(/(\w+)\.?\s(\d{4})/, '$1 1, $2')); 
            const dateB = new Date(b.label.replace(/(\w+)\.?\s(\d{4})/, '$1 1, $2'));
            return dateA.getTime() - dateB.getTime();
        })
        .slice(-6); 


      setState(prev => ({ 
        ...prev, 
        confirmedMatches: loadedMatches, 
        mockCompanies: loadedCompanies,
        monthlyCommissionChartData: currentMonthlyCommissionChartData
      }));
    } catch (errorCaught: any) {
      console.error("Error loading billing data:", errorCaught);
    }
  }, [locale]); 

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setState(prev => ({ ...prev, [name]: value }));
  };
  
  const parseJsonFromGeminiResponse = useCallback(function <T>(textValue: string, featureNameKey: TranslationKey): T | string {
    let jsonStringToParse = textValue.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const matchResult = jsonStringToParse.match(fenceRegex);
    if (matchResult && matchResult[2]) {
      jsonStringToParse = matchResult[2].trim();
    }
    try {
      return JSON.parse(jsonStringToParse) as T;
    } catch (error: any) {
      const featureNameText = t(featureNameKey);
      console.error(`Failed to parse JSON response for ${featureNameText}:`, error, "Raw text:", textValue);
      return t('customerNewDemand_error_failedToParseJson', { featureName: featureNameText, rawResponse: textValue.substring(0,150) });
    }
  }, [t]);
  
  const generateCompanyInvoiceDraft = async () => {
    if (!ai || !state.selectedCompanyForInvoice || !state.billingPeriodForInvoice) {
        setState(prev => ({...prev, invoiceError: t('adminBilling_error_invoiceParamsMissing')}));
        return;
    }
    setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, companyInvoice: true }, generatedInvoice: null, invoiceError: null }));

    const companyDetails = state.mockCompanies.find(c => c.id === state.selectedCompanyForInvoice);
    if (!companyDetails) {
        setState(prev => ({...prev, isLoading: {...prev.isLoading, companyInvoice: false }, invoiceError: t('adminBilling_error_companyNotFound')}));
        return;
    }
    
    const relevantMatches = state.confirmedMatches.filter(matchItem =>
      !matchItem.billed &&
      (matchItem.demandDetails.submittedByCompanyId === companyDetails.id || matchItem.stockDetails.uploadedByCompanyId === companyDetails.id) &&
      new Date(matchItem.matchDate).toLocaleString(locale === 'hu' ? 'hu-HU' : 'en-US', {month: 'long', year: 'numeric'}) === state.billingPeriodForInvoice
    );

    if (relevantMatches.length === 0) {
        setState(prev => ({...prev, isLoading: {...prev.isLoading, companyInvoice: false }, invoiceError: t('adminBilling_error_noUnbilledMatchesForPeriod')}));
        return;
    }

    const totalCommission = relevantMatches.reduce((sum, matchItem) => sum + matchItem.commissionAmount, 0);
    const matchDetailsString = relevantMatches.map(matchItem => `- Match ID: ${matchItem.id.slice(-6)}, Product: ${matchItem.demandDetails.productName || matchItem.demandDetails.diameterType || 'N/A'} ${matchItem.demandDetails.length}m, Commission: ${matchItem.commissionAmount.toFixed(2)} EUR`).join('\n');
    const currentPromptLang: string = locale === 'hu' ? 'Hungarian' : 'English';

    const promptContent = `Generate a professional invoice draft in ${currentPromptLang}.
To: ${companyDetails.companyName}
Address: ${companyDetails.address?.street || ''}, ${companyDetails.address?.zipCode || ''} ${companyDetails.address?.city || ''}, ${companyDetails.address?.country || ''}
Billing Period: ${state.billingPeriodForInvoice}
Invoice for: Platform service fees and commissions on successful Pohi AI Pro matches.

Line Items (summarized from these matches):
${matchDetailsString}

Total Amount Due: ${totalCommission.toFixed(2)} EUR
Payment Terms: Net 30 days.
Pohi AI Pro Platform - Company Details: Pohi AI Pro HQ, Timber Valley 1, 1234 Woodsville, Timberland. VAT ID: TIMBER12345. Bank: Global Timber Bank, Account: TIMBER0012300456.

The response should be the plain text of the invoice draft. Include a unique Invoice ID (e.g., INV-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}). Do not use markdown formatting.`;

    try {
      const genResponse: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: promptContent });
      setState(prev => ({ 
        ...prev, 
        generatedInvoice: {
            companyName: companyDetails.companyName,
            billingPeriod: state.billingPeriodForInvoice,
            invoiceDraftText: genResponse.text,
            relatedMatchIds: relevantMatches.map(m => m.id)
        }
      }));
    } catch (errorCaught: any) {
      console.error("Error generating invoice draft:", errorCaught);
      setState(prev => ({ ...prev, invoiceError: t('adminBilling_error_invoiceGenerationFailed') }));
    } finally {
      setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, companyInvoice: false } }));
    }
  };

  const handleGenerateDocumentForMatch = async (match: ConfirmedMatch, type: 'invoice' | 'contract') => {
    if (!ai) return;

    const operationKey = `${type}-${match.id}`;
    setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, [operationKey]: true }, generatedDocument: null, documentError: null }));

    const customer = state.mockCompanies.find(c => c.id === match.demandDetails.submittedByCompanyId);
    const manufacturer = state.mockCompanies.find(c => c.id === match.stockDetails.uploadedByCompanyId);
    const currentPromptLang: string = locale === 'hu' ? 'Hungarian' : 'English';

    if (!customer || !manufacturer) {
        setState(prev => ({...prev, isLoading: {...prev.isLoading, [operationKey]: false}, documentError: "Customer or Manufacturer details not found for this match."}));
        return;
    }

    let promptContent = '';
    let errorMessageKey: TranslationKey = 'adminBilling_error_invoiceGenerationFailed';

    if (type === 'invoice') {
        errorMessageKey = 'adminBilling_error_invoiceGenerationFailed';
        promptContent = `Generate a professional invoice draft in ${currentPromptLang} for a single transaction.
To: ${match.demandDetails.submittedByCompanyName}
For: Platform service fee for Match ID ${match.id.slice(-8)}.
Line Item: Commission on successful match for "${match.stockDetails.productName || 'timber'}".
Amount Due: ${match.commissionAmount.toFixed(2)} EUR
Payment Terms: Net 15 days.
Provide a unique Invoice ID (e.g., INV-SGL-${match.id.slice(-6)}).
The response should be the plain text of the invoice draft.`;
    } else { // contract
        errorMessageKey = 'adminBilling_error_contractGenerationFailed';
        const totalPrice = (match.stockDetails.price && match.stockDetails.quantity) 
            ? (parseFloat(match.stockDetails.price.replace(/[^\d.]/g, '')) * parseInt(match.stockDetails.quantity)).toFixed(2) + ' EUR' 
            : 'As per separate agreement';
        
        promptContent = `You are an AI assistant for "Pohi AI Pro". Generate a simple sales contract draft in ${currentPromptLang} based on the following confirmed match.

- Seller (Manufacturer):
  - Company Name: ${manufacturer.companyName}
  - Address: ${manufacturer.address?.street || ''}, ${manufacturer.address?.zipCode || ''} ${manufacturer.address?.city || ''}, ${manufacturer.address?.country || ''}
- Buyer (Customer):
  - Company Name: ${customer.companyName}
  - Address: ${customer.address?.street || ''}, ${customer.address?.zipCode || ''} ${customer.address?.city || ''}, ${customer.address?.country || ''}
- Product:
  - Description: ${match.stockDetails.productName || 'Timber Product'}
  - Specifications: Ø${match.stockDetails.diameterFrom}-${match.stockDetails.diameterTo}cm, Length: ${match.stockDetails.length}m
  - Quantity: ${match.stockDetails.quantity} pcs
  - Notes: ${match.stockDetails.notes || 'Standard quality'}
- Purchase Price: ${totalPrice}
- Match Date: ${new Date(match.matchDate).toLocaleDateString()}

The contract draft should include:
1. Parties (Seller, Buyer)
2. Subject of the Contract (product details)
3. Purchase Price and Payment Terms (e.g., "Payment via bank transfer within 15 days of invoice date.")
4. Delivery Terms (e.g., "Delivery will be organized by Pohi AI Pro logistics. Date and time to be coordinated separately.")
5. Signatures section for both parties.
6. A clear disclaimer at the end in all caps: "*** DISCLAIMER: THIS IS AN AI-GENERATED DRAFT. IT IS NOT LEGAL ADVICE. PLEASE HAVE A LEGAL PROFESSIONAL REVIEW THIS DOCUMENT BEFORE SIGNING. ***"

The response should be the plain text of the contract draft. Do not use markdown.`;
    }

    try {
      const genResponse: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: promptContent });
      setState(prev => ({
        ...prev,
        generatedDocument: { matchId: match.id, type, text: genResponse.text }
      }));
    } catch (error) {
      setState(prev => ({ ...prev, documentError: t(errorMessageKey) }));
    } finally {
      setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, [operationKey]: false } }));
    }
  };


  const markAsBilled = () => {
    if (!state.generatedInvoice) return;
    const invoiceIdMatch = state.generatedInvoice.invoiceDraftText.match(/Invoice ID:\s*(INV-\d{4}-\w{5})/i);
    const currentInvoiceId = invoiceIdMatch ? invoiceIdMatch[1] : `MANUAL-${Date.now()}`;

    const updatedMatches = state.confirmedMatches.map(matchItem => {
      if (state.generatedInvoice?.relatedMatchIds.includes(matchItem.id)) {
        return { ...matchItem, billed: true, invoiceId: currentInvoiceId };
      }
      return matchItem;
    });
    localStorage.setItem(CONFIRMED_MATCHES_STORAGE_KEY, JSON.stringify(updatedMatches));
    setState(prev => ({ ...prev, confirmedMatches: updatedMatches, generatedInvoice: null }));
    alert(t('adminBilling_markedAsBilledSuccess'));
    loadData(); 
  };

  const analyzeCommissionSources = async () => {
    if (!ai || state.confirmedMatches.length === 0) {
      setState(prev => ({...prev, commissionAnalysisError: t('adminBilling_error_noMatchesForAnalysis')}));
      return;
    }
    setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, commissionAnalysis: true }, commissionAnalysis: null, commissionAnalysisError: null, commissionByProductChartData: [] }));
    
    const sampleMatches = state.confirmedMatches.slice(0, 30).map(m => ({ 
      productType: m.demandDetails.productName || m.demandDetails.diameterType || 'Unknown Timber', 
      volume: m.demandDetails.cubicMeters || 1,
      commission: m.commissionAmount
    }));
    const currentPromptLang: string = locale === 'hu' ? 'Hungarian' : 'English';

    const promptContent = `Analyze the following sample of confirmed timber trade matches from the Pohi AI Pro platform.
Categorize commission sources by main timber product types (e.g., "Acacia Posts", "Spruce Logs", "Oak Lumber", "Pine Boards", "Beech Firewood"). Try to be specific if possible from the productType field. Estimate the percentage contribution of each main product category to the total commission earned from this sample.
Respond in ${currentPromptLang} with a JSON object where keys are product type strings and values are percentage numbers (integer or one decimal place).
Example: { "Acacia Posts": 45, "Spruce Logs": 30.5, "Other Timber": 24.5 }
Ensure percentages add up to approximately 100.

Sample Matches Data:
${JSON.stringify(sampleMatches, null, 2)}

The response MUST ONLY contain the JSON object.`;

    try {
      const genResponse: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: promptContent, config: {responseMimeType: "application/json"} });
      const parsedResult = parseJsonFromGeminiResponse<CommissionSourceAnalysis>(genResponse.text, "adminBilling_commissionSourceAnalysisTitle" as TranslationKey);
      
      if (typeof parsedResult === 'string') {
        setState(prev => ({ ...prev, commissionAnalysisError: parsedResult }));
      } else {
        const chartDataPoints: SuccessfulMatchEntry[] = Object.entries(parsedResult).map(([productType, percentage]) => ({
            id: productType, 
            label: productType,
            matchCount: 0,
            totalCommission: typeof percentage === 'number' ? percentage : parseFloat(String(percentage)), 
        }));
        setState(prev => ({...prev, commissionAnalysis: parsedResult, commissionByProductChartData: chartDataPoints}));
      }
    } catch (errorCaught: any) {
      console.error("Error analyzing commission sources:", errorCaught);
      setState(prev => ({ ...prev, commissionAnalysisError: t('adminBilling_error_commissionAnalysisFailed') }));
    } finally {
      setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, commissionAnalysis: false } }));
    }
  };

  const getMarketInsights = async () => {
    if (!ai || !state.marketPriceProductType) {
      setState(prev => ({...prev, marketPriceError: t('adminBilling_error_marketInsightsParamsMissing')}));
      return;
    }
    setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, marketInsights: true }, marketPriceAdvice: null, marketPriceError: null }));
    const currentPromptLang: string = locale === 'hu' ? 'Hungarian' : 'English';

    const promptContent = `Provide current market price insights in ${currentPromptLang} for "${state.marketPriceProductType}" in the Central European region.
Based on a typical platform commission rate of 3-8% for successful timber trades, suggest an optimal commission percentage (e.g., "5-7%" or "6%") for Pohi AI Pro for this product type.
Briefly justify your suggestion (1-2 sentences).
Respond in ${currentPromptLang} with a JSON object containing:
- "productType": string (echo back the product type: "${state.marketPriceProductType}")
- "marketPriceInsights": string (the market insights, 2-3 sentences)
- "suggestedCommissionRate": string (e.g., "5-7%" or "6%")
- "justification": string (the justification, 1-2 sentences)

The response MUST ONLY contain the JSON object.`;

    try {
      const genResponse: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: promptContent, config: {responseMimeType: "application/json"} });
      const parsedResult = parseJsonFromGeminiResponse<MarketPriceCommissionAdvice>(genResponse.text, "adminBilling_marketPriceInsightsTitle" as TranslationKey);
      if (typeof parsedResult === 'string') {
        setState(prev => ({ ...prev, marketPriceError: parsedResult }));
      } else {
        setState(prev => ({ ...prev, marketPriceAdvice: parsedResult }));
      }
    } catch (errorCaught: any) {
      console.error("Error getting market insights:", errorCaught);
      setState(prev => ({ ...prev, marketPriceError: t('adminBilling_error_marketInsightsFailed') }));
    } finally {
      setState(prev => ({ ...prev, isLoading: { ...prev.isLoading, marketInsights: false } }));
    }
  };

  const unbilledMatches = state.confirmedMatches.filter(m => !m.billed);
  const companyOptionsForSelect = state.mockCompanies.filter(c => c.role === UserRole.CUSTOMER || c.role === UserRole.MANUFACTURER).map(c => ({ value: c.id, label: c.companyName }));
  const currentTotalMatches = state.confirmedMatches.length;
  const currentTotalCommission = state.confirmedMatches.reduce((sum, m) => sum + m.commissionAmount, 0);
  const currentMonthName = new Date().toLocaleString(locale === 'hu' ? 'hu-HU' : 'en-US', { month: 'long', year: 'numeric' });
  const currentCommissionThisMonth = state.confirmedMatches
    .filter(m => new Date(m.matchDate).toLocaleString(locale === 'hu' ? 'hu-HU' : 'en-US', { month: 'long', year: 'numeric' }) === currentMonthName)
    .reduce((sum, m) => sum + m.commissionAmount, 0);

  const currentMonthlyChartData = state.monthlyCommissionChartData.map(item => ({
    label: item.label, 
    value: item.totalCommission, 
    color: 'text-green-500' 
  }));

  const currentCommissionByProductChartData = state.commissionByProductChartData.map((item, index) => ({
    label: item.label,
    value: item.totalCommission, 
    color: ['text-sky-500', 'text-emerald-500', 'text-amber-500', 'text-rose-500', 'text-indigo-500', 'text-pink-500'][index % 6]
  }));


  return (
    <>
      <PageTitle title={t('adminBilling_title')} subtitle={t('adminBilling_subtitle')} icon={<CurrencyDollarIcon className="h-8 w-8" />} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title={t('adminBilling_revenueOverviewTitle')} className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-center">
                <div>
                    <p className="text-xs text-slate-400 uppercase">{t('adminBilling_totalSuccessfulMatches')}</p>
                    <p className="text-2xl font-bold text-white">{currentTotalMatches}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase">{t('adminBilling_totalCommissionThisMonth', {month: currentMonthName})}</p>
                    <p className="text-2xl font-bold text-green-400">{currentCommissionThisMonth.toFixed(2)} EUR</p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 uppercase">{t('adminBilling_totalCommissionOverall')}</p>
                    <p className="text-2xl font-bold text-cyan-400">{currentTotalCommission.toFixed(2)} EUR</p>
                </div>
            </div>
            {currentMonthlyChartData.length > 0 ? (
                <SimpleBarChart data={currentMonthlyChartData} title={t('adminBilling_monthlyCommissionTrendChartTitle')} showValues="absolute" />
            ) : (
                <p className="text-sm text-center text-slate-400 py-4">{t('adminDashboard_noDataYet')}</p>
            )}
        </Card>
        
        <Card title={t('adminBilling_commissionSourceAnalysisTitle')}>
            <p className="text-sm text-slate-300 mb-3">{t('adminBilling_commissionSourceAnalysisDescription')}</p>
            <AiFeatureButton
                text={t('adminBilling_analyzeCommissionSourcesButton')}
                onClick={analyzeCommissionSources}
                isLoading={state.isLoading.commissionAnalysis}
                leftIcon={<ChartPieIcon className="h-5 w-5" />}
                disabled={!ai || state.confirmedMatches.length === 0 || state.isLoading.commissionAnalysis}
            />
            {state.isLoading.commissionAnalysis && <LoadingSpinner text={t('adminBilling_analyzingCommissions')} />}
            {state.commissionAnalysisError && <p className="text-xs text-red-400 mt-2">{state.commissionAnalysisError}</p>}
            {state.commissionAnalysis && !state.commissionAnalysisError && currentCommissionByProductChartData.length > 0 && (
                <div className="mt-4">
                    <SimpleBarChart 
                        data={currentCommissionByProductChartData} 
                        title={t('adminBilling_commissionByProductChartTitle')} 
                        showValues="percentage" 
                        totalForPercentage={100}
                    />
                </div>
            )}
             {(!state.commissionAnalysis && !state.commissionAnalysisError && !state.isLoading.commissionAnalysis && (state.confirmedMatches.length === 0 || currentCommissionByProductChartData.length === 0)) &&
                <p className="text-xs text-slate-400 mt-2">{t('adminBilling_error_noMatchesForAnalysis')}</p>
            }
        </Card>
      </div>
      
       <Card title={t('adminBilling_unbilledMatchesTitle')} className="mb-6">
        {unbilledMatches.length === 0 ? <p className="text-slate-400 p-2">{t('adminBilling_error_noUnbilledMatchesForPeriod')}</p> : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {unbilledMatches.map(match => (
                    <div key={match.id} className="p-4 bg-slate-700/50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                            <p><strong className="text-slate-300 block">{t('adminBilling_matchId')}</strong><span className="text-cyan-300">{match.id.slice(-8)}</span></p>
                            <p><strong className="text-slate-300 block">{t('adminBilling_customer')}</strong><span className="truncate">{match.demandDetails.submittedByCompanyName}</span></p>
                            <p><strong className="text-slate-300 block">{t('adminBilling_manufacturer')}</strong><span className="truncate">{match.stockDetails.uploadedByCompanyName}</span></p>
                            <p><strong className="text-slate-300 block">{t('adminBilling_product')}</strong><span className="truncate">{match.demandDetails.productName || 'N/A'}</span></p>
                            <p><strong className="text-slate-300 block">{t('adminBilling_commission')}</strong><span className="font-bold text-green-400">{match.commissionAmount.toFixed(2)} EUR</span></p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-600/50">
                             <AiFeatureButton
                                text={t('adminBilling_generateDocumentsButton')}
                                onClick={() => setState(prev => ({...prev, expandedMatchId: prev.expandedMatchId === match.id ? null : match.id, generatedDocument: null, documentError: null}))}
                                size="sm"
                                className="!py-1"
                            />
                            {state.expandedMatchId === match.id && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                     <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleGenerateDocumentForMatch(match, 'invoice')}
                                        isLoading={state.isLoading[`invoice-${match.id}`]}
                                        disabled={Object.values(state.isLoading).some(Boolean)}
                                        leftIcon={<BanknotesIcon className="h-4 w-4" />}
                                    >{t('adminBilling_singleInvoiceButton')}</Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleGenerateDocumentForMatch(match, 'contract')}
                                        isLoading={state.isLoading[`contract-${match.id}`]}
                                        disabled={Object.values(state.isLoading).some(Boolean)}
                                        leftIcon={<DocumentTextIcon className="h-4 w-4" />}
                                    >{t('adminBilling_generateContractDraftButton')}</Button>
                                </div>
                            )}
                             {state.isLoading[`invoice-${match.id}`] && <LoadingSpinner text={t('adminBilling_generatingInvoice')} />}
                             {state.isLoading[`contract-${match.id}`] && <LoadingSpinner text={t('adminBilling_generatingContract')} />}

                             {state.generatedDocument?.matchId === match.id && (
                                <div className="mt-3">
                                    <h5 className="font-semibold text-cyan-300 text-sm mb-1">
                                        {state.generatedDocument.type === 'invoice' ? t('adminBilling_singleInvoiceTitle', {matchId: match.id.slice(-8)}) : t('adminBilling_contractDraftTitle', {matchId: match.id.slice(-8)})}
                                    </h5>
                                    <Textarea value={state.generatedDocument.text} readOnly rows={12} className="text-xs" />
                                </div>
                             )}
                              {state.documentError && state.expandedMatchId === match.id && <p className="text-xs text-red-400 mt-2">{state.documentError}</p>}
                        </div>
                    </div>
                ))}
            </div>
        )}
       </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title={t('adminBilling_invoiceGenerationTitle')}>
            <p className="text-sm text-slate-300 mb-3">{t('adminBilling_invoiceGenerationDescription')}</p>
            <Select label={t('adminBilling_selectCompanyForInvoice')} name="selectedCompanyForInvoice" options={companyOptionsForSelect} value={state.selectedCompanyForInvoice} onChange={handleInputChange} />
            <Input label={t('adminBilling_billingPeriodForInvoice')} name="billingPeriodForInvoice" value={state.billingPeriodForInvoice} onChange={handleInputChange} placeholder={t('adminBilling_billingPeriodPlaceholder')} />
            <AiFeatureButton
                text={t('adminBilling_generateInvoiceDraftButton')}
                onClick={generateCompanyInvoiceDraft}
                isLoading={state.isLoading.companyInvoice}
                leftIcon={<PencilSquareIcon className="h-5 w-5" />}
                disabled={!ai || !state.selectedCompanyForInvoice || !state.billingPeriodForInvoice || state.isLoading.companyInvoice}
            />
            {state.isLoading.companyInvoice && <LoadingSpinner text={t('adminBilling_generatingInvoice')} />}
            {state.invoiceError && <p className="text-xs text-red-400 mt-2">{state.invoiceError}</p>}
            {state.generatedInvoice && !state.invoiceError && (
                <div className="mt-4 space-y-3">
                    <h4 className="text-md font-semibold text-cyan-300">{t('adminBilling_generatedInvoiceDraftTitle', {company: state.generatedInvoice.companyName, period: state.generatedInvoice.billingPeriod})}</h4>
                    <pre className="text-xs bg-slate-700 p-3 rounded whitespace-pre-wrap max-h-80 overflow-y-auto custom-scrollbar">{state.generatedInvoice.invoiceDraftText}</pre>
                    <Button onClick={markAsBilled} variant="secondary" size="sm">{t('adminBilling_markAsBilledButton')}</Button>
                </div>
            )}
        </Card>

        <Card title={t('adminBilling_marketPriceInsightsTitle')}>
            <p className="text-sm text-slate-300 mb-3">{t('adminBilling_marketPriceInsightsDescription')}</p>
            <Input label={t('adminBilling_productTypeForMarketInsights')} name="marketPriceProductType" value={state.marketPriceProductType} onChange={handleInputChange} placeholder={t('adminBilling_productTypePlaceholder')} />
             <AiFeatureButton
                text={t('adminBilling_getMarketInsightsButton')}
                onClick={getMarketInsights}
                isLoading={state.isLoading.marketInsights}
                leftIcon={<DocumentMagnifyingGlassIcon className="h-5 w-5" />}
                disabled={!ai || !state.marketPriceProductType || state.isLoading.marketInsights}
            />
            {state.isLoading.marketInsights && <LoadingSpinner text={t('adminBilling_fetchingMarketInsights')} />}
            {state.marketPriceError && <p className="text-xs text-red-400 mt-2">{state.marketPriceError}</p>}
            {state.marketPriceAdvice && !state.marketPriceError && (
                 <div className="mt-4 space-y-2 text-sm">
                    <h4 className="text-md font-semibold text-cyan-300">{t('adminBilling_marketInsightsForProductTitle', {product: state.marketPriceAdvice.productType})}</h4>
                    <p><strong className="text-slate-100">{t('adminBilling_marketPriceInsightsLabel')}:</strong> <span className="text-slate-300">{state.marketPriceAdvice.marketPriceInsights}</span></p>
                    <p><strong className="text-slate-100">{t('adminBilling_suggestedCommissionRateLabel')}:</strong> <span className="text-green-400 font-semibold">{state.marketPriceAdvice.suggestedCommissionRate}</span></p>
                    <p><strong className="text-slate-100">{t('adminBilling_justificationLabel')}:</strong> <span className="text-slate-300">{state.marketPriceAdvice.justification}</span></p>
                </div>
            )}
        </Card>
      </div>
    </>
  );
};