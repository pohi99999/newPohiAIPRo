// pages/customer/CustomerDealsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import PageTitle from '../../components/PageTitle';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import { ConfirmedMatch, MockCompany, UserRole } from '../../types';
import { useAppContext } from '../../App';
import { useLocale } from '../../LocaleContext';
import { getTranslatedStockStatus } from '../../locales';
import { CONFIRMED_MATCHES_STORAGE_KEY, MOCK_COMPANIES_STORAGE_KEY } from '../../constants';
import { DocumentCheckIcon, InformationCircleIcon, ArrowsRightLeftIcon, BanknotesIcon, CalendarIcon } from '@heroicons/react/24/outline';

const ItemDetails: React.FC<{ item: any, title: string }> = ({ item, title }) => {
    return (
        <div className="flex-1">
            <h4 className="text-md font-semibold text-cyan-300 mb-2">{title}</h4>
            <div className="p-3 rounded-lg bg-slate-700/50 text-xs space-y-1">
                <p className="font-semibold text-sm text-slate-200">{item.productName || 'N/A'}</p>
                <p className="text-slate-300">Ø{item.diameterFrom}-{item.diameterTo}cm, {item.length}m, {item.quantity}pcs</p>
                <p className="text-slate-400">~{item.cubicMeters?.toFixed(2)} m³</p>
            </div>
        </div>
    );
};

const CustomerDealsPage: React.FC = () => {
    const { t, locale } = useLocale();
    const { userRole } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [deals, setDeals] = useState<ConfirmedMatch[]>([]);
    const [currentUser, setCurrentUser] = useState<MockCompany | { id: string, name: string } | null>(null);

    useEffect(() => {
        setIsLoading(true);
        try {
            const matchesRaw = localStorage.getItem(CONFIRMED_MATCHES_STORAGE_KEY);
            const companiesRaw = localStorage.getItem(MOCK_COMPANIES_STORAGE_KEY);
            
            const companies: MockCompany[] = companiesRaw ? JSON.parse(companiesRaw) : [];
            const userCompany = companies.find(c => c.role === userRole) || { id: userRole!, name: userRole! };
            setCurrentUser(userCompany);

            const allMatches: ConfirmedMatch[] = matchesRaw ? JSON.parse(matchesRaw) : [];
            const myDeals = allMatches
                .filter(deal => deal.demandDetails.submittedByCompanyId === userCompany.id || (userRole === UserRole.CUSTOMER && !deal.demandDetails.submittedByCompanyId))
                .sort((a,b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());

            setDeals(myDeals);
        } catch (e) {
            console.error("Error loading deals:", e);
        } finally {
            setIsLoading(false);
        }
    }, [userRole]);

    if (isLoading) {
        return <LoadingSpinner text={t('customerMyDemands_loadingDemands')} />;
    }

    return (
        <>
            <PageTitle title={t('deals_title')} subtitle={t('deals_subtitle')} icon={<DocumentCheckIcon className="h-8 w-8" />} />
             {deals.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <InformationCircleIcon className="h-16 w-16 text-cyan-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white">{t('deals_noDeals')}</h3>
                        <p className="text-slate-400 mt-2">{t('deals_browseMatchesPrompt')}</p>
                        <Button to="/customer/matches" variant="primary" className="mt-4">{t('menu_my_matches')}</Button>
                    </div>
                </Card>
            ) : (
                <div className="space-y-6">
                    {deals.map(deal => (
                        <Card key={deal.id} className="hover-glow transition-all duration-300">
                           <div className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-xs text-slate-400">{t('adminBilling_matchId')}</p>
                                        <p className="font-mono text-cyan-300">{deal.id}</p>
                                    </div>
                                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${deal.billed ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                        {deal.billed ? t('deals_status_billed') : t('deals_status_unbilled')}
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                                    <ItemDetails item={deal.demandDetails} title={t('deals_yourDemand')} />
                                    
                                    <div className="flex items-center justify-center text-slate-500">
                                        <ArrowsRightLeftIcon className="h-6 w-6" />
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="text-md font-semibold text-cyan-300 mb-2">{t('deals_partner')} ({t('userRole_MANUFACTURER')})</h4>
                                        <div className="p-3 rounded-lg bg-slate-700/50 text-xs space-y-1">
                                            <p className="font-semibold text-sm text-slate-200">{deal.stockDetails.uploadedByCompanyName}</p>
                                            <p className="text-slate-300">
                                                <span className="font-bold">{deal.stockDetails.productName}</span>: {t('deals_status')}: <span className="font-semibold">{getTranslatedStockStatus(deal.stockDetails.status, t)}</span>
                                            </p>
                                            <Button size="sm" variant="ghost" className="mt-2 !text-xs !py-1" to="/messages">{t('matches_startChat')}</Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-600 text-xs text-slate-300 flex flex-wrap gap-x-6 gap-y-2">
                                     <div className="flex items-center">
                                        <CalendarIcon className="h-4 w-4 mr-2 text-slate-400" />
                                        <strong>{t('deals_matchDate')}:</strong>
                                        <span className="ml-1.5">{new Date(deal.matchDate).toLocaleDateString(locale)}</span>
                                     </div>
                                      <div className="flex items-center">
                                        <BanknotesIcon className="h-4 w-4 mr-2 text-slate-400" />
                                        <strong>{t('deals_commission')}:</strong>
                                        <span className="ml-1.5 font-semibold text-green-400">{deal.commissionAmount.toFixed(2)} EUR</span>
                                     </div>
                                </div>
                           </div>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );
}

export default CustomerDealsPage;