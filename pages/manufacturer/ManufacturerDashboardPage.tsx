// pages/manufacturer/ManufacturerDashboardPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../../LocaleContext';
import { StockItem, StockStatus } from '../../types';
import { MANUFACTURER_STOCK_STORAGE_KEY } from '../../constants';
import { getTranslatedStockStatus } from '../../locales';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import Button from '../../components/Button';
import SimpleBarChart from '../../components/SimpleBarChart';
import { ChartPieIcon, ArchiveBoxIcon, CheckBadgeIcon, ShieldCheckIcon, LightBulbIcon, CubeIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ai } from '../../lib/gemini';
import { GenerateContentResponse } from '@google/genai';

export const ManufacturerDashboardPage: React.FC = () => {
    const { t, locale } = useLocale();
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [aiTip, setAiTip] = useState<string>('');
    const [isTipLoading, setIsTipLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        try {
            const storedStockRaw = localStorage.getItem(MANUFACTURER_STOCK_STORAGE_KEY);
            const allStock: StockItem[] = storedStockRaw ? JSON.parse(storedStockRaw) : [];
            const ownStock = allStock
                .filter(item => !item.uploadedByCompanyId)
                .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime());
            setStockItems(ownStock);
        } catch (error) {
            console.error("Error loading stock for dashboard:", error);
        }
        setIsLoading(false);
    }, []);

    const fetchAiTip = useCallback(async () => {
        if (!ai) {
            setAiTip(t('manufacturerDashboard_aiQualityTip_error'));
            setIsTipLoading(false);
            return;
        }
        setIsTipLoading(true);
        const promptLang = locale === 'hu' ? 'Hungarian' : (locale === 'de' ? 'German' : 'English');
        const prompt = `You are an AI assistant for a timber marketplace called "Pohi AI Pro".
Provide one, short, helpful tip for a MANUFACTURER selling timber.
The tip should be about how to create a high-quality stock listing to attract more buyers.
Respond in ${promptLang}. The response should only contain the tip itself, no introductory text.`;
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });
            setAiTip(response.text || t('manufacturerDashboard_aiQualityTip_placeholder'));
        } catch (error) {
            console.error("Error fetching AI tip for manufacturer:", error);
            setAiTip(t('manufacturerDashboard_aiQualityTip_error'));
        } finally {
            setIsTipLoading(false);
        }
    }, [t, locale]);

    useEffect(() => {
        fetchAiTip();
    }, [fetchAiTip]);

    if (isLoading) {
        return <LoadingSpinner text={t('manufacturerMyStock_loadingStock')} />;
    }

    const availableCount = stockItems.filter(s => s.status === StockStatus.AVAILABLE).length;
    const reservedCount = stockItems.filter(s => s.status === StockStatus.RESERVED).length;
    const soldCount = stockItems.filter(s => s.status === StockStatus.SOLD).length;
    const recentListings = stockItems.slice(0, 3);
    
    // Mock performance data
    const topListingsData = stockItems.slice(0, 3).map((item, index) => ({
        label: (item.productName || `ID: ${item.id?.slice(-4)}`).substring(0, 20),
        value: (25 - index * 5) * (Math.random() * 0.4 + 0.8), // Mock views
        color: ['text-cyan-400', 'text-sky-400', 'text-teal-400'][index]
    }));

    return (
        <>
            <PageTitle title={t('manufacturerDashboard_title')} subtitle={t('manufacturerDashboard_subtitle')} icon={<ChartPieIcon className="h-8 w-8" />} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stock Overview Metrics */}
                <Card title={t('manufacturerDashboard_stockOverview')} className="lg:col-span-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                            <ArchiveBoxIcon className="h-8 w-8 mx-auto text-green-400 mb-2" />
                            <p className="text-3xl font-bold text-white">{availableCount}</p>
                            <p className="text-sm text-slate-400">{t('manufacturerDashboard_availableStock')}</p>
                        </div>
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                            <ShieldCheckIcon className="h-8 w-8 mx-auto text-yellow-400 mb-2" />
                            <p className="text-3xl font-bold text-white">{reservedCount}</p>
                            <p className="text-sm text-slate-400">{t('manufacturerDashboard_reservedStock')}</p>
                        </div>
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                            <CheckBadgeIcon className="h-8 w-8 mx-auto text-rose-400 mb-2" />
                            <p className="text-3xl font-bold text-white">{soldCount}</p>
                            <p className="text-sm text-slate-400">{t('manufacturerDashboard_soldStock')}</p>
                        </div>
                    </div>
                </Card>

                 {/* Recent Listings */}
                <Card title={t('manufacturerDashboard_recentListings')} className="lg:col-span-2">
                    {recentListings.length > 0 ? (
                        <ul className="space-y-3">
                            {recentListings.map(item => (
                                <li key={item.id} className="p-3 bg-slate-700/50 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-cyan-300">{item.productName}</p>
                                        <p className="text-xs text-slate-400">{t('manufacturerMyStock_uploaded')}: {new Date(item.uploadDate || Date.now()).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.status === StockStatus.AVAILABLE ? 'bg-green-600' : 'bg-yellow-500'}`}>{getTranslatedStockStatus(item.status, t)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400">{t('manufacturerDashboard_noRecentListings')}</p>
                    )}
                     <div className="mt-4 text-right">
                        <Button to="/manufacturer/my-stock" as={NavLink} variant="secondary" size="sm">{t('manufacturerDashboard_viewAllListings')}</Button>
                    </div>
                </Card>

                 {/* Quick Actions */}
                <Card title={t('manufacturerDashboard_quickActions')} className="row-start-4 lg:row-start-auto">
                    <div className="space-y-3 h-full flex flex-col justify-center">
                        <Button to="/manufacturer/new-stock" as={NavLink} leftIcon={<CubeIcon className="h-5 w-5"/>} className="w-full text-lg !py-4">
                            {t('manufacturerDashboard_uploadNewStock')}
                        </Button>
                    </div>
                </Card>
                
                {/* Performance */}
                <Card title={t('manufacturerDashboard_listingPerformance')} className="lg:col-span-2">
                    {topListingsData.length > 0 ? (
                        <SimpleBarChart data={topListingsData} title={t('manufacturerDashboard_topListingsByViews')} />
                    ) : (
                        <p className="text-slate-400 text-center py-4">{t('manufacturerDashboard_noListingData')}</p>
                    )}
                </Card>

                {/* AI Tip */}
                <Card title={t('manufacturerDashboard_aiQualityTip')}>
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <LightBulbIcon className="h-8 w-8 text-yellow-400 mb-3" />
                        {isTipLoading ? (
                            <LoadingSpinner size="sm" text={t('manufacturerDashboard_aiQualityTip_loading')} />
                        ) : (
                            <p className="text-slate-200 italic">"{aiTip}"</p>
                        )}
                    </div>
                </Card>

            </div>
        </>
    );
};