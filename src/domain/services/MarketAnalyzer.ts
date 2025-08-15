import { MarketData } from '../entities/MarketData';
import { TechnicalIndicators } from '../valueObjects/TechnicalIndicators';
import { IMarketAnalyzer, IMarketAnalysisResult } from './IMarketAnalyzer';
import { ITechnicalIndicatorsService } from '../../infrastructure/external/TechnicalIndicatorsService';
import {ILogger, ITechnicalIndicatorValues, DomainError} from '../../shared';
import {PatternDetector, PatternDetectors} from "./PatternDetector";
import {VolumeAnalyzer, VolumeLevelEnum} from "./analyzers/VolumeAnalyzer";
import {TrendAnalyzer, TrendEnum} from "./analyzers/TrendAnalyzer";
import {RiskAssessmentService, VolatileLevelEnum} from "./risk/RiskAssessmentService";

export class MarketAnalyzer implements IMarketAnalyzer {
    constructor(
        private readonly technicalIndicatorsService: ITechnicalIndicatorsService,
        private readonly logger: ILogger
    ) {}

    public analyze(marketData: MarketData, strategy?: any): IMarketAnalysisResult {
        try {
            this.validateMarketData(marketData);

            const indicatorValues = this.calculateIndicators(marketData, strategy);
            const indicators = TechnicalIndicators.create(indicatorValues);

            const trend = new TrendAnalyzer().analyzeTrend(indicators, marketData);

            const strength = this.calculateStrength(indicators, marketData, trend);

            const volatility = this.assessVolatility(marketData, indicatorValues);
            const volume = new VolumeAnalyzer().analyzeVolume(marketData, indicatorValues);

            const patterns = this.detectPatterns(marketData);

            const recommendation = this.generateRecommendation(
                indicators, trend, strength, volatility, volume, marketData
            );

            const confidence = this.calculateConfidence(
                indicators, trend, strength, volatility, volume, marketData
            );

            const reasoning = this.generateReasoning(
                indicators, trend, strength, volatility, volume, marketData
            );

            const patternReasoning = this.generatePatternReasoning(patterns);
            reasoning.push(...patternReasoning);

            const riskResult = new RiskAssessmentService(this.logger).assessRisk(marketData, {
                marketData, indicators, trend, strength, volatility, volume,
                recommendation, confidence, reasoning
            });

            reasoning.push(`🛡️ Ризик: ${riskResult.riskLevel}`);
            reasoning.push(`📋 ${riskResult.recommendation}`);

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

    public calculateIndicators(marketData: MarketData, settings?: any):ITechnicalIndicatorValues {
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

    public detectPatterns(marketData: MarketData): PatternDetectors {
        try {
            return new PatternDetector(marketData)
                .detectCandlestickPatterns()
                .detectPriceActionPatterns()
                .detectTrendPatterns()
                .result();
        } catch (error: any) {
            this.logger.error('Pattern detection failed:', error);
            throw new DomainError(`Pattern detection failed: ${error.message}`);
        }
    }

    private validateMarketData(marketData: MarketData): void {
        if (!marketData.hasSufficientData(30)) {
            throw new DomainError('Insufficient market data for analysis');
        }

        if (!marketData.isRecent(10)) {
            throw new DomainError('Market data is too stale for analysis');
        }
    }

    private calculateStrength(
        indicators: TechnicalIndicators,
        marketData: MarketData,
        trend: TrendEnum,
    ): number {
        let strength = indicators.getOverallSignal().strength;
        const statistics = marketData.getStatistics();

        // 1. Bonus за підтвердження тренду ціною
        const priceChange = Math.abs(statistics.priceChangePercent);
        if (trend !== TrendEnum.SIDEWAYS) {
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
        if (trend === TrendEnum.SIDEWAYS && indicators.hasDivergence()) {
            strength -= 1;
        }

        // 5. Bonus за послідовність свічок
        if (marketData.isMakingHigherHighs(3) && trend === TrendEnum.BULLISH) {
            strength += 1;
        }

        if (marketData.isMakingLowerLows(3) && trend === TrendEnum.BEARISH) {
            strength += 1;
        }

        return Math.max(0, Math.min(10, Math.round(strength * 10) / 10));
    }

    private assessVolatility(marketData: MarketData, indicators: ITechnicalIndicatorValues): VolatileLevelEnum {
        const statistics = marketData.getStatistics();
        const atr = indicators.atr;
        const currentPrice = marketData.currentPrice;

        const atrPercentage = (atr / currentPrice) * 100;

        if (atrPercentage > 5 || statistics.volatility > 0.05) {
            return VolatileLevelEnum.HIGH;
        } else if (atrPercentage > 2 || statistics.volatility > 0.02) {
            return VolatileLevelEnum.MEDIUM;
        } else {
            return VolatileLevelEnum.LOW;
        }
    }

    private generateRecommendation(
        indicators: TechnicalIndicators,
        trend: TrendEnum,
        strength: number,
        volatility: VolatileLevelEnum,
        volume: VolumeLevelEnum,
        marketData: MarketData,
    ): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
        const overallSignal = indicators.getOverallSignal();
        const statistics = marketData.getStatistics();

        // === STRONG SIGNALS ===
        if (trend === TrendEnum.BEARISH && strength >= 7 && volume !== VolumeLevelEnum.LOW) {
            if (volatility === VolatileLevelEnum.HIGH && statistics.priceChangePercent < -7) {
                return 'STRONG_SELL';
            }

            return statistics.priceChangePercent < -5 ? 'STRONG_SELL' : 'SELL';
        }

        if (trend === TrendEnum.BULLISH && strength >= 7 && volume !== VolumeLevelEnum.LOW) {
            if (volatility === VolatileLevelEnum.HIGH && statistics.priceChangePercent > 7) {
                return 'STRONG_BUY';
            }

            return statistics.priceChangePercent > 5 ? 'STRONG_BUY' : 'BUY';
        }

        if (trend === TrendEnum.BEARISH && strength >= 5) {
            if (volatility === VolatileLevelEnum.HIGH && strength < 6) {
                return 'HOLD';
            }

            return 'SELL';
        }

        if (trend === TrendEnum.BULLISH && strength >= 5) {
            if (volatility === VolatileLevelEnum.HIGH && strength < 6) {
                return 'HOLD';
            }

            return 'BUY';
        }

        if (trend === TrendEnum.SIDEWAYS) {
            if (strength >= 8 && volume === VolumeLevelEnum.HIGH) {
                if (volatility === VolatileLevelEnum.HIGH) {
                    return 'HOLD';
                }

                return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
            }

            return 'HOLD';
        }

        if (strength >= 6 && volume !== VolumeLevelEnum.LOW) {
            if (volatility === VolatileLevelEnum.HIGH) {
                return 'HOLD';
            }

            if (volatility === VolatileLevelEnum.LOW) {
                return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
            }

            return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
        }

        if (volatility === VolatileLevelEnum.HIGH && strength >= 4) {
            if (volume === VolumeLevelEnum.HIGH && Math.abs(statistics.priceChangePercent) > 3) {
                return overallSignal.direction === 'BUY' ? 'BUY' : 'SELL';
            }
        }

        return 'HOLD';
    }

    private calculateConfidence(
        indicators: TechnicalIndicators,
        trend: TrendEnum,
        strength: number,
        volatility: VolatileLevelEnum,
        volume: VolumeLevelEnum,
        marketData: MarketData,
    ): number {
        let confidence = strength * 10;

        const statistics = marketData.getStatistics();
        const priceChange = Math.abs(statistics.priceChangePercent);

        // 1. Trend consistency bonus
        if (trend !== TrendEnum.SIDEWAYS) {
            confidence += 15;

            if (priceChange > 3) confidence += 10;
            if (priceChange > 5) confidence += 5;
        }

        if (volume === VolumeLevelEnum.HIGH) confidence += 15;
        else if (volume === VolumeLevelEnum.NORMAL) confidence += 5;
        else confidence -= 10;

        // 3. Indicator alignment
        const overallSignal = indicators.getOverallSignal();
        const alignmentBonus = overallSignal.indicators.bullish.length + overallSignal.indicators.bearish.length;
        confidence += alignmentBonus * 3;

        // 4. Volatility adjustment
        if (volatility === VolatileLevelEnum.HIGH && trend !== TrendEnum.SIDEWAYS) {
            confidence += 5;
        } else if (volatility === VolatileLevelEnum.HIGH) {
            confidence -= 10;
        }

        // 5. Pattern recognition bonus
        const priceAction = marketData.getPriceAction();
        if (priceAction.isEngulfing) confidence += 10;
        if (priceAction.isHammer) confidence += 5;

        // 6. Penalty for divergence
        if (indicators.hasDivergence()) confidence -= 15;

        // 7. Time-based adjustments
        const age = marketData.getAgeInMinutes();
        if (age > 10) confidence -= 5;

        return Math.max(0, Math.min(100, Math.round(confidence)));
    }

    private generateReasoning(
        indicators: TechnicalIndicators,
        trend: TrendEnum,
        strength: number,
        volatility: VolatileLevelEnum,
        volume: VolumeLevelEnum,
        marketData: MarketData,
    ): string[] {
        const reasoning: string[] = [];
        const overallSignal = indicators.getOverallSignal();
        const statistics = marketData.getStatistics();
        const priceChange = statistics.priceChangePercent;

        // 1. Trend reasoning з урахуванням СИЛИ
        if (trend === TrendEnum.BEARISH) {
            const strengthText = strength >= 8 ? 'дуже сильний' : strength >= 6 ? 'сильний' : 'помірний';
            reasoning.push(`${strengthText} ведмежий тренд: ціна впала на ${Math.abs(priceChange).toFixed(1)}% (сила: ${strength}/10)`);
        } else if (trend === TrendEnum.BULLISH) {
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
        if (volume === VolumeLevelEnum.HIGH) {
            reasoning.push(`Високий об'єм підтверджує рух ціни`);
        } else if (volume === VolumeLevelEnum.LOW) {
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
        if (volatility === VolatileLevelEnum.HIGH) {
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

    private generatePatternReasoning(patterns: {
        patterns: string[];
        bullishSignals: string[];
        bearishSignals: string[];
    }): string[] {
        const patternReasoning: string[] = [];

        if (patterns.patterns.length > 0) {
            patternReasoning.push('📊 Виявлені патерни:');
            patterns.patterns.forEach(pattern => {
                patternReasoning.push(`  • ${pattern}`);
            });
        }

        if (patterns.bullishSignals.length > 0) {
            patternReasoning.push('📈 Бичачі сигнали:');
            patterns.bullishSignals.forEach(signal => {
                patternReasoning.push(`  • ${signal}`);
            });
        }

        if (patterns.bearishSignals.length > 0) {
            patternReasoning.push('📉 Ведмежі сигнали:');
            patterns.bearishSignals.forEach(signal => {
                patternReasoning.push(`  • ${signal}`);
            });
        }

        if (patterns.patterns.length === 0 && patterns.bullishSignals.length === 0 && patterns.bearishSignals.length === 0) {
            patternReasoning.push('📊 Значущих патернів не виявлено');
        }

        return patternReasoning;
    }
}
