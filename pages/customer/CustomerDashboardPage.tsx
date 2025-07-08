// pages/customer/CustomerDashboardPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../../LocaleContext';
import { DemandItem, DemandStatus } from '../../types';
import { CUSTOMER_DEMANDS_STORAGE_KEY } from '../../constants';
import { getTranslatedDemandStatus } from '../../locales';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { ChartPieIcon, CheckCircleIcon, DocumentMagnifyingGlassIcon, LightBulbIcon, ShoppingCartIcon, ClockIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ai } from '../../lib/gemini';
import { GenerateContentResponse } from '@google/genai';

export const CustomerDashboardPage: React.FC = () => {
    const { t, locale } = useLocale();
    const [demands, setDemands] = useState<DemandItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [aiTip, setAiTip] = useState<string>('');
    const [isTipLoading, setIsTipLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        try {
            const storedDemandsRaw = localStorage.getItem(CUSTOMER_DEMANDS_STORAGE_KEY);
            const allDemands: DemandItem[] = storedDemandsRaw ? JSON.parse(storedDemandsRaw) : [];
            const ownDemands = allDemands
                .filter(item => !item.submittedByCompanyId)
                .sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
            setDemands(ownDemands);
        } catch (error) {
            console.error("Error loading demands for dashboard:", error);
        }
        setIsLoading(false);
    }, []);

    const fetchAiTip = useCallback(async () => {
        if (!ai) {
            setAiTip(t('customerDashboard_aiTip_error'));
            setIsTipLoading(false);
            return;
        }
        setIsTipLoading(true);
        const promptLang = locale === 'hu' ? 'Hungarian' : (locale === 'de' ? 'German' : 'English');
        const prompt = `You are an AI assistant for a timber marketplace called "Pohi AI Pro".
Provide one, short, helpful tip for a CUSTOMER looking to buy timber.
The tip should be about how to create a good demand listing to get better offers from manufacturers.
Respond in ${promptLang}. The response should only contain the tip itself, no introductory text.`;
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });
            setAiTip(response.text || t('customerDashboard_aiTip_placeholder'));
        } catch (error) {
            console.error("Error fetching AI tip:", error);
            setAiTip(t('customerDashboard_aiTip_error'));
        } finally {
            setIsTipLoading(false);
        }
    }, [t, locale]);

    useEffect(() => {
        fetchAiTip();
    }, [fetchAiTip]);

    if (isLoading) {
        return <LoadingSpinner text={t('customerMyDemands_loadingDemands')} />;
    }

    const activeDemandsCount = demands.filter(d => d.status === DemandStatus.RECEIVED || d.status === DemandStatus.PROCESSING).length;
    const completedDemandsCount = demands.filter(d => d.status === DemandStatus.COMPLETED).length;
    const recentDemands = demands.slice(0, 3);

    return (
        <>
            <PageTitle title={t('customerDashboard_title')} subtitle={t('customerDashboard_subtitle')} icon={<ChartPieIcon className="h-8 w-8" />} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Overview Metrics */}
                <Card title={t('customerDashboard_overview')} className="lg:col-span-2">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                            <ClockIcon className="h-8 w-8 mx-auto text-sky-400 mb-2" />
                            <p className="text-3xl font-bold text-white">{activeDemandsCount}</p>
                            <p className="text-sm text-slate-400">{t('customerDashboard_activeDemands')}</p>
                        </div>
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                            <CheckCircleIcon className="h-8 w-8 mx-auto text-green-400 mb-2" />
                            <p className="text-3xl font-bold text-white">{completedDemandsCount}</p>
                            <p className="text-sm text-slate-400">{t('customerDashboard_completedDemands')}</p>
                        </div>
                    </div>
                </Card>

                {/* AI Tip of the Day */}
                <Card title={t('customerDashboard_aiTip')}>
                     <div className="flex flex-col items-center justify-center h-full text-center">
                        <LightBulbIcon className="h-8 w-8 text-yellow-400 mb-3" />
                        {isTipLoading ? (
                            <LoadingSpinner size="sm" text={t('customerDashboard_aiTip_loading')} />
                        ) : (
                            <p className="text-slate-200 italic">"{aiTip}"</p>
                        )}
                    </div>
                </Card>

                {/* Recent Demands */}
                <Card title={t('customerDashboard_recentDemands')} className="lg:col-span-2">
                    {recentDemands.length > 0 ? (
                        <ul className="space-y-3">
                            {recentDemands.map(demand => (
                                <li key={demand.id} className="p-3 bg-slate-700/50 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-cyan-300">{demand.productName}</p>
                                        <p className="text-xs text-slate-400">{t('customerMyDemands_submitted')}: {new Date(demand.submissionDate).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${demand.status === DemandStatus.RECEIVED ? 'bg-sky-500' : 'bg-green-500'}`}>{getTranslatedDemandStatus(demand.status, t)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400">{t('customerDashboard_noRecentDemands')}</p>
                    )}
                    <div className="mt-4 text-right">
                        <Button to="/customer/my-demands" as={NavLink} variant="secondary" size="sm">{t('customerDashboard_viewAllDemands')}</Button>
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card title={t('customerDashboard_quickActions')}>
                    <div className="space-y-3">
                        <Button to="/customer/new-demand" as={NavLink} leftIcon={<ShoppingCartIcon className="h-5 w-5"/>} className="w-full">
                            {t('menu_customer_new_demand')}
                        </Button>
                        <Button to="/customer/new-demand?product=acacia-pole" as={NavLink} leftIcon={<ShoppingCartIcon className="h-5 w-5"/>} variant="ghost" className="w-full border border-cyan-700">
                            {t('menu_customer_acacia_pole_order')}
                        </Button>
                    </div>
                </Card>
            </div>
        </>
    );
};