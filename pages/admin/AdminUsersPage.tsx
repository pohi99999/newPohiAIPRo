// pages/admin/AdminUsersPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GenerateContentResponse } from "@google/genai";
import { BeakerIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, UsersIcon as UsersIconOutline, UserPlusIcon } from '@heroicons/react/24/outline';
import { ai } from '../../lib/gemini';
import { calculateVolume } from '../../lib/utils';
import { useLocale } from '../../LocaleContext';
import { getTranslatedUserRole } from '../../locales';
import type { TranslationKey } from '../../locales';
import { UserRole, MockCompany, DemandStatus, StockStatus, DemandItem, StockItem } from '../../types';
import { MOCK_COMPANIES_STORAGE_KEY, CUSTOMER_DEMANDS_STORAGE_KEY, MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants';

import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Textarea from '../../components/Textarea';
import LoadingSpinner from '../../components/LoadingSpinner';
import AiFeatureButton from '../../components/AiFeatureButton';
import SortableDataTable, { Column } from '../../components/SortableDataTable';

interface GeneratedDataReport {
  newCustomers: number;
  newManufacturers: number;
  newDemands: number;
  newStockItems: number;
  productName: string;
  scenarioInfo?: string;
}

const initialNewCompanyState: Partial<MockCompany> & { address: Partial<MockCompany['address']> } = {
  companyName: '',
  role: UserRole.CUSTOMER,
  address: {
    street: '',
    city: '',
    zipCode: '',
    country: '',
  },
};

export const AdminUsersPage: React.FC = () => {
    const { t, locale } = useLocale();
    const [companies, setCompanies] = useState<MockCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [newCompany, setNewCompany] = useState(initialNewCompanyState);
    const [formError, setFormError] = useState<string | null>(null);

    const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
    const [aiRecipientType, setAiRecipientType] = useState<'customer' | 'manufacturer' | 'all'>('customer');
    const [aiScenario, setAiScenario] = useState('');
    const [aiGeneratedDraft, setAiGeneratedDraft] = useState<string | null>(null);

    const [aiTextToCheck, setAiTextToCheck] = useState('');
    const [aiCheckResult, setAiCheckResult] = useState<string | null>(null);

    const [dataGenerationLoading, setDataGenerationLoading] = useState(false);
    const [generatedDataReport, setGeneratedDataReport] = useState<GeneratedDataReport | null>(null);

    const loadData = useCallback(() => {
        setIsLoading(true);
        try {
            const companiesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
            setCompanies(companiesRaw ? JSON.parse(companiesRaw) : []);
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleNewCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewCompany(prev => ({ ...prev, [name]: value }));
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewCompany(prev => ({
            ...prev,
            address: {
                ...prev.address,
                [name]: value,
            }
        }));
    };

    const handleAddNewCompany = () => {
        if (!newCompany.companyName || !newCompany.role) {
            setFormError(t('adminUsers_error_formIncomplete'));
            return;
        }
        if (companies.some(c => c.companyName?.toLowerCase() === newCompany.companyName?.toLowerCase())) {
            setFormError(t('adminUsers_error_companyNameExists'));
            return;
        }

        const newCompanyEntry: MockCompany = {
            id: `comp-${Date.now()}`,
            companyName: newCompany.companyName!,
            role: newCompany.role as UserRole.CUSTOMER | UserRole.MANUFACTURER,
            address: {
                street: newCompany.address?.street,
                city: newCompany.address?.city,
                zipCode: newCompany.address?.zipCode,
                country: newCompany.address?.country,
                latitude: 47.4979 + (Math.random() - 0.5) * 2, // Randomize around Budapest
                longitude: 19.0402 + (Math.random() - 0.5) * 4,
            }
        };

        const updatedCompanies = [...companies, newCompanyEntry];
        localStorage.setItem(MOCK_COMPANIES_STORAGE_KEY, JSON.stringify(updatedCompanies));
        setCompanies(updatedCompanies);
        setNewCompany(initialNewCompanyState);
        setFormError(null);
        alert(t('adminUsers_companyAddedSuccess', { companyName: newCompanyEntry.companyName }));
    };
    
    const handleGenerateMessageDraft = async () => {
        if (!ai || !aiScenario.trim()) {
            setAiGeneratedDraft(t('adminUsers_error_enterScenario'));
            return;
        }
        setAiLoading(prev => ({ ...prev, draft: true }));
        setAiGeneratedDraft(null);

        const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
        const prompt = `You are an AI assistant for a timber marketplace. A platform admin needs to send a message.
Recipient type: ${aiRecipientType}
Scenario/Purpose: ${aiScenario}
Generate a polite, professional, and concise message draft in ${promptLang}.
The response should only contain the message draft text.`;

        try {
            const response: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
            setAiGeneratedDraft(response.text);
        } catch (e) {
            setAiGeneratedDraft(t('adminUsers_error_messageDraftGeneric'));
        } finally {
            setAiLoading(prev => ({ ...prev, draft: false }));
        }
    };
    
    const handleCheckContent = async () => {
        if (!ai || !aiTextToCheck.trim()) {
            setAiCheckResult(t('adminUsers_error_enterTextToCheck'));
            return;
        }
        setAiLoading(prev => ({ ...prev, check: true }));
        setAiCheckResult(null);
        const promptLang = locale === 'hu' ? 'Hungarian' : 'English';
        const prompt = `As a content policy AI for a timber marketplace, check if the following text is appropriate.
The text should be professional, not contain offensive language, and be relevant to the timber trade.
Provide a one-sentence assessment in ${promptLang}, starting with "${t('adminUsers_contentPolicy_passed')}" or "${t('adminUsers_contentPolicy_reviewNeeded')}". If review is needed, add a brief suggestion.
Text to check: "${aiTextToCheck}"`;
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
            setAiCheckResult(response.text);
        } catch (e) {
            setAiCheckResult(t('adminUsers_error_contentCheckGeneric'));
        } finally {
            setAiLoading(prev => ({ ...prev, check: false }));
        }
    };

    const handleGenerateSimulatedData = () => {
        setDataGenerationLoading(true);
        setGeneratedDataReport(null);
    
        setTimeout(() => {
            let currentMockCompanies: MockCompany[] = JSON.parse(localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY) || '[]');
            const productName = t('productType_acaciaDebarkedSandedPost' as TranslationKey); 
            const existingCompanyNames = new Set(currentMockCompanies.map(c => c.companyName.toLowerCase()));
    
            const scenarioCompanies = [
                { nameKey: "scenario_customer_A_name", role: UserRole.CUSTOMER },
                { nameKey: "scenario_customer_B_name", role: UserRole.CUSTOMER },
                { nameKey: "scenario_manufacturer_X_name", role: UserRole.MANUFACTURER },
                { nameKey: "scenario_manufacturer_Y_name", role: UserRole.MANUFACTURER },
                { nameKey: "scenario_manufacturer_Z_name", role: UserRole.MANUFACTURER },
            ];
            
            const sampleCitiesHu = [t('city_sample_2' as TranslationKey), t('city_sample_3' as TranslationKey), t('city_sample_4' as TranslationKey), t('city_sample_5' as TranslationKey), t('city_sample_6' as TranslationKey)];
            const sampleCitiesRo = [t('city_sample_1' as TranslationKey)];
            const sampleCountries = [t('country_sample_hu' as TranslationKey), t('country_sample_ro' as TranslationKey)]; 
            let scenarioCompanyObjects: Record<string, MockCompany> = {};
            
            let newCustomersCount = 0;
            let newManufacturersCount = 0;
    
            scenarioCompanies.forEach((sc, index) => {
                const companyName = t(sc.nameKey as TranslationKey);
                let company = currentMockCompanies.find(c => c.companyName === companyName);
                if (!company) {
                    const country = sampleCountries[index % sampleCountries.length];
                    const cityPool = country === t('country_sample_ro' as TranslationKey) ? sampleCitiesRo : sampleCitiesHu;
                    company = {
                        id: `comp-scen-${sc.role.slice(0,3).toLowerCase()}-${Date.now()}-${index}`,
                        companyName: companyName,
                        role: sc.role as UserRole.CUSTOMER | UserRole.MANUFACTURER,
                        address: {
                            street: `${index + 1} Scenario St.`,
                            city: cityPool[index % cityPool.length],
                            zipCode: `${3000 + index * 10}`,
                            country: country,
                            latitude: 47.4979 + (Math.random() - 0.5) * (country === t('country_sample_ro' as TranslationKey) ? 3 : 2),
                            longitude: 19.0402 + (Math.random() - 0.5) * (country === t('country_sample_ro' as TranslationKey) ? 6 : 4),
                        }
                    };
                    currentMockCompanies.push(company);
                    existingCompanyNames.add(companyName.toLowerCase());
                    if (sc.role === UserRole.CUSTOMER) newCustomersCount++;
                    else if (sc.role === UserRole.MANUFACTURER) newManufacturersCount++;
                }
                scenarioCompanyObjects[sc.nameKey] = company;
            });
    
            const scenarioDemands: DemandItem[] = [
                { id: `DEM-SCEN-A-${Date.now()}`, productName, diameterType: 'mid', diameterFrom: '14', diameterTo: '18', length: '3', quantity: '166', cubicMeters: calculateVolume(14, 18, 3, 166), notes: t('scenario_demand_note_A' as TranslationKey), status: DemandStatus.RECEIVED, submissionDate: new Date().toISOString(), submittedByCompanyId: scenarioCompanyObjects["scenario_customer_A_name"].id, submittedByCompanyName: scenarioCompanyObjects["scenario_customer_A_name"].companyName },
                { id: `DEM-SCEN-B-${Date.now()}`, productName, diameterType: 'mid', diameterFrom: '12', diameterTo: '16', length: '2.5', quantity: '290', cubicMeters: calculateVolume(12, 16, 2.5, 290), notes: t('scenario_demand_note_B' as TranslationKey), status: DemandStatus.RECEIVED, submissionDate: new Date().toISOString(), submittedByCompanyId: scenarioCompanyObjects["scenario_customer_B_name"].id, submittedByCompanyName: scenarioCompanyObjects["scenario_customer_B_name"].companyName }
            ];
    
            const scenarioStockItems: StockItem[] = [
                { id: `STK-SCEN-X-${Date.now()}`, productName, diameterType: 'mid', diameterFrom: '14', diameterTo: '18', length: '3', quantity: '133', price: '22 EUR/db', cubicMeters: calculateVolume(14, 18, 3, 133), notes: t('scenario_stock_note_X' as TranslationKey), sustainabilityInfo: "PEFC", status: StockStatus.AVAILABLE, uploadDate: new Date().toISOString(), uploadedByCompanyId: scenarioCompanyObjects["scenario_manufacturer_X_name"].id, uploadedByCompanyName: scenarioCompanyObjects["scenario_manufacturer_X_name"].companyName },
                { id: `STK-SCEN-Y-${Date.now()}`, productName, diameterType: 'mid', diameterFrom: '12', diameterTo: '16', length: '2.5', quantity: '145', price: '19 EUR/db', cubicMeters: calculateVolume(12, 16, 2.5, 145), notes: t('scenario_stock_note_Y' as TranslationKey), sustainabilityInfo: "FSC Mix", status: StockStatus.AVAILABLE, uploadDate: new Date().toISOString(), uploadedByCompanyId: scenarioCompanyObjects["scenario_manufacturer_Y_name"].id, uploadedByCompanyName: scenarioCompanyObjects["scenario_manufacturer_Y_name"].companyName },
                { id: `STK-SCEN-Z-${Date.now()}`, productName, diameterType: 'mid', diameterFrom: '12', diameterTo: '16', length: '2.5', quantity: '186', price: '20 EUR/db', cubicMeters: calculateVolume(12, 16, 2.5, 186), notes: t('scenario_stock_note_Z' as TranslationKey), sustainabilityInfo: "Local Harvest", status: StockStatus.AVAILABLE, uploadDate: new Date().toISOString(), uploadedByCompanyId: scenarioCompanyObjects["scenario_manufacturer_Z_name"].id, uploadedByCompanyName: scenarioCompanyObjects["scenario_manufacturer_Z_name"].companyName }
            ];
            
            try {
                const existingDemands: DemandItem[] = JSON.parse(localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY) || '[]');
                localStorage.setItem(CUSTOMER_DEMANDS_STORAGE_KEY, JSON.stringify([...scenarioDemands, ...existingDemands]));
    
                const existingStock: StockItem[] = JSON.parse(localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY) || '[]');
                localStorage.setItem(MANUFACTURER_STOCK_STORAGE_KEY, JSON.stringify([...scenarioStockItems, ...existingStock]));
                
                localStorage.setItem(MOCK_COMPANIES_STORAGE_KEY, JSON.stringify(currentMockCompanies));

                setGeneratedDataReport({
                    newCustomers: newCustomersCount,
                    newManufacturers: newManufacturersCount,
                    newDemands: scenarioDemands.length,
                    newStockItems: scenarioStockItems.length,
                    productName: productName,
                    scenarioInfo: t('adminUsers_dataGenerationReport_scenario_info' as TranslationKey)
                });
                loadData();
            } catch (error) {
                console.error("Error saving simulated data:", error);
                alert(t('adminUsers_dataGenerationFailure'));
            } finally {
                setDataGenerationLoading(false);
            }
        }, 1000);
    };

    const columns: Column<MockCompany>[] = useMemo(() => [
        { accessorKey: 'companyName', header: t('adminUsers_companyName'), enableSorting: true },
        { accessorKey: 'role', header: t('adminUsers_role'), enableSorting: true, cell: ({ getValue }) => getTranslatedUserRole(getValue(), t) },
        { accessorKey: 'address.city', header: t('city'), enableSorting: true, cell: ({ getValue }) => getValue() || 'N/A' },
        { accessorKey: 'address.country', header: t('country'), enableSorting: true, cell: ({ getValue }) => getValue() || 'N/A' },
    ], [t]);

    const userRoleOptions = [
        { value: UserRole.CUSTOMER, label: t('adminUsers_user_customer') },
        { value: UserRole.MANUFACTURER, label: t('adminUsers_user_manufacturer') },
    ];
    
    const recipientOptions = [
        { value: 'customer', label: t('recipient_customer')},
        { value: 'manufacturer', label: t('recipient_manufacturer')},
        { value: 'all_users', label: t('recipient_all_users')},
    ];

    return (
        <>
            <PageTitle title={t('adminUsers_title')} subtitle={t('adminUsers_subtitle')} icon={<UsersIconOutline className="h-8 w-8"/>} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={t('adminUsers_manageCompanies')}>
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-cyan-400 border-b border-slate-700 pb-2 flex items-center">
                            <UserPlusIcon className="h-5 w-5 mr-2" />
                            {t('adminUsers_addNewCompany')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input name="companyName" label={t('adminUsers_companyName')} value={newCompany.companyName || ''} onChange={handleNewCompanyChange} placeholder={t('adminUsers_form_companyNamePlaceholder')} />
                            <Select name="role" label={t('adminUsers_role')} options={userRoleOptions} value={newCompany.role || ''} onChange={handleNewCompanyChange} />
                            <Input name="street" label={t('adminUsers_companyStreet')} value={newCompany.address?.street || ''} onChange={handleAddressChange} placeholder={t('adminUsers_form_companyStreetPlaceholder')} />
                            <Input name="city" label={t('adminUsers_companyCity')} value={newCompany.address?.city || ''} onChange={handleAddressChange} placeholder={t('adminUsers_form_companyCityPlaceholder')} />
                            <Input name="zipCode" label={t('adminUsers_companyZipCode')} value={newCompany.address?.zipCode || ''} onChange={handleAddressChange} placeholder={t('adminUsers_form_companyZipCodePlaceholder')} />
                            <Input name="country" label={t('adminUsers_companyCountry')} value={newCompany.address?.country || ''} onChange={handleAddressChange} placeholder={t('adminUsers_form_companyCountryPlaceholder')} />
                        </div>
                        {formError && <p className="text-red-400 text-sm">{formError}</p>}
                        <Button onClick={handleAddNewCompany}>{t('adminUsers_addCompanyButton')}</Button>
                    </div>
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-cyan-400 border-b border-slate-700 pb-2 mb-3">{t('adminUsers_registeredCompanies')}</h3>
                        {isLoading ? <LoadingSpinner /> : <SortableDataTable columns={columns} data={companies} />}
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card title={t('adminUsers_generateSimulatedData')}>
                        <p className="text-sm text-slate-300 mb-3">
                            {t('adminUsers_generateSimulatedDataDescriptionSpecific', { productName: t('productType_acaciaDebarkedSandedPost' as TranslationKey) })}
                        </p>
                        <Button onClick={handleGenerateSimulatedData} isLoading={dataGenerationLoading} leftIcon={<BeakerIcon className="h-5 w-5" />}>
                            {t('adminUsers_generateAcaciaDataButton', {productName: t('productType_acaciaDebarkedSandedPost' as TranslationKey)})}
                        </Button>
                        {dataGenerationLoading && <div className="mt-2"><LoadingSpinner text={t('adminUsers_dataGenerationInProgress')}/></div>}
                        {generatedDataReport && !dataGenerationLoading && (
                            <div className="mt-4 p-3 bg-slate-700 rounded text-sm space-y-1">
                                <h4 className="font-semibold text-cyan-300 mb-1">{t('adminUsers_dataGenerationReport_title')}</h4>
                                <p>{t('adminUsers_dataGenerationReport_product', {productName: generatedDataReport.productName})}</p>
                                <p>{t('adminUsers_dataGenerationReport_companies', {customerCount: generatedDataReport.newCustomers, manufacturerCount: generatedDataReport.newManufacturers})}</p>
                                <p>{t('adminUsers_dataGenerationReport_demands', {demandCount: generatedDataReport.newDemands})}</p>
                                <p>{t('adminUsers_dataGenerationReport_stock', {stockCount: generatedDataReport.newStockItems})}</p>
                                {generatedDataReport.scenarioInfo && <p className="text-xs text-amber-300 mt-1">{generatedDataReport.scenarioInfo}</p>}
                                <p className="text-xs text-slate-400 mt-1">{t('adminUsers_dataGenerationReport_info')}</p>
                            </div>
                        )}
                    </Card>

                    <Card title={t('adminUsers_aiCommunicationAssistant')}>
                        <Select label={t('adminUsers_recipientTypeLabel')} options={recipientOptions} value={aiRecipientType} onChange={(e) => setAiRecipientType(e.target.value as any)} />
                        <Input label={t('adminUsers_scenarioLabel')} value={aiScenario} onChange={(e) => setAiScenario(e.target.value)} placeholder={t('adminUsers_scenarioPlaceholder')} />
                        <AiFeatureButton text={t('adminUsers_generateMessageDraft')} onClick={handleGenerateMessageDraft} isLoading={aiLoading.draft} leftIcon={<ChatBubbleLeftRightIcon className="h-5 w-5" />} />
                        {aiLoading.draft && <LoadingSpinner text={t('adminUsers_generatingDraft')} />}
                        {aiGeneratedDraft && <Textarea label={t('adminUsers_generatedDraft')} value={aiGeneratedDraft} readOnly rows={5} className="mt-3" />}
                    </Card>

                    <Card title={t('adminUsers_aiContentPolicyChecker')}>
                        <Textarea label={t('adminUsers_textToCheckLabel')} value={aiTextToCheck} onChange={(e) => setAiTextToCheck(e.target.value)} placeholder={t('adminUsers_textToCheckPlaceholder')} rows={4} />
                        <AiFeatureButton text={t('adminUsers_checkContent')} onClick={handleCheckContent} isLoading={aiLoading.check} leftIcon={<ShieldCheckIcon className="h-5 w-5"/>}/>
                        {aiLoading.check && <LoadingSpinner text={t('adminUsers_checkingContent')} />}
                        {aiCheckResult && <div className="mt-3 p-3 bg-slate-700/50 rounded text-sm"><strong>{t('adminUsers_checkResult')}:</strong> {aiCheckResult}</div>}
                    </Card>
                </div>
            </div>
        </>
    );
};

export default AdminUsersPage;
