

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import AiFeatureButton from '../../components/AiFeatureButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import VisualTruckLoad from '../../components/VisualTruckLoad';
import SimulatedRouteMap from '../../components/SimulatedRouteMap';
import Textarea from '../../components/Textarea';
import InteractiveLocationMap from '../../components/InteractiveLocationMap'; 
import { 
    MockCompany, UserRole, 
    LoadingPlan, ConfirmedMatch, LoadingPlanItem, LoadingPlanResponse,
    DemandItem, StockItem, DemandStatus, StockStatus
} from '../../types';
import { TranslationKey, getTranslatedUserRole, getTranslatedDemandStatus, getTranslatedStockStatus } from '../../locales'; 
import { 
    ClipboardDocumentListIcon, RocketLaunchIcon, UserIcon, BuildingStorefrontIcon, XMarkIcon, ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { useLocale } from '../../LocaleContext';
import { MOCK_COMPANIES_STORAGE_KEY, CONFIRMED_MATCHES_STORAGE_KEY, CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants';
import { ai } from '../../lib/gemini';
import { GenerateContentResponse } from "@google/genai";
import { generateMockConfirmedMatches } from '../../lib/utils';
import Button from '../../components/Button';

interface LogisticsHubState {
  companies: MockCompany[];
  isLoading: boolean;
  isSimulationLoading: boolean;
  simulatedLoadingPlan: LoadingPlan | null;
  simulatedCarrierEmail: string | null;
  simulationError: string | null;
  selectedCompany: MockCompany | null;
  selectedCompanyData: (DemandItem | StockItem)[];
  isDetailLoading: boolean;
}

const DetailsPanel: React.FC<{
    company: MockCompany;
    data: (DemandItem | StockItem)[];
    isLoading: boolean;
    onClose: () => void;
}> = ({ company, data, isLoading, onClose }) => {
    const { t } = useLocale();
    const navigate = useNavigate();

    const handleViewFullDetails = () => {
        const path = company.role === UserRole.CUSTOMER
            ? `/admin/logistics-hub/customer/${company.id}`
            : `/admin/logistics-hub/manufacturer/${company.id}`;
        navigate(path);
    };
    
    const isCustomer = company.role === UserRole.CUSTOMER;

    return (
        <Card title={t('logisticsHub_detailsPanel_title', {companyName: company.companyName})} className="h-full flex flex-col">
            <div className="absolute top-2 right-2">
                <Button onClick={onClose} variant="ghost" size="sm" className="!p-1.5" aria-label={t('cancel')}>
                    <XMarkIcon className="h-5 w-5" />
                </Button>
            </div>
            {isLoading ? <LoadingSpinner text={t('logisticsHub_detailsPanel_loading')} /> : (
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 -mr-2">
                    <div className="text-sm space-y-2 mb-4">
                        <p className="flex items-center"><strong className="w-24 shrink-0 text-slate-400">{t('role')}</strong> <span className="flex items-center">{isCustomer ? <UserIcon className="h-4 w-4 mr-1 text-sky-400"/> : <BuildingStorefrontIcon className="h-4 w-4 mr-1 text-emerald-400"/>} {getTranslatedUserRole(company.role, t)}</span></p>
                        <p className="flex items-center"><strong className="w-24 shrink-0 text-slate-400">{t('city')}</strong> <span>{company.address?.city || t('logisticsHub_data_not_available_short')}</span></p>
                        <p className="flex items-center"><strong className="w-24 shrink-0 text-slate-400">{t('country')}</strong> <span>{company.address?.country || t('logisticsHub_data_not_available_short')}</span></p>
                    </div>
                    
                    <h4 className="font-semibold text-cyan-300 border-t border-slate-700 pt-3 mt-3 mb-2">{isCustomer ? t('logisticsHub_status_customer_activeOrders') : t('logisticsHub_status_manufacturer_activeStock')}</h4>
                    
                    {data.length === 0 ? <p className="text-xs text-slate-400">{t('logisticsHub_detailsPanel_noActivity')}</p> : (
                        <ul className="space-y-2">
                           {data.map(item => (
                                <li key={item.id} className="p-2 bg-slate-700/50 rounded-md text-xs">
                                    <p className="font-semibold text-slate-200 truncate">{item.productName || item.diameterType}</p>
                                    <p className="text-slate-300">Ø{item.diameterFrom}-{item.diameterTo}cm, {item.length}m, {item.quantity}pcs</p>
                                    <div className="flex justify-between items-center mt-1 text-slate-400">
                                       <span>ID: {item.id?.slice(0,12)}...</span>
                                       {isCustomer ? 
                                         <span className={`px-2 py-0.5 rounded-full text-[10px] ${ (item as DemandItem).status === DemandStatus.RECEIVED ? 'bg-sky-500/80' : 'bg-slate-500/80'}`}>{getTranslatedDemandStatus((item as DemandItem).status, t)}</span>
                                         :
                                         <span className={`px-2 py-0.5 rounded-full text-[10px] ${ (item as StockItem).status === StockStatus.AVAILABLE ? 'bg-green-600/80' : 'bg-slate-500/80'}`}>{getTranslatedStockStatus((item as StockItem).status, t)}</span>
                                       }
                                    </div>
                                </li>
                           ))}
                        </ul>
                    )}
                </div>
            )}
            <div className="pt-4 border-t border-slate-700 mt-auto">
                <Button onClick={handleViewFullDetails} size="sm" variant="secondary" className="w-full" rightIcon={<ArrowTopRightOnSquareIcon className="h-4 w-4"/>}>
                    {t('logisticsHub_detailsPanel_viewFullDetails')}
                </Button>
            </div>
        </Card>
    );
};


export const AdminLogisticsHubPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [state, setState] = useState<LogisticsHubState>({
    companies: [],
    isLoading: true,
    isSimulationLoading: false,
    simulatedLoadingPlan: null,
    simulatedCarrierEmail: null,
    simulationError: null,
    selectedCompany: null,
    selectedCompanyData: [],
    isDetailLoading: false,
  });

  useEffect(() => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const companiesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
      const allCompanies: MockCompany[] = companiesRaw ? JSON.parse(companiesRaw) : [];
      
      setState(prev => ({
        ...prev,
        companies: allCompanies,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error loading data for Logistics Hub:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);
  
  const handleCompanySelect = useCallback((company: MockCompany) => {
    setState(prev => ({ ...prev, selectedCompany: company, isDetailLoading: true, selectedCompanyData: [] }));
    
    try {
        if (company.role === UserRole.CUSTOMER) {
            const demandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
            const allDemands: DemandItem[] = demandsRaw ? JSON.parse(demandsRaw) : [];
            const companyData = allDemands.filter(d => d.submittedByCompanyId === company.id && d.status === DemandStatus.RECEIVED);
            setState(prev => ({ ...prev, selectedCompanyData: companyData, isDetailLoading: false }));
        } else if (company.role === UserRole.MANUFACTURER) {
            const stockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
            const allStock: StockItem[] = stockRaw ? JSON.parse(stockRaw) : [];
            const companyData = allStock.filter(s => s.uploadedByCompanyId === company.id && s.status === StockStatus.AVAILABLE);
             setState(prev => ({ ...prev, selectedCompanyData: companyData, isDetailLoading: false }));
        }
    } catch(e) {
        console.error("Error loading details for selected company", e);
        setState(prev => ({ ...prev, isDetailLoading: false }));
    }

  }, []);

  const parseJsonFromGeminiResponse = useCallback(function <T>(textValue: string, featureNameKey: TranslationKey): T | string {
    let jsonStr = textValue.trim(); 
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const matchResult = jsonStr.match(fenceRegex); 
    if (matchResult && matchResult[2]) {
      jsonStr = matchResult[2].trim();
    }
    try {
      return JSON.parse(jsonStr) as T;
    } catch (errorCaught: any) { 
      const featureNameText = t(featureNameKey);
      console.error(`Failed to parse JSON response for ${featureNameText}:`, errorCaught, "Raw text:", textValue);
      return t('adminTruckPlanning_error_parsing_truck', { featureName: featureNameText, rawResponse: textValue.substring(0,300) });
    }
  }, [t]);

  const runAiTruckPlanningSimulation = async () => {
    if (!ai) {
      setState(prev => ({ ...prev, simulationError: t('customerNewDemand_error_aiUnavailable'), isSimulationLoading: false }));
      return;
    }
    setState(prev => ({ ...prev, isSimulationLoading: true, simulatedLoadingPlan: null, simulatedCarrierEmail: null, simulationError: null }));

    let matchesForPlanning: ConfirmedMatch[] = [];
    try {
        const matchesRaw = localStorage.getItem(CONFIRMED_MATCHES_STORAGE_KEY);
        const allConfirmedMatches: ConfirmedMatch[] = matchesRaw ? JSON.parse(matchesRaw) : [];
        matchesForPlanning = allConfirmedMatches.filter(m => !m.billed);

        if (matchesForPlanning.length < 2) { // Need at least a couple of items for meaningful planning
            console.log("Insufficient real matches, generating mock matches for simulation.");
            const customersForSim = state.companies.filter(c => c.role === UserRole.CUSTOMER);
            const manufacturersForSim = state.companies.filter(c => c.role === UserRole.MANUFACTURER);
            matchesForPlanning = generateMockConfirmedMatches(3, customersForSim, manufacturersForSim, t); // Generate 3 mock matches
        }
    } catch(e) {
        console.error("Error preparing matches for simulation:", e);
        setState(prev => ({ ...prev, simulationError: "Error preparing data for simulation.", isSimulationLoading: false }));
        return;
    }
    
    if (matchesForPlanning.length === 0) {
      setState(prev => ({ ...prev, simulationError: t('adminTruckPlanning_error_noMatchesForPlanning'), isSimulationLoading: false }));
      return;
    }

    const pickupPoints = matchesForPlanning.map(match => {
        const manufacturer = state.companies.find(m => m.id === match.stockDetails.uploadedByCompanyId);
        return {
            companyName: manufacturer?.companyName || match.stockDetails.uploadedByCompanyName || 'Ismeretlen Gyártó',
            address: manufacturer?.address ? `${manufacturer.address.street || t('logisticsHub_data_not_available_short')}, ${manufacturer.address.zipCode || ''} ${manufacturer.address.city || t('logisticsHub_data_not_available_short')}, ${manufacturer.address.country || t('logisticsHub_data_not_available_short')}`.replace(/^,|,$/g, '').trim() : t('logisticsHub_data_not_available_short'),
            items: [{ 
                productName: match.stockDetails.productName || t('productType_acaciaDebarkedSandedPost'),
                quantity: match.stockDetails.quantity,
                volumeM3: match.stockDetails.cubicMeters?.toFixed(2) || 'N/A',
                stockId: match.stockId,
            }]
        };
    });

    const dropoffPoints = matchesForPlanning.map(match => {
        const customer = state.companies.find(c => c.id === match.demandDetails.submittedByCompanyId);
        return {
            companyName: customer?.companyName || match.demandDetails.submittedByCompanyName || 'Ismeretlen Vevő',
            address: customer?.address ? `${customer.address.street || t('logisticsHub_data_not_available_short')}, ${customer.address.zipCode || ''} ${customer.address.city || t('logisticsHub_data_not_available_short')}, ${customer.address.country || t('logisticsHub_data_not_available_short')}`.replace(/^,|,$/g, '').trim() : t('logisticsHub_data_not_available_short'),
            items: [{ 
                productName: match.demandDetails.productName || t('productType_acaciaDebarkedSandedPost'),
                quantity: match.demandDetails.quantity,
                volumeM3: match.demandDetails.cubicMeters?.toFixed(2) || 'N/A',
                demandId: match.demandId,
            }]
        };
    });
    
    const currentPromptLang: string = locale === 'hu' ? 'Hungarian' : 'English';
    const productNameKey: TranslationKey = 'productType_acaciaDebarkedSandedPost'; 
    const resolvedProductName: string = t(productNameKey);

    const planPrompt = `You are a logistics planner for "Pohi AI Pro". Create an optimal loading and transport plan for a 25m³ (approx. 24-ton) truck in ${currentPromptLang}.
The transport involves consolidating items for multiple Customers, picked up from multiple Manufacturers.
Products are timber, primarily ${resolvedProductName}.

Pickup locations and items:
${JSON.stringify(pickupPoints, null, 2)}

Drop-off locations and items:
${JSON.stringify(dropoffPoints, null, 2)}

The response MUST be a valid JSON object in ${currentPromptLang} with fields:
- "planDetails": A string summary of the plan.
- "items": A JSON array of LoadingPlanItem objects. Each must include: "name", "volumeM3", "destinationName", "dropOffOrder", "loadingSuggestion", "quality", "notesOnItem", "demandId", "stockId", "companyId".
- "capacityUsed": A string percentage.
- "waypoints": A JSON array of Waypoint objects. Each must include: "name", "type" (string: "pickup" or "dropoff"), and "order" (number).
- "optimizedRouteDescription": A string describing the route.

CRITICAL: The response must ONLY contain the JSON object. Do not include any other text, explanations, or markdown formatting. The JSON must be perfectly valid. Ensure all objects in JSON arrays are correctly separated by commas.
`;

    try {
      const planResponse: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: planPrompt,
        config: { responseMimeType: "application/json" }
      });
      
      const parsedPlan = parseJsonFromGeminiResponse<LoadingPlanResponse>(planResponse.text, "adminTruckPlanning_optimalLoadingPlan" as TranslationKey);

      if (typeof parsedPlan === 'string') {
        setState(prev => ({ ...prev, simulationError: parsedPlan, isSimulationLoading: false }));
        return;
      }
      
      const isItemsValid = parsedPlan.items && (
        typeof parsedPlan.items === 'string' || 
        (Array.isArray(parsedPlan.items) && (parsedPlan.items.length === 0 || typeof parsedPlan.items[0] === 'object'))
      );
      const areWaypointsValid = !parsedPlan.waypoints || Array.isArray(parsedPlan.waypoints);

      if (!isItemsValid || !areWaypointsValid) {
        setState(prev => ({ ...prev, simulationError: "AI returned an invalid plan structure for items or waypoints.", isSimulationLoading: false }));
        return;
      }
      
      const finalPlan: LoadingPlan = { ...parsedPlan, id: `SIM-${Date.now()}` };
      setState(prev => ({ ...prev, simulatedLoadingPlan: finalPlan }));

      // Generate Carrier Email
      const emailPrompt = `Based on the following timber loading plan, draft a professional email in ${currentPromptLang} to a generic carrier ("Tisztelt Fuvarozó Partnerünk!" or "Dear Carrier Partner,") to order transport.
Plan Summary: ${finalPlan.planDetails}
Route: ${finalPlan.optimizedRouteDescription || 'Details to follow'}
Key Items: ${ (Array.isArray(finalPlan.items) && finalPlan.items.length > 0 && typeof finalPlan.items[0] === 'object') ? (finalPlan.items as LoadingPlanItem[]).slice(0,2).map(it => it.name).join(', ') : resolvedProductName }
The response should ONLY be the email text.`;
      
      const emailResponse: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: emailPrompt });
      setState(prev => ({ ...prev, simulatedCarrierEmail: emailResponse.text || t('adminShippingTemplates_error_emailGeneric') }));

    } catch (error: any) {
      console.error("Error during AI truck planning simulation:", error);
      setState(prev => ({ ...prev, simulationError: error.message || t('adminTruckPlanning_error_critical_truck', {featureName: 'Simulation'}), isSimulationLoading: false }));
    } finally {
      setState(prev => ({ ...prev, isSimulationLoading: false }));
    }
  };


  if (state.isLoading) {
    return <LoadingSpinner text={t('adminMatchmaking_loadingCompanyData')} />;
  }

  return (
    <>
      <PageTitle title={t('logisticsHub_title')} subtitle={t('logisticsHub_subtitle')} icon={<ClipboardDocumentListIcon className="h-8 w-8" />} />
      
      <div className={`grid grid-cols-1 ${state.selectedCompany ? 'lg:grid-cols-3' : ''} gap-6 mb-6 transition-all duration-500`}>
          <div className={`${state.selectedCompany ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <Card title={t('logisticsHub_interactiveMapTitle')}>
                <InteractiveLocationMap 
                    companies={state.companies}
                    onSelectCompany={handleCompanySelect}
                    selectedCompanyId={state.selectedCompany?.id || null}
                />
            </Card>
          </div>
          {state.selectedCompany && (
            <div className="lg:col-span-1 animate-fade-in">
                <DetailsPanel 
                    company={state.selectedCompany}
                    data={state.selectedCompanyData}
                    isLoading={state.isDetailLoading}
                    onClose={() => setState(prev => ({ ...prev, selectedCompany: null }))}
                />
            </div>
          )}
      </div>


      <Card title={t('logisticsHub_truckPlanningTitle')} className="mt-6">
          <p className="text-sm text-slate-300 mb-3">{t('logisticsHub_truckPlanningDescription')}</p>
          <AiFeatureButton
            text={t('logisticsHub_runSimulationButton')}
            onClick={runAiTruckPlanningSimulation}
            isLoading={state.isSimulationLoading}
            leftIcon={<RocketLaunchIcon className="h-5 w-5 text-purple-400" />}
            disabled={!ai}
          />
          {state.isSimulationLoading && <LoadingSpinner text={t('logisticsHub_simulationLoading')} />}
          {state.simulationError && <p className="text-sm text-red-400 mt-2">{state.simulationError}</p>}
          
          {state.simulatedLoadingPlan && !state.isSimulationLoading && (
            <div className="mt-4 space-y-6">
                <h3 className="text-lg font-semibold text-cyan-300">{t('logisticsHub_sim_resultsTitle')}</h3>
                <VisualTruckLoad items={Array.isArray(state.simulatedLoadingPlan.items) ? state.simulatedLoadingPlan.items as LoadingPlanItem[] : []} planDetails={state.simulatedLoadingPlan.planDetails} />
                <SimulatedRouteMap companies={state.companies} waypoints={state.simulatedLoadingPlan.waypoints || []} optimizedRouteDescription={state.simulatedLoadingPlan.optimizedRouteDescription} />
                
                <Card title={t('logisticsHub_sim_planSummaryTitle')} className="bg-slate-700/30">
                     <p className="text-sm text-slate-200"><strong>{t('adminTruckPlanning_planDetails')}</strong> {state.simulatedLoadingPlan.planDetails}</p>
                     {Array.isArray(state.simulatedLoadingPlan.items) && (state.simulatedLoadingPlan.items as LoadingPlanItem[]).length > 0 && (
                        <div>
                            <h6 className="text-sm font-semibold text-slate-100 mt-2">{t('adminTruckPlanning_planItems')}</h6>
                            <ul className="space-y-1 mt-1 text-xs max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                {(state.simulatedLoadingPlan.items as LoadingPlanItem[]).map((item, index) => (
                                    <li key={index} className="p-1.5 bg-slate-600/40 rounded">
                                        <span className="font-medium text-cyan-400 block">{item.name}</span>
                                        <span className="text-slate-300">Vol: {item.volumeM3}, Dest: {item.destinationName}, Order: {item.dropOffOrder}</span>
                                        {item.loadingSuggestion && <p className="text-slate-400 italic text-[11px]">"{item.loadingSuggestion}"</p>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                     )}
                     <p className="text-sm text-slate-200 mt-2"><strong>{t('adminTruckPlanning_planCapacityUsed')}</strong> {state.simulatedLoadingPlan.capacityUsed}</p>
                </Card>

                {state.simulatedCarrierEmail && (
                    <Card title={t('logisticsHub_sim_carrierEmailTitle')} className="bg-slate-700/30">
                        <Textarea value={state.simulatedCarrierEmail} readOnly rows={8} textareaClassName="text-xs"/>
                    </Card>
                )}
            </div>
          )}
      </Card>
    </>
  );
};