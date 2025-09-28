export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    price: number; // In INR (or your currency)
    currency: string;
    description: string;
    bonusPercentage: number; // Extra credits as percentage
    isPopular: boolean;
    isActive: boolean;
}

export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
    starter: {
        id: 'starter',
        name: 'Starter Pack',
        credits: 100,
        price: 99,
        currency: 'INR',
        description: 'Perfect for trying out our AI models',
        bonusPercentage: 0,
        isPopular: false,
        isActive: true,
    },
    basic: {
        id: 'basic',
        name: 'Basic Pack',
        credits: 500,
        price: 399,
        currency: 'INR',
        description: 'Great for regular users',
        bonusPercentage: 10, // 10% bonus = 550 total credits
        isPopular: true,
        isActive: true,
    },
    pro: {
        id: 'pro',
        name: 'Pro Pack',
        credits: 1000,
        price: 699,
        currency: 'INR',
        description: 'Best value for power users',
        bonusPercentage: 20, // 20% bonus = 1200 total credits
        isPopular: false,
        isActive: true,
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise Pack',
        credits: 5000,
        price: 2999,
        currency: 'INR',
        description: 'For businesses and heavy usage',
        bonusPercentage: 30, // 30% bonus = 6500 total credits
        isPopular: false,
        isActive: true,
    },
};

export const getActivePackages = (): CreditPackage[] => {
    return Object.values(CREDIT_PACKAGES).filter(pkg => pkg.isActive);
};

export const getPackageById = (id: string): CreditPackage | null => {
    return CREDIT_PACKAGES[id] || null;
};

export const calculateTotalCredits = (packageId: string): number => {
    const package_ = getPackageById(packageId);
    if (!package_) return 0;

    const bonusCredits = Math.floor(package_.credits * (package_.bonusPercentage / 100));
    return package_.credits + bonusCredits;
};
