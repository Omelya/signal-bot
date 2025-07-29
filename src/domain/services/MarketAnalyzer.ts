import { MarketData } from '../entities/MarketData';
import { TechnicalIndicators } from '../valueObjects/TechnicalIndicators';
import { IMarketAnalyzer, IMarketAnalysisResult } from './IMarketAnalyzer';
import { ITechnicalIndicatorsService } from '../../infrastructure/external/TechnicalIndicatorsService';
import { ILogger, ITechnicalIndicatorValues, DomainError } from '../../shared';

export class MarketAnalyzer implements IMarketAnalyzer {
    constructor(
        private readonly technicalIndicatorsService: ITechnicalIndicatorsService,
        private readonly logger: ILogger
    ) {}

    async analyze(marketData: MarketData, strategy?: any): Promise<IMarketAnalysisResult> {
        try {
            this.logger.debug(`Analyzing market data for ${marketData.symbol}`, {
                symbol: marketData.symbol,
                exchange: marketData.exchange,
                timeframe: marketData.timeframe,
                candleCount: marketData.candleCount
            });

            // Validate market data
            this.validateMarketData(marketData);

            // Calculate technical indicators
            const indicatorValues = await this.calculateIndicators(marketData, strategy);
            const indicators = TechnicalIndicators.create(indicatorValues);

            // Analyze trend
            const trend = this.analyzeTrend(indicators);

            // Calculate strength
            const strength = this.calculateStrength(indicators, marketData);

            // Assess volatility
            const volatility = this.assessVolatility(marketData, indicatorValues);

            // Analyze volume
            const volume = this.analyzeVolume(marketData, indicatorValues);

            // Generate recommendation
            const recommendation = this.generateRecommendation(indicators, trend, strength, volatility, volume);

            // Calculate confidence
            const confidence = this.calculateConfidence(indicators, trend, strength, volatility, volume);

            // Generate reasoning
            const reasoning = this.generateReasoning(indicators, trend, strength, volatility, volume);

            const result: IMarketAnalysisResult = {
                marketData,
                indicators,
                trend,
                strength,
                volatility,
                volume,
                recommendation,
                confidence,
                reasoning
            };

            this.logger.info(`Market analysis completed for ${marketData.symbol}`, {
                trend,
                strength,
                volatility,
                volume,
                recommendation,
                confidence,
                reasoningCount: reasoning.length
            });

            return result;

        } catch (error: any) {
            this.logger.error(`Failed to analyze market data for ${marketData.symbol}:`, error);
            throw new DomainError(`Market analysis failed: ${error.message}`);
        }
    }

    async calculateIndicators(marketData: MarketData, settings?: any): Promise<ITechnicalIndicatorValues> {
        const candles = marketData.candles;

        // Default settings if not provided
        const indicatorSettings = settings?.indicators || {
            ema: { short: 9, medium: 21, long: 50 },
            rsi: { period: 14 },
            macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
            bollingerBands: { period: 20, standardDeviation: 2 },
            stochastic: { kPeriod: 14, dPeriod: 3 },
            atr: { period: 14 },
            adx: { period: 14 },
            volume: { period: 20 }
        };

        try {
            return this.technicalIndicatorsService.calculateAll(candles, indicatorSettings);
        } catch (error: any) {
            this.logger.error('Failed to calculate technical indicators:', error);
            throw new DomainError(`Technical indicators calculation failed: ${error.message}`);
        }
    }

    async detectPatterns(marketData: MarketData): Promise<{
        patterns: string[];
        bullishSignals: string[];
        bearishSignals: string[];
    }> {
        const patterns: string[] = [];
        const bullishSignals: string[] = [];
        const bearishSignals: string[] = [];

        try {
            const candles = marketData.candles;
            const priceAction = marketData.getPriceAction();

            // Detect candlestick patterns
            this.detectCandlestickPatterns(candles, patterns, bullishSignals, bearishSignals);

            // Detect price action patterns
            this.detectPriceActionPatterns(marketData, priceAction, patterns, bullishSignals, bearishSignals);

            // Detect trend patterns
            this.detectTrendPatterns(marketData, patterns, bullishSignals, bearishSignals);

            this.logger.debug(`Pattern detection completed for ${marketData.symbol}`, {
                patternsCount: patterns.length,
                bullishSignalsCount: bullishSignals.length,
                bearishSignalsCount: bearishSignals.length
            });

            return { patterns, bullishSignals, bearishSignals };

        } catch (error: any) {
            this.logger.error('Pattern detection failed:', error);
            throw new DomainError(`Pattern detection failed: ${error.message}`);
        }
    }

    async assessRisk(marketData: MarketData, analysis: IMarketAnalysisResult): Promise<{
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
        factors: string[];
        recommendation: string;
    }> {
        const factors: string[] = [];
        let riskScore = 0;

        try {
            // Volatility risk
            const volatilityRisk = this.assessVolatilityRisk(analysis.volatility, factors);
            riskScore += volatilityRisk;

            // Volume risk
            const volumeRisk = this.assessVolumeRisk(analysis.volume, factors);
            riskScore += volumeRisk;

            // Trend strength risk
            const trendRisk = this.assessTrendRisk(analysis.trend, analysis.strength, factors);
            riskScore += trendRisk;

            // Market structure risk
            const structureRisk = this.assessMarketStructureRisk(marketData, factors);
            riskScore += structureRisk;

            // Indicator divergence risk
            const divergenceRisk = this.assessDivergenceRisk(analysis.indicators, factors);
            riskScore += divergenceRisk;

            // Determine risk level
            const riskLevel = this.determineRiskLevel(riskScore);

            // Generate risk recommendation
            const recommendation = this.generateRiskRecommendation(riskLevel, factors);

            this.logger.debug(`Risk assessment completed for ${marketData.symbol}`, {
                riskLevel,
                riskScore,
                factorsCount: factors.length
            });

            return { riskLevel, factors, recommendation };

        } catch (error: any) {
            this.logger.error('Risk assessment failed:', error);
            throw new DomainError(`Risk assessment failed: ${error.message}`);
        }
    }

    // Private helper methods

    private validateMarketData(marketData: MarketData): void {
        if (!marketData.hasSufficientData(30)) {
            throw new DomainError('Insufficient market data for analysis');
        }

        if (!marketData.isRecent(10)) {
            throw new DomainError('Market data is too stale for analysis');
        }
    }

    private analyzeTrend(indicators: TechnicalIndicators): 'BULLISH' | 'BEARISH' | 'SIDEWAYS' {
        const overallSignal = indicators.getOverallSignal();

        if (overallSignal.direction === 'BUY' && overallSignal.strength >= 6) {
            return 'BULLISH';
        } else if (overallSignal.direction === 'SELL' && overallSignal.strength >= 6) {
            return 'BEARISH';
        } else {
            return 'SIDEWAYS';
        }
    }

    private calculateStrength(indicators: TechnicalIndicators, marketData: MarketData): number {
        const overallSignal = indicators.getOverallSignal();
        let strength = overallSignal.strength;

        // Adjust strength based on volume
        if (indicators.isVolumeAboveAverage) {
            strength += 1;
        }

        // Adjust strength based on trend consistency
        if (marketData.isMakingHigherHighs(5) || marketData.isMakingLowerLows(5)) {
            strength += 1;
        }

        // Adjust strength based on indicator alignment
        const marketCondition = indicators.getMarketCondition();
        if (marketCondition.momentum === 'STRONG') {
            strength += 1;
        }

        return Math.min(10, Math.max(0, strength));
    }

    private assessVolatility(marketData: MarketData, indicators: ITechnicalIndicatorValues): 'LOW' | 'MEDIUM' | 'HIGH' {
        const statistics = marketData.getStatistics();
        const atr = indicators.atr;
        const currentPrice = marketData.currentPrice;

        // Calculate ATR as percentage of price
        const atrPercentage = (atr / currentPrice) * 100;

        // Determine volatility based on ATR and price volatility
        if (atrPercentage > 5 || statistics.volatility > 0.05) {
            return 'HIGH';
        } else if (atrPercentage > 2 || statistics.volatility > 0.02) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }

    private analyzeVolume(marketData: MarketData, indicators: ITechnicalIndicatorValues): 'LOW' | 'NORMAL' | 'HIGH' {
        const volumeProfile = indicators.volumeProfile;

        if (volumeProfile.ratio > 2.0) {
            return 'HIGH';
        } else if (volumeProfile.ratio > 1.3) {
            return 'NORMAL';
        } else {
            return 'LOW';
        }
    }

    private generateRecommendation(
        indicators: TechnicalIndicators,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        volatility: 'LOW' | 'MEDIUM' | 'HIGH',
        volume: 'LOW' | 'NORMAL' | 'HIGH'
    ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
        const overallSignal = indicators.getOverallSignal();

        // Strong signals with good conditions
        if (overallSignal.direction === 'BUY' && strength >= 8 && volume !== 'LOW') {
            return 'STRONG_BUY';
        }

        if (overallSignal.direction === 'SELL' && strength >= 8 && volume !== 'LOW') {
            return 'STRONG_SELL';
        }

        // Regular signals
        if (overallSignal.direction === 'BUY' && strength >= 6) {
            return 'BUY';
        }

        if (overallSignal.direction === 'SELL' && strength >= 6) {
            return 'SELL';
        }

        // Default to hold for weak or conflicting signals
        return 'HOLD';
    }

    private calculateConfidence(
        indicators: TechnicalIndicators,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        volatility: 'LOW' | 'MEDIUM' | 'HIGH',
        volume: 'LOW' | 'NORMAL' | 'HIGH'
    ): number {
        let confidence = strength * 10; // Base confidence from strength

        // Adjust for trend clarity
        if (trend !== 'SIDEWAYS') {
            confidence += 10;
        }

        // Adjust for volume
        if (volume === 'HIGH') {
            confidence += 10;
        } else if (volume === 'LOW') {
            confidence -= 15;
        }

        // Adjust for volatility
        if (volatility === 'HIGH') {
            confidence -= 10; // High volatility reduces confidence
        } else if (volatility === 'LOW') {
            confidence += 5; // Low volatility slightly increases confidence
        }

        // Adjust for indicator divergence
        if (indicators.hasDivergence()) {
            confidence -= 20;
        }

        return Math.min(100, Math.max(0, confidence));
    }

    private generateReasoning(
        indicators: TechnicalIndicators,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        volatility: 'LOW' | 'MEDIUM' | 'HIGH',
        volume: 'LOW' | 'NORMAL' | 'HIGH'
    ): string[] {
        const reasoning: string[] = [];
        const overallSignal = indicators.getOverallSignal();

        // Trend reasoning
        if (trend === 'BULLISH') {
            reasoning.push('Market shows clear bullish trend');
        } else if (trend === 'BEARISH') {
            reasoning.push('Market shows clear bearish trend');
        } else {
            reasoning.push('Market is in sideways consolidation');
        }

        // Indicator reasoning
        if (overallSignal.indicators.bullish.length > 0) {
            reasoning.push(`Bullish indicators: ${overallSignal.indicators.bullish.join(', ')}`);
        }

        if (overallSignal.indicators.bearish.length > 0) {
            reasoning.push(`Bearish indicators: ${overallSignal.indicators.bearish.join(', ')}`);
        }

        // Volume reasoning
        if (volume === 'HIGH') {
            reasoning.push('High volume confirms price movement');
        } else if (volume === 'LOW') {
            reasoning.push('Low volume suggests weak conviction');
        }

        // Volatility reasoning
        if (volatility === 'HIGH') {
            reasoning.push('High volatility indicates increased risk');
        } else if (volatility === 'LOW') {
            reasoning.push('Low volatility suggests stable conditions');
        }

        // Strength reasoning
        if (strength >= 8) {
            reasoning.push('Strong signal strength provides high confidence');
        } else if (strength <= 4) {
            reasoning.push('Weak signal strength suggests caution');
        }

        return reasoning;
    }

    private detectCandlestickPatterns(
        candles: readonly any[],
        patterns: string[],
        bullishSignals: string[],
        bearishSignals: string[]
    ): void {
        if (candles.length < 3) return;

        const latest = candles[candles.length - 1];
        const previous = candles[candles.length - 2];
        const beforePrevious = candles[candles.length - 3];

        // Doji pattern
        const bodySize = Math.abs(latest.close - latest.open);
        const range = latest.high - latest.low;
        if (bodySize < range * 0.1) {
            patterns.push('Doji');
        }

        // Hammer pattern
        const lowerWick = Math.min(latest.open, latest.close) - latest.low;
        const upperWick = latest.high - Math.max(latest.open, latest.close);
        if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
            patterns.push('Hammer');
            bullishSignals.push('Hammer candlestick pattern');
        }

        // Engulfing patterns
        const currentBullish = latest.close > latest.open;
        const previousBearish = previous.close < previous.open;

        if (currentBullish && previousBearish &&
            latest.open < previous.close && latest.close > previous.open) {
            patterns.push('Bullish Engulfing');
            bullishSignals.push('Bullish engulfing pattern');
        }

        if (!currentBullish && !previousBearish &&
            latest.open > previous.close && latest.close < previous.open) {
            patterns.push('Bearish Engulfing');
            bearishSignals.push('Bearish engulfing pattern');
        }
    }

    private detectPriceActionPatterns(
        marketData: MarketData,
        priceAction: any,
        patterns: string[],
        bullishSignals: string[],
        bearishSignals: string[]
    ): void {
        // Higher highs and higher lows
        if (marketData.isMakingHigherHighs(5)) {
            patterns.push('Higher Highs');
            bullishSignals.push('Making higher highs');
        }

        // Lower highs and lower lows
        if (marketData.isMakingLowerLows(5)) {
            patterns.push('Lower Lows');
            bearishSignals.push('Making lower lows');
        }

        // Price action patterns
        if (priceAction.isHammer) {
            patterns.push('Hammer Price Action');
            bullishSignals.push('Hammer price action');
        }

        if (priceAction.isEngulfing) {
            patterns.push('Engulfing Price Action');
            if (priceAction.isBullish) {
                bullishSignals.push('Bullish engulfing price action');
            } else {
                bearishSignals.push('Bearish engulfing price action');
            }
        }
    }

    private detectTrendPatterns(
        marketData: MarketData,
        patterns: string[],
        bullishSignals: string[],
        bearishSignals: string[]
    ): void {
        const statistics = marketData.getStatistics();

        // Strong uptrend
        if (statistics.priceChangePercent > 5) {
            patterns.push('Strong Uptrend');
            bullishSignals.push('Strong upward price movement');
        }

        // Strong downtrend
        if (statistics.priceChangePercent < -5) {
            patterns.push('Strong Downtrend');
            bearishSignals.push('Strong downward price movement');
        }

        // High volatility breakout
        if (statistics.volatility > 0.05) {
            patterns.push('High Volatility');
            if (statistics.priceChangePercent > 0) {
                bullishSignals.push('High volatility upward breakout');
            } else {
                bearishSignals.push('High volatility downward breakdown');
            }
        }
    }

    private assessVolatilityRisk(volatility: 'LOW' | 'MEDIUM' | 'HIGH', factors: string[]): number {
        switch (volatility) {
            case 'HIGH':
                factors.push('High market volatility increases risk');
                return 3;
            case 'MEDIUM':
                factors.push('Moderate volatility present');
                return 1;
            case 'LOW':
                return 0;
        }
    }

    private assessVolumeRisk(volume: 'LOW' | 'NORMAL' | 'HIGH', factors: string[]): number {
        switch (volume) {
            case 'LOW':
                factors.push('Low volume suggests weak market participation');
                return 2;
            case 'NORMAL':
                return 0;
            case 'HIGH':
                factors.push('High volume provides good liquidity');
                return -1; // Negative risk (good)
        }
    }

    private assessTrendRisk(
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        factors: string[]
    ): number {
        if (trend === 'SIDEWAYS') {
            factors.push('Sideways market increases uncertainty');
            return 2;
        }

        if (strength < 4) {
            factors.push('Weak trend strength reduces reliability');
            return 2;
        }

        return 0;
    }

    private assessMarketStructureRisk(marketData: MarketData, factors: string[]): number {
        const statistics = marketData.getStatistics();
        let risk = 0;

        // Price range analysis
        const priceRange = (statistics.highestPrice - statistics.lowestPrice) / statistics.averagePrice;
        if (priceRange > 0.2) {
            factors.push('Wide price range indicates high volatility period');
            risk += 1;
        }

        // Recent data check
        if (!marketData.isRecent(5)) {
            factors.push('Market data is not recent');
            risk += 1;
        }

        return risk;
    }

    private assessDivergenceRisk(indicators: TechnicalIndicators, factors: string[]): number {
        if (indicators.hasDivergence()) {
            factors.push('Technical indicator divergence detected');
            return 2;
        }
        return 0;
    }

    private determineRiskLevel(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
        if (riskScore >= 8) return 'VERY_HIGH';
        if (riskScore >= 5) return 'HIGH';
        if (riskScore >= 2) return 'MEDIUM';
        return 'LOW';
    }

    private generateRiskRecommendation(
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH',
        factors: string[]
    ): string {
        switch (riskLevel) {
            case 'LOW':
                return 'Low risk environment suitable for normal position sizing';
            case 'MEDIUM':
                return 'Moderate risk present, consider reducing position size by 25%';
            case 'HIGH':
                return 'High risk environment, reduce position size by 50% and use tight stops';
            case 'VERY_HIGH':
                return 'Very high risk, consider avoiding trades or use minimal position sizes';
        }
    }
}
