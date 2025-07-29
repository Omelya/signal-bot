import { ExchangeType } from '../../shared';
import { IStrategy } from './Strategy';
import { DomainError } from '../../shared';
import {
    IPairSettings,
    IPairValidationResult,
    ITradingPairCreateParams,
    PairCategory
} from "../../shared";

export class TradingPair {
    isActive: boolean = true;
    lastSignalTime: number = 0;
    totalSignalsGenerated: number = 0;
    successfulSignals: number = 0;
    lastValidationTime: number = 0;
    validationResult?: IPairValidationResult;

    private constructor(
        readonly symbol: string,
        readonly baseAsset: string,
        readonly quoteAsset: string,
        readonly exchange: ExchangeType,
        readonly category: PairCategory,
        readonly settings: IPairSettings,
        readonly strategy: IStrategy,
        readonly createdAt: Date = new Date()
    ) {
        this.validateSymbol();
        this.validateAssets();
    }

    /**
     * Factory method to create a new TradingPair
     */
    static create(params: ITradingPairCreateParams): TradingPair {
        return new TradingPair(
            params.symbol.toUpperCase(),
            params.baseAsset.toUpperCase(),
            params.quoteAsset.toUpperCase(),
            params.exchange,
            params.category,
            params.settings,
            params.strategy
        );
    }

    /**
     * Factory method to reconstruct TradingPair from persistence
     */
    static fromPersistence(data: {
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
        exchange: ExchangeType;
        category: PairCategory;
        settings: IPairSettings;
        strategy: IStrategy;
        isActive: boolean;
        lastSignalTime: number;
        totalSignalsGenerated: number;
        successfulSignals: number;
        createdAt: Date;
    }): TradingPair {
        let date = data.createdAt;

        if (typeof date !== 'object') {
            date = new Date(data.createdAt);
        }

        const pair = new TradingPair(
            data.symbol,
            data.baseAsset,
            data.quoteAsset,
            data.exchange,
            data.category,
            data.settings,
            data.strategy,
            date,
        );

        pair.isActive = data.isActive;
        pair.lastSignalTime = data.lastSignalTime;
        pair.totalSignalsGenerated = data.totalSignalsGenerated;
        pair.successfulSignals = data.successfulSignals;

        return pair;
    }

    /**
     * Activate the trading pair for signal generation
     */
    public activate(): void {
        if (this.isActive) {
            throw new DomainError(`Trading pair ${this.symbol} is already active`);
        }

        this.isActive = true;
    }

    /**
     * Deactivate the trading pair
     */
    public deactivate(): void {
        if (!this.isActive) {
            throw new DomainError(`Trading pair ${this.symbol} is already inactive`);
        }

        this.isActive = false;
    }

    /**
     * Check if a new signal can be generated (respects cooldown)
     */
    public canGenerateSignal(): boolean {
        if (!this.isActive) {
            return false;
        }

        const now = Date.now();
        const timeSinceLastSignal = now - this.lastSignalTime;
        return timeSinceLastSignal >= this.settings.signalCooldown;
    }

    /**
     * Get remaining cooldown time in milliseconds
     */
    public getRemainingCooldown(): number {
        if (!this.isActive) {
            return 0;
        }

        const now = Date.now();
        const timeSinceLastSignal = now - this.lastSignalTime;
        const remaining = this.settings.signalCooldown - timeSinceLastSignal;

        return Math.max(0, remaining);
    }

    /**
     * Update last signal generation time
     */
    public updateLastSignalTime(): void {
        this.lastSignalTime = Date.now();
        this.totalSignalsGenerated++;
    }

    /**
     * Mark a signal as successful
     */
    public markSignalAsSuccessful(): void {
        this.successfulSignals++;
    }

    /**
     * Get signal success rate
     */
    public getSuccessRate(): number {
        if (this.totalSignalsGenerated === 0) {
            return 0;
        }
        return (this.successfulSignals / this.totalSignalsGenerated) * 100;
    }

    /**
     * Check if it's a good time to trade based on special rules
     */
    public isGoodTimeToTrade(): boolean {
        const now = new Date();

        // Check weekend trading rule
        if (this.settings.specialRules.avoidWeekends) {
            const dayOfWeek = now.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
                return false;
            }
        }

        return true;
    }

    /**
     * Get recommended position size based on category and risk adjustment
     */
    public getRecommendedPositionSize(accountBalance: number): number {
        const baseRisk = this.getCategoryRiskPercentage();
        const adjustedRisk = baseRisk * this.settings.riskAdjustment;

        return accountBalance * (adjustedRisk / 100);
    }

    /**
     * Update validation result from external validation
     */
    public updateValidationResult(result: IPairValidationResult): void {
        this.validationResult = result;
        this.lastValidationTime = Date.now();
    }

    /**
     * Check if validation is recent (within last hour)
     */
    public hasRecentValidation(): boolean {
        if (!this.validationResult) {
            return false;
        }

        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        return (now - this.lastValidationTime) < oneHour;
    }

    /**
     * Get pair performance metrics
     */
    public getPerformanceMetrics(): {
        totalSignals: number;
        successfulSignals: number;
        successRate: number;
        averageSignalsPerDay: number;
        daysSinceCreation: number;
        isPerforming: boolean;
    } {
        const now = Date.now();
        const daysSinceCreation = Math.floor((now - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const averageSignalsPerDay = daysSinceCreation > 0 ? this.totalSignalsGenerated / daysSinceCreation : 0;
        const successRate = this.getSuccessRate();

        return {
            totalSignals: this.totalSignalsGenerated,
            successfulSignals: this.successfulSignals,
            successRate,
            averageSignalsPerDay,
            daysSinceCreation,
            isPerforming: successRate >= 60 && averageSignalsPerDay >= 0.5 // At least 60% success rate and 0.5 signals per day
        };
    }

    /**
     * Get adapted strategy with pair-specific adjustments
     */
    public getAdaptedStrategy(): IStrategy {
        const baseStrategy = { ...this.strategy };
        const rules = this.settings.specialRules;

        // Apply stop loss multiplier
        baseStrategy.risk.stopLoss *= rules.stopLossMultiplier;

        // Apply take profit multiplier
        baseStrategy.risk.takeProfits = baseStrategy.risk.takeProfits.map(tp =>
            tp * rules.takeProfitMultiplier
        );

        // Apply volume weight
        baseStrategy.indicators.volume.threshold *= rules.volumeWeight;

        // Adjust RSI for high volatility pairs
        if (this.settings.volatilityMultiplier > 1.2) {
            baseStrategy.indicators.rsi.oversold -= 5;
            baseStrategy.indicators.rsi.overbought += 5;
        }

        return baseStrategy;
    }

    /**
     * Check if pair should be auto-disabled due to poor performance
     */
    public shouldAutoDisable(): boolean {
        const metrics = this.getPerformanceMetrics();

        // Auto-disable if:
        // - More than 10 signals generated AND success rate < 30%
        // - More than 30 days old AND average signals per day < 0.1
        return (
            (metrics.totalSignals >= 10 && metrics.successRate < 30) ||
            (metrics.daysSinceCreation > 30 && metrics.averageSignalsPerDay < 0.1)
        );
    }

    /**
     * Get display name for UI
     */
    public getDisplayName(): string {
        return `${this.symbol} (${this.exchange.toUpperCase()})`;
    }

    /**
     * Convert to plain object for serialization
     */
    public toPlainObject(): {
        symbol: string;
        baseAsset: string;
        quoteAsset: string;
        exchange: ExchangeType;
        category: PairCategory;
        settings: IPairSettings;
        strategy: IStrategy;
        isActive: boolean;
        lastSignalTime: number;
        totalSignalsGenerated: number;
        successfulSignals: number;
        createdAt: Date;
        performance: any;
        cooldownRemaining: number;
        canTrade: boolean;
    } {
        return {
            symbol: this.symbol,
            baseAsset: this.baseAsset,
            quoteAsset: this.quoteAsset,
            exchange: this.exchange,
            category: this.category,
            settings: this.settings,
            strategy: this.strategy,
            isActive: this.isActive,
            lastSignalTime: this.lastSignalTime,
            totalSignalsGenerated: this.totalSignalsGenerated,
            successfulSignals: this.successfulSignals,
            createdAt: this.createdAt,
            performance: this.getPerformanceMetrics(),
            cooldownRemaining: this.getRemainingCooldown(),
            canTrade: this.canGenerateSignal() && this.isGoodTimeToTrade()
        };
    }

    private getCategoryRiskPercentage(): number {
        switch (this.category) {
            case PairCategory.CRYPTO_MAJOR:
                return 2; // 2% of account balance
            case PairCategory.CRYPTO_ALT:
                return 1.5; // 1.5% of account balance
            case PairCategory.DEFI:
                return 1; // 1% of account balance
            case PairCategory.MEME:
                return 0.5; // 0.5% of account balance
            default:
                return 1; // Default 1%
        }
    }

    private validateSymbol(): void {
        if (!this.symbol || this.symbol.trim().length === 0) {
            throw new DomainError('Symbol cannot be empty');
        }

        if (!this.symbol.includes('/')) {
            throw new DomainError('Symbol must be in format BASE/QUOTE (e.g., BTC/USDT)');
        }

        const parts = this.symbol.split('/');
        if (parts.length !== 2) {
            throw new DomainError('Symbol must contain exactly one "/" separator');
        }

        if (parts[0] === parts[1]) {
            throw new DomainError('Base and quote assets cannot be the same');
        }
    }

    private validateAssets(): void {
        if (!this.baseAsset || this.baseAsset.trim().length === 0) {
            throw new DomainError('Base asset cannot be empty');
        }

        if (!this.quoteAsset || this.quoteAsset.trim().length === 0) {
            throw new DomainError('Quote asset cannot be empty');
        }

        if (this.baseAsset === this.quoteAsset) {
            throw new DomainError('Base and quote assets cannot be the same');
        }

        const expectedSymbol = `${this.baseAsset}/${this.quoteAsset}`;
        if (this.symbol !== expectedSymbol) {
            throw new DomainError(`Symbol ${this.symbol} does not match assets ${expectedSymbol}`);
        }
    }
}
