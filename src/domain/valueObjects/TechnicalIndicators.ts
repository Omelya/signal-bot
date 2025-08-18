import {ITechnicalIndicatorValues} from '../../shared';

type SignalDirection = 'BUY' | 'SELL' | 'NEUTRAL';
type TrendDirection = 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
type VolatilityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type MomentumLevel = 'STRONG' | 'WEAK' | 'NEUTRAL';
type VolumeLevel = 'STRONG' | 'WEAK' | 'NORMAL';

interface OverallSignalResult {
    direction: SignalDirection;
    strength: number; // 0-10
    confidence: number; // 0-100
    indicators: {
        bullish: string[];
        bearish: string[];
        neutral: string[];
    };
}

interface MarketConditionResult {
    trend: TrendDirection;
    volatility: VolatilityLevel;
    momentum: MomentumLevel;
    volume: VolumeLevel;
}

interface AnalysisResult {
    overallSignal: OverallSignalResult;
    marketCondition: MarketConditionResult;
    hasDivergence: boolean;
}

export class TechnicalIndicators {
    constructor(
        private readonly _values: ITechnicalIndicatorValues,
        private readonly _timestamp: number = Date.now()
    ) {
        this.validate();
    }

    static create(values: ITechnicalIndicatorValues): TechnicalIndicators {
        return new TechnicalIndicators(values);
    }

    get values(): ITechnicalIndicatorValues { return this._values; }
    get timestamp(): number { return this._timestamp; }

    // RSI Analysis
    get isRsiOversold(): boolean {
        return this._values.rsi <= 30;
    }

    get isRsiOverbought(): boolean {
        return this._values.rsi >= 70;
    }

    get rsiSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
        if (this.isRsiOversold) return 'BUY';
        if (this.isRsiOverbought) return 'SELL';
        return 'NEUTRAL';
    }

    // EMA Analysis
    get isBullishEmaAlignment(): boolean {
        const { short, medium, long } = this._values.ema;
        return short > medium && medium > long;
    }

    get isBearishEmaAlignment(): boolean {
        const { short, medium, long } = this._values.ema;
        return short < medium && medium < long;
    }

    get emaSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
        if (this.isBullishEmaAlignment) return 'BUY';
        if (this.isBearishEmaAlignment) return 'SELL';
        return 'NEUTRAL';
    }

    // MACD Analysis
    get isMacdBullish(): boolean {
        return this._values.macd.line > this._values.macd.signal && this._values.macd.histogram > 0;
    }

    get isMacdBearish(): boolean {
        return this._values.macd.line < this._values.macd.signal && this._values.macd.histogram < 0;
    }

    get macdSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
        if (this.isMacdBullish) return 'BUY';
        if (this.isMacdBearish) return 'SELL';
        return 'NEUTRAL';
    }

    // Bollinger Bands Analysis
    get isNearBollingerLower(): boolean {
        const { lower, middle } = this._values.bollingerBands;

        return Math.abs(middle - lower) / lower < 0.02; // Within 2%
    }

    get isNearBollingerUpper(): boolean {
        const { upper, middle } = this._values.bollingerBands;

        return Math.abs(middle - upper) / upper < 0.02; // Within 2%
    }

    get bollingerSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
        if (this.isNearBollingerLower) return 'BUY';
        if (this.isNearBollingerUpper) return 'SELL';

        return 'NEUTRAL';
    }

    // Stochastic Analysis
    get isStochasticOversold(): boolean {
        return this._values.stochastic.k <= 20 && this._values.stochastic.d <= 20;
    }

    get isStochasticOverbought(): boolean {
        return this._values.stochastic.k >= 80 && this._values.stochastic.d >= 80;
    }

    get stochasticSignal(): 'BUY' | 'SELL' | 'NEUTRAL' {
        if (this.isStochasticOversold) return 'BUY';
        if (this.isStochasticOverbought) return 'SELL';

        return 'NEUTRAL';
    }

    // Volume Analysis
    get isVolumeAboveAverage(): boolean {
        return this._values.volumeProfile.ratio > 1.5;
    }

    get isHighVolume(): boolean {
        return this._values.volumeProfile.ratio > 2.0;
    }

    get volumeSignal(): 'STRONG' | 'WEAK' | 'NORMAL' {
        if (this.isHighVolume) return 'STRONG';
        if (this._values.volumeProfile.ratio < 0.7) return 'WEAK';

        return 'NORMAL';
    }

    // Trend Strength
    get trendStrength(): 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' {
        if (this._values.adx >= 50) return 'VERY_STRONG';
        if (this._values.adx >= 25) return 'STRONG';
        if (this._values.adx >= 15) return 'MODERATE';
        return 'WEAK';
    }

    // Volatility Analysis
    get volatilityLevel(): 'HIGH' | 'MEDIUM' | 'LOW' {
        // ATR-based volatility classification
        const atrRatio = this._values.atr / this._values.bollingerBands.middle;
        if (atrRatio > 0.03) return 'HIGH';
        if (atrRatio > 0.015) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Get overall signal based on all indicators
     */
    public getOverallSignal(): OverallSignalResult {
        const signals = {
            rsi: this.rsiSignal,
            ema: this.emaSignal,
            macd: this.macdSignal,
            bollinger: this.bollingerSignal,
            stochastic: this.stochasticSignal
        };

        const bullishIndicators: string[] = [];
        const bearishIndicators: string[] = [];
        const neutralIndicators: string[] = [];

        let bullishCount = 0;
        let bearishCount = 0;

        Object.entries(signals).forEach(([indicator, signal]) => {
            if (signal === 'BUY') {
                bullishIndicators.push(indicator);
                bullishCount++;
            } else if (signal === 'SELL') {
                bearishIndicators.push(indicator);
                bearishCount++;
            } else {
                neutralIndicators.push(indicator);
            }
        });

        // Determine overall direction
        let direction: 'BUY' | 'SELL' | 'NEUTRAL';
        if (bullishCount > bearishCount) {
            direction = 'BUY';
        } else if (bearishCount > bullishCount) {
            direction = 'SELL';
        } else {
            direction = 'NEUTRAL';
        }

        // Calculate strength (0-10)
        const totalIndicators = Object.keys(signals).length;
        const dominantCount = Math.max(bullishCount, bearishCount);
        const strength = Math.round((dominantCount / totalIndicators) * 10);

        // Calculate confidence (0-100)
        let confidence = (dominantCount / totalIndicators) * 100;

        // Boost confidence for trend strength and volume
        if (this.trendStrength === 'VERY_STRONG' || this.trendStrength === 'STRONG') {
            confidence *= 1.2;
        }
        if (this.isVolumeAboveAverage) {
            confidence *= 1.1;
        }

        confidence = Math.min(100, Math.round(confidence));

        return {
            direction,
            strength,
            confidence,
            indicators: {
                bullish: bullishIndicators,
                bearish: bearishIndicators,
                neutral: neutralIndicators
            }
        };
    }

    /**
     * Check if indicators are diverging (conflicting signals)
     */
    public hasDivergence(): boolean {
        const overallSignal = this.getOverallSignal();
        const { bullish, bearish } = overallSignal.indicators;

        // Consider divergence if we have significant conflicting signals
        return bullish.length >= 2 && bearish.length >= 2;
    }

    /**
     * Get market condition assessment
     */
    public getMarketCondition(): MarketConditionResult {
        const overallSignal = this.getOverallSignal();

        let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
        if (overallSignal.direction === 'BUY') trend = 'BULLISH';
        else if (overallSignal.direction === 'SELL') trend = 'BEARISH';
        else trend = 'SIDEWAYS';

        let momentum: 'STRONG' | 'WEAK' | 'NEUTRAL';
        if (this.trendStrength === 'VERY_STRONG' || this.trendStrength === 'STRONG') {
            momentum = 'STRONG';
        } else if (this.trendStrength === 'WEAK') {
            momentum = 'WEAK';
        } else {
            momentum = 'NEUTRAL';
        }

        return {
            trend,
            volatility: this.volatilityLevel,
            momentum,
            volume: this.volumeSignal
        };
    }

    /**
     * Convert to plain object
     */
    public toPlainObject(): {
        values: ITechnicalIndicatorValues;
        timestamp: number;
        analysis: AnalysisResult;
    } {
        return {
            values: this._values,
            timestamp: this._timestamp,
            analysis: {
                overallSignal: this.getOverallSignal(),
                marketCondition: this.getMarketCondition(),
                hasDivergence: this.hasDivergence()
            }
        };
    }

    private validate(): void {
        const { rsi, atr, adx } = this._values;

        // Validate RSI
        if (rsi < 0 || rsi > 100) {
            throw new Error('RSI must be between 0 and 100');
        }

        // Validate ATR
        if (atr < 0) {
            throw new Error('ATR cannot be negative');
        }

        // Validate ADX
        if (adx < 0 || adx > 100) {
            throw new Error('ADX must be between 0 and 100');
        }

        // Validate Stochastic
        const { k, d } = this._values.stochastic;
        if (k < 0 || k > 100 || d < 0 || d > 100) {
            throw new Error('Stochastic values must be between 0 and 100');
        }

        // Validate EMA order
        const { short, medium, long } = this._values.ema;
        if (short <= 0 || medium <= 0 || long <= 0) {
            throw new Error('EMA values must be positive');
        }

        // Validate Bollinger Bands
        const { lower, middle, upper } = this._values.bollingerBands;
        if (lower > 0 || middle > 0 || upper > 0) {
            if (lower >= middle || middle >= upper) {
                throw new Error('Bollinger Bands must be in order: lower < middle < upper');
            }
        }
    }
}
