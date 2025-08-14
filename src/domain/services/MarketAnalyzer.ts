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
            this.validateMarketData(marketData);

            const indicatorValues = await this.calculateIndicators(marketData, strategy);
            const indicators = TechnicalIndicators.create(indicatorValues);

            const trend = this.analyzeTrend(indicators, marketData);

            const strength = this.calculateStrength(indicators, marketData, trend);

            const volatility = this.assessVolatility(marketData, indicatorValues);
            const volume = this.analyzeVolume(marketData, indicatorValues);

            const recommendation = this.generateRecommendation(
                indicators, trend, strength, volatility, volume, marketData
            );

            const confidence = this.calculateConfidence(
                indicators, trend, strength, volatility, volume, marketData
            );

            const reasoning = this.generateReasoning(
                indicators, trend, strength, volatility, volume, marketData
            );

            return {
                marketData,
                indicators,
                trend,
                strength,
                volatility,
                volume,
                recommendation,
                confidence,
                reasoning,
            };

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

    private analyzeTrend(indicators: TechnicalIndicators, marketData: MarketData): 'BULLISH' | 'BEARISH' | 'SIDEWAYS' {
        const overallSignal = indicators.getOverallSignal();
        const statistics = marketData.getStatistics();

        // 1. Аналіз цінового руху (найважливіше!)
        const priceChange24h = statistics.priceChangePercent;
        const priceChange = marketData.getPriceChange(5); // Останні 5 періодів

        // 2. Аналіз положення відносно MA
        const currentPrice = marketData.currentPrice;
        const ema = indicators.values.ema;
        const priceVsMA = {
            aboveShort: currentPrice > ema.short,
            aboveMedium: currentPrice > ema.medium,
            aboveLong: currentPrice > ema.long
        };

        // 3. Momentum аналіз
        const macdSignal = indicators.macdSignal;
        const rsiSignal = indicators.rsiSignal;

        // 4. Аналіз Volume (ТЕПЕР ВИКОРИСТОВУЄТЬСЯ!)
        const isHighVolume = indicators.isVolumeAboveAverage;

        // === СИЛЬНИЙ ВЕДМЕЖИЙ ТРЕНД ===
        if (
            priceChange24h < -3 || // Падіння > 3%
            (priceChange.percentage < -2 && !priceVsMA.aboveShort && isHighVolume) || // Недавнє падіння + під коротким MA + високий об'єм
            (macdSignal === 'SELL' && rsiSignal === 'SELL' && !priceVsMA.aboveMedium)
        ) {
            return 'BEARISH';
        }

        // === СИЛЬНИЙ БИЧАЧИЙ ТРЕНД ===
        if (
            priceChange24h > 3 || // Зростання > 3%
            (priceChange.percentage > 2 && priceVsMA.aboveShort && isHighVolume) || // Недавнє зростання + над коротким MA + високий об'єм
            (macdSignal === 'BUY' && rsiSignal === 'BUY' && priceVsMA.aboveMedium)
        ) {
            return 'BULLISH';
        }

        // === БІЧНИЙ ТРЕНД ===
        // Якщо немає сильних сигналів і ціна коливається
        if (
            Math.abs(priceChange24h) < 2 &&
            Math.abs(priceChange.percentage) < 1.5 &&
            overallSignal.strength < 7
        ) {
            return 'SIDEWAYS';
        }

        // === СЛАБКІ СИГНАЛИ ===
        // Базуємося на індикаторах, але з обережністю
        if (overallSignal.direction === 'BUY' && overallSignal.strength >= 5) {
            // ПОКРАЩЕННЯ: Враховуємо об'єм для підтвердження
            if (priceVsMA.aboveShort && isHighVolume) {
                return 'BULLISH'; // Сильне підтвердження
            } else if (priceVsMA.aboveShort) {
                return 'BULLISH'; // Слабке підтвердження
            } else {
                return isHighVolume ? 'SIDEWAYS' : 'SIDEWAYS'; // Без підтвердження ціни
            }
        }

        if (overallSignal.direction === 'SELL' && overallSignal.strength >= 5) {
            // ПОКРАЩЕННЯ: Враховуємо об'єм для підтвердження
            if (!priceVsMA.aboveShort && isHighVolume) {
                return 'BEARISH'; // Сильне підтвердження
            } else if (!priceVsMA.aboveShort) {
                return 'BEARISH'; // Слабке підтвердження
            } else {
                return isHighVolume ? 'SIDEWAYS' : 'SIDEWAYS'; // Без підтвердження ціни
            }
        }

        // === ДОДАТКОВА ЛОГІКА З ОБ'ЄМОМ ===
        // Високий об'єм без чіткого тренду може сигналізувати про розворот
        if (isHighVolume && Math.abs(priceChange24h) < 1) {
            // Акумуляція або розподіл - потребує додаткового аналізу
            if (priceVsMA.aboveMedium && priceVsMA.aboveLong) {
                return 'BULLISH'; // Можлива акумуляція у висхідному тренді
            } else if (!priceVsMA.aboveMedium && !priceVsMA.aboveLong) {
                return 'BEARISH'; // Можливий розподіл у спадному тренді
            }
        }

        return 'SIDEWAYS';
    }

    private calculateStrength(
        indicators: TechnicalIndicators,
        marketData: MarketData,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
    ): number {
        let strength = indicators.getOverallSignal().strength;
        const statistics = marketData.getStatistics();

        // 1. Bonus за підтвердження тренду ціною
        const priceChange = Math.abs(statistics.priceChangePercent);
        if (trend !== 'SIDEWAYS') {
            if (priceChange > 5) strength += 2;
            else if (priceChange > 3) strength += 1.5;
            else if (priceChange > 1.5) strength += 1;
        }

        // 2. Bonus за об'єм
        if (indicators.isVolumeAboveAverage) {
            strength += 1;
        }
        if (indicators.isHighVolume) {
            strength += 0.5;
        }

        // 3. Bonus за momentum
        const adx = indicators.values.adx;
        if (adx > 25) strength += 1;
        if (adx > 40) strength += 0.5;

        // 4. Penalty за протиріччя
        if (trend === 'SIDEWAYS' && indicators.hasDivergence()) {
            strength -= 1;
        }

        // 5. Bonus за послідовність свічок
        if (marketData.isMakingHigherHighs(3) && trend === 'BULLISH') {
            strength += 1;
        }
        if (marketData.isMakingLowerLows(3) && trend === 'BEARISH') {
            strength += 1;
        }

        return Math.max(0, Math.min(10, Math.round(strength * 10) / 10));
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
        const statistics = marketData.getStatistics();

        // 1. Базовий аналіз за співвідношенням
        let volumeScore = this.calculateBaseVolumeScore(volumeProfile.ratio);

        // 2. Коригування за ціновим рухом
        const priceVolumeAdjustment = this.analyzePriceVolumeRelationship(
            statistics.priceChangePercent,
            volumeProfile.ratio
        );
        volumeScore += priceVolumeAdjustment;

        // 3. Коригування за часом (деякі періоди мають природно вищий об'єм)
        const timeAdjustment = this.getTimeBasedVolumeAdjustment(marketData);
        volumeScore += timeAdjustment;

        // 4. Аналіз тренду об'єму
        const volumeTrendAdjustment = this.analyzeVolumeTrend(marketData, indicators);
        volumeScore += volumeTrendAdjustment;

        // 5. Коригування за волатільністю
        const volatilityAdjustment = this.getVolatilityVolumeAdjustment(
            statistics.volatility,
            volumeProfile.ratio
        );
        volumeScore += volatilityAdjustment;

        return this.determineVolumeCategory(volumeScore);
    }

    private generateRecommendation(
        indicators: TechnicalIndicators,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        volatility: 'LOW' | 'MEDIUM' | 'HIGH',
        volume: 'LOW' | 'NORMAL' | 'HIGH',
        marketData: MarketData,
    ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
        const overallSignal = indicators.getOverallSignal();
        const statistics = marketData.getStatistics();

        // === STRONG SIGNALS ===
        if (trend === 'BEARISH' && strength >= 7 && volume !== 'LOW') {
            // ДОДАНО: Волатільність впливає на силу рекомендації
            if (volatility === 'HIGH' && statistics.priceChangePercent < -7) {
                return 'STRONG_SELL'; // Висока волатільність + сильне падіння
            }
            return statistics.priceChangePercent < -5 ? 'STRONG_SELL' : 'SELL';
        }

        if (trend === 'BULLISH' && strength >= 7 && volume !== 'LOW') {
            // ДОДАНО: Волатільність впливає на силу рекомендації
            if (volatility === 'HIGH' && statistics.priceChangePercent > 7) {
                return 'STRONG_BUY'; // Висока волатільність + сильне зростання
            }
            return statistics.priceChangePercent > 5 ? 'STRONG_BUY' : 'BUY';
        }

        // === MEDIUM SIGNALS ===
        if (trend === 'BEARISH' && strength >= 5) {
            // ДОДАНО: Коригування за волатільністю
            if (volatility === 'HIGH' && strength < 6) {
                return 'HOLD'; // Висока волатільність + слабша сила = обережність
            }
            return 'SELL';
        }

        if (trend === 'BULLISH' && strength >= 5) {
            // ДОДАНО: Коригування за волатільністю
            if (volatility === 'HIGH' && strength < 6) {
                return 'HOLD'; // Висока волатільність + слабша сила = обережність
            }
            return 'BUY';
        }

        // === SIDEWAYS HANDLING ===
        if (trend === 'SIDEWAYS') {
            // В боковому тренді - обережність
            if (strength >= 8 && volume === 'HIGH') {
                // ДОДАНО: Висока волатільність у боковому тренді = особлива обережність
                if (volatility === 'HIGH') {
                    return 'HOLD'; // Занадто ризиковано
                }
                return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
            }
            return 'HOLD';
        }

        // === WEAK SIGNALS ===
        if (strength >= 6 && volume !== 'LOW') {
            // ДОДАНО: Волатільність впливає на слабкі сигнали
            if (volatility === 'HIGH') {
                return 'HOLD'; // Висока волатільність робить слабкі сигнали ненадійними
            }

            // ДОДАНО: Низька волатільність сприяє слабким сигналам
            if (volatility === 'LOW') {
                return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
            }

            // Середня волатільність - стандартна логіка
            return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
        }

        // === ДОДАТКОВА ЛОГІКА З ВОЛАТІЛЬНІСТЮ ===
        // Якщо всі інші умови не спрацювали, але є висока волатільність
        if (volatility === 'HIGH' && strength >= 4) {
            // Висока волатільність може створювати можливості навіть при слабших сигналах
            // але тільки при достатньому об'ємі
            if (volume === 'HIGH' && Math.abs(statistics.priceChangePercent) > 3) {
                return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
            }
        }

        return 'HOLD';
    }

    private calculateConfidence(
        indicators: TechnicalIndicators,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        volatility: 'LOW' | 'MEDIUM' | 'HIGH',
        volume: 'LOW' | 'NORMAL' | 'HIGH',
        marketData: MarketData,
    ): number {
        let confidence = strength * 10; // Базова впевненість

        const statistics = marketData.getStatistics();
        const priceChange = Math.abs(statistics.priceChangePercent);

        // 1. Trend consistency bonus
        if (trend !== 'SIDEWAYS') {
            confidence += 15;

            // Extra bonus for strong price movement
            if (priceChange > 3) confidence += 10;
            if (priceChange > 5) confidence += 5;
        }

        // 2. Volume confirmation
        if (volume === 'HIGH') confidence += 15;
        else if (volume === 'NORMAL') confidence += 5;
        else confidence -= 10;

        // 3. Indicator alignment
        const overallSignal = indicators.getOverallSignal();
        const alignmentBonus = overallSignal.indicators.bullish.length + overallSignal.indicators.bearish.length;
        confidence += alignmentBonus * 3;

        // 4. Volatility adjustment
        if (volatility === 'HIGH' && trend !== 'SIDEWAYS') {
            confidence += 5; // Високa волатильність + тренд = можливість
        } else if (volatility === 'HIGH') {
            confidence -= 10; // Висока волатильність без тренду = ризик
        }

        // 5. Pattern recognition bonus
        const priceAction = marketData.getPriceAction();
        if (priceAction.isEngulfing) confidence += 10;
        if (priceAction.isHammer) confidence += 5;

        // 6. Penalty for divergence
        if (indicators.hasDivergence()) confidence -= 15;

        // 7. Time-based adjustments
        const age = marketData.getAgeInMinutes();
        if (age > 10) confidence -= 5; // Stale data penalty

        return Math.max(0, Math.min(100, Math.round(confidence)));
    }

    private generateReasoning(
        indicators: TechnicalIndicators,
        trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
        strength: number,
        volatility: 'LOW' | 'MEDIUM' | 'HIGH',
        volume: 'LOW' | 'NORMAL' | 'HIGH',
        marketData: MarketData,
    ): string[] {
        const reasoning: string[] = [];
        const overallSignal = indicators.getOverallSignal();
        const statistics = marketData.getStatistics();
        const priceChange = statistics.priceChangePercent;

        // 1. Trend reasoning з урахуванням СИЛИ
        if (trend === 'BEARISH') {
            const strengthText = strength >= 8 ? 'дуже сильний' : strength >= 6 ? 'сильний' : 'помірний';
            reasoning.push(`${strengthText} ведмежий тренд: ціна впала на ${Math.abs(priceChange).toFixed(1)}% (сила: ${strength}/10)`);
        } else if (trend === 'BULLISH') {
            const strengthText = strength >= 8 ? 'дуже сильний' : strength >= 6 ? 'сильний' : 'помірний';
            reasoning.push(`${strengthText} бичачий тренд: ціна зросла на ${priceChange.toFixed(1)}% (сила: ${strength}/10)`);
        } else {
            reasoning.push(`Бічний тренд: ціна коливається в діапазоні (сила сигналів: ${strength}/10)`);
        }

        // 2. Technical indicators
        if (overallSignal.indicators.bullish.length > 0) {
            reasoning.push(`Бичачі індикатори: ${overallSignal.indicators.bullish.join(', ')}`);
        }
        if (overallSignal.indicators.bearish.length > 0) {
            reasoning.push(`Ведмежі індикатори: ${overallSignal.indicators.bearish.join(', ')}`);
        }

        // 3. Volume analysis
        if (volume === 'HIGH') {
            reasoning.push(`Високий об'єм підтверджує рух ціни`);
        } else if (volume === 'LOW') {
            reasoning.push(`Низький об'єм - слабке підтвердження`);
        }

        // 4. Price action
        const currentPrice = marketData.currentPrice;
        const ema = indicators.values.ema;
        if (currentPrice > ema.medium) {
            reasoning.push(`Ціна вище середнього MA (${ema.medium.toFixed(6)})`);
        } else {
            reasoning.push(`Ціна нижче середнього MA (${ema.medium.toFixed(6)})`);
        }

        // 5. Volatility
        if (volatility === 'HIGH') {
            reasoning.push(`Висока волатільність - збільшений ризик і можливості`);
        }

        // 6. Momentum
        const adx = indicators.values.adx;
        if (adx > 25) {
            reasoning.push(`Сильний momentum (ADX: ${adx.toFixed(1)})`);
        }

        // 7. Pattern recognition
        const priceAction = marketData.getPriceAction();
        if (priceAction.isEngulfing) {
            reasoning.push(`Виявлено поглинаючий патерн`);
        }
        if (priceAction.isHammer) {
            reasoning.push(`Виявлено молоток - можливий розворот`);
        }

        // 8. ДОДАНО: Аналіз сили сигналу
        if (strength >= 9) {
            reasoning.push(`💪 Винятково сильний сигнал - високі шанси на успіх`);
        } else if (strength >= 7) {
            reasoning.push(`🔥 Сильний сигнал з добрими шансами`);
        } else if (strength >= 5) {
            reasoning.push(`⚡ Помірний сигнал - необхідна обережність`);
        } else if (strength < 4) {
            reasoning.push(`⚠️ Слабкий сигнал - високий ризик`);
        }

        // 9. Risk warnings
        if (indicators.hasDivergence()) {
            reasoning.push(`⚠️ Розбіжність між індикаторами`);
        }

        if (marketData.getAgeInMinutes() > 10) {
            reasoning.push(`⚠️ Дані застарілі (${marketData.getAgeInMinutes()} хв)`);
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

    private calculateBaseVolumeScore(ratio: number): number {
        if (ratio > 3.0) return 10;      // Екстремально високий
        if (ratio > 2.5) return 9;       // Дуже високий
        if (ratio > 2.0) return 8;       // Високий
        if (ratio > 1.5) return 6;       // Вище норми
        if (ratio > 1.3) return 5;       // Нормальний
        if (ratio > 1.0) return 4;       // Трохи нижче норми
        if (ratio > 0.7) return 3;       // Низький
        if (ratio > 0.5) return 2;       // Дуже низький
        return 1;                        // Екстремально низький
    }

    private analyzePriceVolumeRelationship(priceChange: number, volumeRatio: number): number {
        const absPriceChange = Math.abs(priceChange);

        // Здоровий ринок: великі цінові рухи супроводжуються високим об'ємом
        if (absPriceChange > 5 && volumeRatio > 2.0) {
            return 2; // Підтвердження сильного руху
        }

        // Великий ціновий рух на малому об'ємі - підозріло
        if (absPriceChange > 3 && volumeRatio < 0.8) {
            return -2; // Слабке підтвердження
        }

        // Високий об'єм без суттєвої зміни ціни - акумуляція/розподіл
        if (absPriceChange < 1 && volumeRatio > 2.0) {
            return 1; // Цікавий сигнал
        }

        // Малий рух на нормальному об'ємі
        if (absPriceChange < 2 && volumeRatio >= 1.0 && volumeRatio <= 1.5) {
            return 0; // Нейтрально
        }

        return 0;
    }

    private getTimeBasedVolumeAdjustment(marketData: MarketData): number {
        const now = new Date();
        const hour = now.getUTCHours();

        // Коригування за часовими поясами (UTC)
        // Високий об'єм під час активних торгових сесій

        // Азійська сесія (00:00-08:00 UTC)
        if (hour >= 0 && hour < 8) {
            return 0; // Нейтрально
        }

        // Європейська сесія (08:00-16:00 UTC)
        if (hour >= 8 && hour < 16) {
            return 0.5; // Трохи вищий об'єм очікується
        }

        // Американська сесія (13:00-22:00 UTC) - перекриття з Європою
        if (hour >= 13 && hour < 22) {
            return 1; // Найвищий об'єм очікується
        }

        // Нічний час
        return -0.5; // Нижчий об'єм природний
    }

    private analyzeVolumeTrend(marketData: MarketData, indicators: ITechnicalIndicatorValues): number {
        // Якщо є доступ до історичних даних об'єму
        const volumeProfile = indicators.volumeProfile;

        // Простий аналіз тренду об'єму
        // В ідеалі тут буде аналіз останніх N періодів

        // Якщо поточний об'єм значно вищий за середній
        if (volumeProfile.ratio > 2.0) {
            // Перевіряємо чи це частина тренду зростання об'єму
            return 0.5; // Позитивний тренд об'єму
        }

        // Якщо об'єм падає
        if (volumeProfile.ratio < 0.8) {
            return -0.5; // Негативний тренд об'єму
        }

        return 0;
    }

    private getVolatilityVolumeAdjustment(volatility: number, volumeRatio: number): number {
        // Висока волатільність зазвичай супроводжується високим об'ємом
        if (volatility > 0.05) { // Висока волатільність
            if (volumeRatio > 1.5) {
                return 1; // Очікувано високий об'єм
            } else {
                return -1; // Неочікувано низький об'єм при високій волатільності
            }
        }

        // Низька волатільність
        if (volatility < 0.02) {
            if (volumeRatio > 2.0) {
                return 1; // Неочікувано високий об'єм - можливі новини
            }
        }

        return 0;
    }

    private determineVolumeCategory(score: number): 'LOW' | 'NORMAL' | 'HIGH' {
        if (score >= 8) return 'HIGH';
        if (score >= 4) return 'NORMAL';
        return 'LOW';
    }
}
