// lib/utils.ts
import { ConfirmedMatch, DemandItem, StockItem, DemandStatus, StockStatus, MockCompany, UserRole, ProductFeatures } from '../types'; // Changed ./types to ../types
import { TranslationKey } from '../locales'; // Added TranslationKey

/**
 * Calculates the cubic volume based on average diameter, length, and quantity.
 * @param diameterFromCm - Diameter from in centimeters.
 * @param diameterToCm - Diameter to in centimeters.
 * @param lengthM - Length in meters.
 * @param quantityPcs - Quantity in pieces.
 * @returns The calculated volume in cubic meters, or 0 if inputs are invalid.
 */
export const calculateVolume = (diameterFromCm: number, diameterToCm: number, lengthM: number, quantityPcs: number): number => {
    if (diameterFromCm <= 0 || diameterToCm <= 0 || lengthM <= 0 || quantityPcs <= 0 || diameterFromCm > diameterToCm) {
        return 0;
    }
    // Convert cm to m for diameter
    const avgDiameterM = (diameterFromCm + diameterToCm) / 2 / 100;
    const volumePerPiece = Math.PI * Math.pow(avgDiameterM / 2, 2) * lengthM;
    return parseFloat((volumePerPiece * quantityPcs).toFixed(3));
};


/**
 * Generates a specified number of mock ConfirmedMatch objects.
 * @param count - The number of mock matches to generate.
 * @param customers - An array of MockCompany objects representing customers.
 * @param manufacturers - An array of MockCompany objects representing manufacturers.
 * @param t - The translation function.
 * @returns An array of mock ConfirmedMatch objects.
 */
export const generateMockConfirmedMatches = (
    count: number,
    customers: MockCompany[],
    manufacturers: MockCompany[],
    t: (key: TranslationKey, params?: Record<string, string | number>) => string
): ConfirmedMatch[] => {
    const mockMatches: ConfirmedMatch[] = [];
    const defaultProductName = t('productType_acaciaDebarkedSandedPost');

    const getValidCompany = (index: number, companyList: MockCompany[], role: UserRole): MockCompany => {
        if (companyList.length > 0) {
            const company = companyList[index % companyList.length];
            // This ensures that even if the source data is incomplete, we have a fallback for visualization
            return {
                ...company,
                address: company.address || { city: t('city_sample_1'), country: t('country_sample_hu') }
            };
        }
        // Fallback if the provided list is empty
        const fallbackRoleText = role === UserRole.CUSTOMER ? t('userRole_CUSTOMER') : t('userRole_MANUFACTURER');
        const fallbackCityKey = role === UserRole.CUSTOMER ? 'city_sample_1' : 'city_sample_2';
        return { 
            id: `${role.slice(0,4).toUpperCase()}-MOCK-${index}`, 
            companyName: `${fallbackRoleText} ${index + 1}`, 
            role: role as UserRole.CUSTOMER | UserRole.MANUFACTURER, 
            address: { city: t(fallbackCityKey as TranslationKey), country: t('country_sample_hu') } 
        };
    };

    for (let i = 0; i < count; i++) {
        const customer = getValidCompany(i, customers, UserRole.CUSTOMER);
        const manufacturer = getValidCompany(i, manufacturers, UserRole.MANUFACTURER);

        const quantity = Math.floor(Math.random() * 81) + 20; // 20-100 pcs
        const length = parseFloat((Math.random() * 2 + 2).toFixed(1)); // 2.0-4.0 m
        const dFrom = Math.floor(Math.random() * 11) + 10; // 10-20 cm
        const dTo = dFrom + (Math.floor(Math.random() * 5) + 2); // dFrom + 2-6 cm
        const cubicMeters = calculateVolume(dFrom, dTo, length, quantity);
        const commissionAmount = parseFloat((cubicMeters * (Math.random() * 5 + 10)).toFixed(2)); // Arbitrary commission based on volume

        const mockDemand: DemandItem = {
            id: `MOCK-DEM-${Date.now()}-${i}`,
            productName: defaultProductName,
            diameterType: 'mid',
            diameterFrom: String(dFrom),
            diameterTo: String(dTo),
            length: String(length),
            quantity: String(quantity),
            cubicMeters: cubicMeters,
            notes: `${t('scenario_demand_note_A')} (Mock ${i+1})`,
            status: DemandStatus.RECEIVED,
            submissionDate: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 5).toISOString(), // Within last 5 days
            submittedByCompanyId: customer.id,
            submittedByCompanyName: customer.companyName,
        };

        const mockStock: StockItem = {
            id: `MOCK-STK-${Date.now()}-${i}`,
            productName: defaultProductName,
            diameterType: 'mid',
            diameterFrom: String(dFrom),
            diameterTo: String(dTo),
            length: String(length),
            quantity: String(quantity + Math.floor(Math.random() * 10 - 5)), // Slightly varying quantity
            cubicMeters: calculateVolume(dFrom, dTo, length, quantity + Math.floor(Math.random() * 10 - 5)),
            price: `${(Math.random() * 10 + 15).toFixed(0)} EUR/db`,
            notes: `${t('scenario_stock_note_X')} (Mock ${i+1})`,
            sustainabilityInfo: "PEFC Mock",
            status: StockStatus.AVAILABLE,
            uploadDate: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 10).toISOString(), // Within last 10 days
            uploadedByCompanyId: manufacturer.id,
            uploadedByCompanyName: manufacturer.companyName,
        };

        mockMatches.push({
            id: `MOCK-CONF-${Date.now()}-${i}`,
            demandId: mockDemand.id,
            demandDetails: mockDemand,
            stockId: mockStock.id!,
            stockDetails: mockStock,
            matchDate: new Date().toISOString(),
            commissionRate: 0.05,
            commissionAmount: commissionAmount,
            billed: false,
        });
    }
    return mockMatches;
};
