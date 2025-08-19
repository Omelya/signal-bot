import { TimeFrame } from '../../shared';
import { DomainError } from '../../shared';
import {
    IIndicatorSettings,
    IRiskManagement, ISignalConditions,
    IStrategyBacktestResult, IStrategyCreateParams,
    StrategyType
} from '../../shared';

export class Strategy implements IStrategy {
    public backtestResults?: IStrategyBacktestResult;
    public isActive: boolean = true;
    public lastOptimized: Date = new Date();

    private constructor(
        readonly name: string,
        readonly description: string,
        readonly timeframe: TimeFrame,
        readonly indicators: IIndicatorSettings,
        readonly risk: IRiskManagement,
        readonly minSignalStrength: number,
        readonly maxSimultaneousSignals: number,
        readonly type: StrategyType,
        readonly createdAt: Date = new Date(),
    ) {
        this.validateIndicators();
        this.validateRiskManagement();
        this.validateParameters();
    }

    /**
     * Factory method to create a new Strategy
     */
    static create(params: IStrategyCreateParams): Strategy {
        const strategyType = Strategy.determineTypeFromTimeframe(params.timeframe);

        return new Strategy(
            params.name,
            params.description,
            params.timeframe,
            params.indicators,
            params.risk,
            params.minSignalStrength,
            params.maxSimultaneousSignals,
            strategyType
        );
    }

    /**
     * Factory method for predefined scalping strategy
     */
    static createScalpingStrategy(): Strategy {
        return Strategy.create({
            name: 'Advanced Scalping',
            description: 'High-frequency trading strategy for 1-5 minute timeframes',
            timeframe: TimeFrame.ONE_MINUTE,
            indicators: {
                ema: { short: 3, medium: 7, long: 14 },
                rsi: { period: 9, oversold: 25, overbought: 75 },
                macd: { fastPeriod: 8, slowPeriod: 17, signalPeriod: 9 },
                bollingerBands: { period: 14, standardDeviation: 2 },
                volume: { threshold: 2.0, period: 10 }
            },
            risk: {
                stopLoss: 0.008,
                takeProfits: [0.005, 0.01, 0.015],
                maxRiskPerTrade: 1.0,
                riskRewardRatio: 2.0
            },
            minSignalStrength: 7,
            maxSimultaneousSignals: 3
        });
    }

    /**
     * Factory method for predefined swing strategy
     */
    static createSwingStrategy(): Strategy {
        return Strategy.create({
            name: 'Swing Trading',
            description: 'Medium-term trading strategy for 1-4 hour timeframes',
            timeframe: TimeFrame.ONE_HOUR,
            indicators: {
                ema: { short: 9, medium: 21, long: 50 },
                rsi: { period: 14, oversold: 35, overbought: 65 },
                macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                bollingerBands: { period: 20, standardDeviation: 2 },
                volume: { threshold: 1.3, period: 20 }
            },
            risk: {
                stopLoss: 0.025,
                takeProfits: [0.03, 0.04, 0.05],
                maxRiskPerTrade: 2.0,
                riskRewardRatio: 2.5
            },
            minSignalStrength: 6,
            maxSimultaneousSignals: 6
        });
    }

    /**
     * Factory method to reconstruct Strategy from persistence
     */
    static fromPersistence(data: {
        name: string;
        description: string;
        timeframe: TimeFrame;
        indicators: IIndicatorSettings;
        risk: IRiskManagement;
        minSignalStrength: number;
        maxSimultaneousSignals: number;
        type: StrategyType;
        isActive: boolean;
        createdAt: Date;
        lastOptimized: Date;
        backtestResults?: IStrategyBacktestResult;
    }): Strategy {
        const strategy = new Strategy(
            data.name,
            data.description,
            data.timeframe,
            data.indicators,
            data.risk,
            data.minSignalStrength,
            data.maxSimultaneousSignals,
            data.type,
            data.createdAt
        );

        strategy.isActive = data.isActive;
        strategy.lastOptimized = data.lastOptimized;
        strategy.backtestResults = data.backtestResults!;

        return strategy;
    }

    // Business Methods

    /**
     * Activate the strategy
     */
    public activate(): void {
        if (this.isActive) {
            throw new DomainError(`Strategy ${this.name} is already active`);
        }

        this.isActive = true;
    }

    /**
     * Deactivate the strategy
     */
    public deactivate(): void {
        if (!this.isActive) {
            throw new DomainError(`Strategy ${this.name} is already inactive`);
        }

        this.isActive = false;
    }

    /**
     * Get signal conditions for this strategy
     */
    public getSignalConditions(): ISignalConditions {
        return {
            bullish: {
                primary: [
                    'rsi_oversold',
                    'price_above_ema_short',
                    'macd_bullish_crossover'
                ],
                secondary: [
                    'volume_above_threshold',
                    'price_near_bb_lower',
                    'bullish_candle_pattern'
                ],
                confirmation: [
                    'trend_alignment',
                    'support_level_hold'
                ],
                weight: 1.0
            },
            bearish: {
                primary: [
                    'rsi_overbought',
                    'price_below_ema_short',
                    'macd_bearish_crossover'
                ],
                secondary: [
                    'volume_above_threshold',
                    'price_near_bb_upper',
                    'bearish_candle_pattern'
                ],
                confirmation: [
                    'trend_alignment',
                    'resistance_level_reject'
                ],
                weight: 1.0
            }
        };
    }

    /**
     * Calculate expected number of signals per day
     */
    public getExpectedSignalsPerDay(): number {
        const timeframeMinutes = this.getTimeframeInMinutes();
        const tradingHoursPerDay = 24; // Crypto trades 24/7
        const candlesPerDay = (tradingHoursPerDay * 60) / timeframeMinutes;

        // Estimate based on strategy type and signal strength
        const baseSignalRate = this.getBaseSignalRate();
        return Math.round(candlesPerDay * baseSignalRate);
    }

    /**
     * Check if strategy needs optimization
     */
    public needsOptimization(daysSinceLastOptimization: number = 30): boolean {
        const now = new Date();
        const daysSinceOptimization = Math.floor(
            (now.getTime() - this.lastOptimized.getTime()) / (1000 * 60 * 60 * 24)
        );

        return daysSinceOptimization >= daysSinceLastOptimization;
    }

    /**
     * Update backtest results
     */
    public updateBacktestResults(results: IStrategyBacktestResult): void {
        this.backtestResults = results;
        this.lastOptimized = new Date();
    }

    /**
     * Get strategy performance rating
     */
    public getPerformanceRating(): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'UNKNOWN' {
        if (!this.backtestResults) {
            return 'UNKNOWN';
        }

        const { winRate, profitFactor, sharpeRatio } = this.backtestResults;

        // Calculate composite score
        const winRateScore = winRate >= 60 ? 3 : winRate >= 50 ? 2 : winRate >= 40 ? 1 : 0;
        const profitFactorScore = profitFactor >= 2.0 ? 3 : profitFactor >= 1.5 ? 2 : profitFactor >= 1.2 ? 1 : 0;
        const sharpeScore = sharpeRatio >= 2.0 ? 3 : sharpeRatio >= 1.5 ? 2 : sharpeRatio >= 1.0 ? 1 : 0;

        const totalScore = winRateScore + profitFactorScore + sharpeScore;

        if (totalScore >= 8) return 'EXCELLENT';
        if (totalScore >= 6) return 'GOOD';
        if (totalScore >= 4) return 'AVERAGE';
        return 'POOR';
    }

    /**
     * Clone strategy with modifications
     */
    public clone(modifications?: Partial<IStrategyCreateParams>): Strategy {
        const params: IStrategyCreateParams = {
            name: modifications?.name || `${this.name} (Copy)`,
            description: modifications?.description || this.description,
            timeframe: modifications?.timeframe || this.timeframe,
            indicators: modifications?.indicators || this.indicators,
            risk: modifications?.risk || this.risk,
            minSignalStrength: modifications?.minSignalStrength || this.minSignalStrength,
            maxSimultaneousSignals: modifications?.maxSimultaneousSignals || this.maxSimultaneousSignals
        };

        return Strategy.create(params);
    }

    /**
     * Optimize strategy parameters based on market conditions
     */
    public optimize(marketVolatility: number): Strategy {
        const optimizedIndicators = { ...this.indicators };
        const optimizedRisk = { ...this.risk };

        // Adjust for high volatility
        if (marketVolatility > 0.05) { // 5% volatility threshold
            // Widen RSI bands
            optimizedIndicators.rsi = {
                ...optimizedIndicators.rsi,
                oversold: Math.max(20, optimizedIndicators.rsi.oversold - 5),
                overbought: Math.min(80, optimizedIndicators.rsi.overbought + 5)
            };

            // Increase stop loss
            optimizedRisk.stopLoss *= 1.2;

            // Increase take profits
            optimizedRisk.takeProfits = optimizedRisk.takeProfits.map(tp => tp * 1.15);
        }

        // Adjust for low volatility
        if (marketVolatility < 0.02) { // 2% volatility threshold
            // Tighten RSI bands
            optimizedIndicators.rsi = {
                ...optimizedIndicators.rsi,
                oversold: Math.min(35, optimizedIndicators.rsi.oversold + 5),
                overbought: Math.max(65, optimizedIndicators.rsi.overbought - 5)
            };

            // Decrease stop loss
            optimizedRisk.stopLoss *= 0.8;

            // Decrease take profits
            optimizedRisk.takeProfits = optimizedRisk.takeProfits.map(tp => tp * 0.85);
        }

        return this.clone({
            name: `${this.name} (Optimized)`,
            indicators: optimizedIndicators,
            risk: optimizedRisk
        });
    }

    /**
     * Convert to plain object for serialization
     */
    public toPlainObject(): {
        name: string;
        description: string;
        timeframe: TimeFrame;
        type: StrategyType;
        indicators: IIndicatorSettings;
        risk: IRiskManagement;
        minSignalStrength: number;
        maxSimultaneousSignals: number;
        isActive: boolean;
        createdAt: Date;
        lastOptimized: Date;
        expectedSignalsPerDay: number;
        performanceRating: string;
        backtestResults?: IStrategyBacktestResult;
        needsOptimization: boolean;
    } {
        return {
            name: this.name,
            description: this.description,
            timeframe: this.timeframe,
            type: this.type,
            indicators: this.indicators,
            risk: this.risk,
            minSignalStrength: this.minSignalStrength,
            maxSimultaneousSignals: this.maxSimultaneousSignals,
            isActive: this.isActive,
            createdAt: this.createdAt,
            lastOptimized: this.lastOptimized,
            expectedSignalsPerDay: this.getExpectedSignalsPerDay(),
            performanceRating: this.getPerformanceRating(),
            backtestResults: this.backtestResults!,
            needsOptimization: this.needsOptimization()
        };
    }

    // Private helper methods

    private static determineTypeFromTimeframe(timeframe: TimeFrame): StrategyType {
        switch (timeframe) {
            case TimeFrame.ONE_MINUTE:
            case TimeFrame.FIVE_MINUTES:
                return StrategyType.SCALPING;
            case TimeFrame.FIFTEEN_MINUTES:
                return StrategyType.INTRADAY;
            case TimeFrame.ONE_HOUR:
                return StrategyType.SWING;
            case TimeFrame.FOUR_HOURS:
            case TimeFrame.ONE_DAY:
                return StrategyType.POSITION;
            default:
                return StrategyType.INTRADAY;
        }
    }

    private getTimeframeInMinutes(): number {
        switch (this.timeframe) {
            case TimeFrame.ONE_MINUTE: return 1;
            case TimeFrame.FIVE_MINUTES: return 5;
            case TimeFrame.FIFTEEN_MINUTES: return 15;
            case TimeFrame.ONE_HOUR: return 60;
            case TimeFrame.FOUR_HOURS: return 240;
            case TimeFrame.ONE_DAY: return 1440;
            default: return 15;
        }
    }

    private getBaseSignalRate(): number {
        // Signal rate per candle based on strategy type and signal strength
        const baseRates = {
            [StrategyType.SCALPING]: 0.05, // 5% of candles generate signals
            [StrategyType.INTRADAY]: 0.03, // 3% of candles generate signals
            [StrategyType.SWING]: 0.015,   // 1.5% of candles generate signals
            [StrategyType.POSITION]: 0.005 // 0.5% of candles generate signals
        };

        const baseRate = baseRates[this.type];

        // Adjust for signal strength requirement (higher strength = fewer signals)
        const strengthMultiplier = Math.max(0.1, 1 - (this.minSignalStrength - 5) * 0.1);

        return baseRate * strengthMultiplier;
    }

    private validateIndicators(): void {
        const { ema, rsi, macd, bollingerBands, volume } = this.indicators;

        // Validate EMA settings
        if (ema.short >= ema.medium || ema.medium >= ema.long) {
            throw new DomainError('EMA periods must be in ascending order: short < medium < long');
        }

        if (ema.short < 1 || ema.medium < 2 || ema.long < 3) {
            throw new DomainError('EMA periods must be positive integers');
        }

        // Validate RSI settings
        if (rsi.period < 2 || rsi.period > 50) {
            throw new DomainError('RSI period must be between 2 and 50');
        }

        if (rsi.oversold >= rsi.overbought) {
            throw new DomainError('RSI oversold level must be less than overbought level');
        }

        if (rsi.oversold < 0 || rsi.overbought > 100) {
            throw new DomainError('RSI levels must be between 0 and 100');
        }

        // Validate MACD settings
        if (macd.fastPeriod >= macd.slowPeriod) {
            throw new DomainError('MACD fast period must be less than slow period');
        }

        if (macd.fastPeriod < 1 || macd.slowPeriod < 2 || macd.signalPeriod < 1) {
            throw new DomainError('MACD periods must be positive integers');
        }

        // Validate Bollinger Bands settings
        if (bollingerBands.period < 2) {
            throw new DomainError('Bollinger Bands period must be at least 2');
        }

        if (bollingerBands.standardDeviation <= 0 || bollingerBands.standardDeviation > 5) {
            throw new DomainError('Bollinger Bands standard deviation must be between 0 and 5');
        }

        // Validate Volume settings
        if (volume.threshold <= 0) {
            throw new DomainError('Volume threshold must be positive');
        }

        if (volume.period < 1) {
            throw new DomainError('Volume period must be at least 1');
        }
    }

    private validateRiskManagement(): void {
        const { stopLoss, takeProfits, maxRiskPerTrade, riskRewardRatio } = this.risk;

        // Validate stop loss
        if (stopLoss <= 0 || stopLoss >= 1) {
            throw new DomainError('Stop loss must be between 0 and 1 (0% to 100%)');
        }

        // Validate take profits
        if (takeProfits.length === 0) {
            throw new DomainError('At least one take profit level is required');
        }

        if (takeProfits.length > 5) {
            throw new DomainError('Maximum 5 take profit levels allowed');
        }

        for (const tp of takeProfits) {
            if (tp <= 0 || tp >= 2) {
                throw new DomainError('Take profit levels must be between 0 and 2 (0% to 200%)');
            }
        }

        // Validate that take profits are in ascending order
        for (let i = 1; i < takeProfits.length; i++) {
            if ((takeProfits[i] as number) <= (takeProfits[i - 1] as number)) {
                throw new DomainError('Take profit levels must be in ascending order');
            }
        }

        // Validate max risk per trade
        if (maxRiskPerTrade <= 0 || maxRiskPerTrade > 10) {
            throw new DomainError('Max risk per trade must be between 0 and 10 (0% to 10% of account)');
        }

        // Validate risk/reward ratio
        if (riskRewardRatio <= 0) {
            throw new DomainError('Risk/reward ratio must be positive');
        }

        // Check if first take profit provides adequate risk/reward
        const firstTpRatio = (takeProfits[0] as number) / stopLoss;
        if (firstTpRatio < 1) {
            throw new DomainError('First take profit should provide at least 1:1 risk/reward ratio');
        }
    }

    private validateParameters(): void {
        // Validate strategy name
        if (!this.name || this.name.trim().length === 0) {
            throw new DomainError('Strategy name cannot be empty');
        }

        if (this.name.length > 50) {
            throw new DomainError('Strategy name cannot exceed 50 characters');
        }

        // Validate min signal strength
        if (this.minSignalStrength < 1 || this.minSignalStrength > 10) {
            throw new DomainError('Minimum signal strength must be between 1 and 10');
        }

        // Validate max simultaneous signals
        if (this.maxSimultaneousSignals < 1 || this.maxSimultaneousSignals > 20) {
            throw new DomainError('Maximum simultaneous signals must be between 1 and 20');
        }

        // Validate timeframe compatibility with strategy type
        this.validateTimeframeCompatibility();
    }

    private validateTimeframeCompatibility(): void {
        const expectedType = Strategy.determineTypeFromTimeframe(this.timeframe);
        if (this.type !== expectedType) {
            console.warn(
                `Strategy type ${this.type} may not be optimal for timeframe ${this.timeframe}. ` +
                `Consider using ${expectedType} type.`
            );
        }
    }
}

// Export the interface for dependency injection
export interface IStrategy {
    readonly name: string;
    readonly description: string;
    readonly timeframe: TimeFrame;
    readonly indicators: IIndicatorSettings;
    readonly risk: IRiskManagement;
    readonly minSignalStrength: number;
    readonly maxSimultaneousSignals: number;
    readonly type: StrategyType;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly lastOptimized: Date;
    readonly backtestResults?: IStrategyBacktestResult | undefined;

    activate(): void;
    deactivate(): void;
    getSignalConditions(): ISignalConditions;
    getExpectedSignalsPerDay(): number;
    needsOptimization(daysSinceLastOptimization?: number): boolean;
    updateBacktestResults(results: IStrategyBacktestResult): void;
    getPerformanceRating(): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'UNKNOWN';
    clone(modifications?: Partial<IStrategyCreateParams>): Strategy;
    optimize(marketVolatility: number): Strategy;
    toPlainObject(): any;
}
