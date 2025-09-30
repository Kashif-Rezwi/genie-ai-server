export interface CreditRules {
    minimumBalance: number;
    maximumBalance: number;
    minimumTransaction: number;
    maximumTransaction: number;
    lowBalanceThreshold: number;
    criticalBalanceThreshold: number;
}

export const DEFAULT_CREDIT_RULES: CreditRules = {
    minimumBalance: 0,
    maximumBalance: 1000000,
    minimumTransaction: 0.01,
    maximumTransaction: 100000,
    lowBalanceThreshold: 10,
    criticalBalanceThreshold: 5,
};
