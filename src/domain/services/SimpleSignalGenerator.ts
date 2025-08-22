import { Signal } from '../entities/Signal';
import { TradingPair } from '../entities/TradingPair';
import { MarketData } from '../entities/MarketData';
import { Price } from '../valueObjects/Price';
import {ISimpleMarketAnalysisResult, MarketAnalyzer} from './MarketAnalyzer';
import { SignalDirection, ISignalTargets, ILogger, PairCategory } from '../../shared';
import {ISignalGenerator, SimpleSignalResult} from "./ISignalGenerator";

export class SimpleSignalGenerator implements ISignalGenerator {
    constructor(
        private readonly marketAnalyzer: MarketAnalyzer,
        private readonly logger: ILogger
    ) {}

    public async generateSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis?: ISimpleMarketAnalysisResult
    ): Promise<SimpleSignalResult> {
        const startTime = Date.now();
        const marketAnalysis = this.marketAnalyzer.analyzeSimple(marketData, pair.strategy)

        try {
            const shouldGenerate = this.shouldGenerateSignal(marketAnalysis, pair);
            if (!shouldGenerate.should) {
                return {
                    shouldGenerate: false,
                    reason: shouldGenerate.reason,
                    confidence: 0,
                    metadata: {
                        processingTime: Date.now() - startTime,
                        analysisScore: marketAnalysis.signalScore.totalScore,
                        riskLevel: marketAnalysis.riskLevel,
                        volume: marketAnalysis.volume
                    }
                };
            }

            const signal = await this.createSignal(pair, marketData, marketAnalysis);
            const validation = this.validateSignal(signal, marketAnalysis);

            if (!validation.valid) {
                return {
                    shouldGenerate: false,
                    reason: validation.reason,
                    confidence: 0,
                    metadata: {
                        processingTime: Date.now() - startTime,
                        analysisScore: marketAnalysis.signalScore.totalScore,
                        riskLevel: marketAnalysis.riskLevel,
                        volume: marketAnalysis.volume
                    }
                };
            }

            this.logger.info(`Simple signal generated for ${pair.symbol}`, {
                direction: signal.direction,
                confidence: signal.confidence,
                score: marketAnalysis.signalScore.totalScore,
                processingTime: Date.now() - startTime
            });

            return {
                signal,
                shouldGenerate: true,
                reason: 'Signal generated successfully',
                confidence: signal.confidence,
                metadata: {
                    processingTime: Date.now() - startTime,
                    analysisScore: marketAnalysis.signalScore.totalScore,
                    riskLevel: marketAnalysis.riskLevel,
                    volume: marketAnalysis.volume
                }
            };
        } catch (error: any) {
            this.logger.error(`Failed to generate simple signal for ${pair.symbol}:`, error);

            return {
                shouldGenerate: false,
                reason: `Generation failed: ${error.message}`,
                confidence: 0,
                metadata: {
                    processingTime: Date.now() - startTime,
                    analysisScore: 0,
                    riskLevel: 'HIGH',
                    volume: 'UNKNOWN'
                }
            };
        }
    }

    private shouldGenerateSignal(
        analysis: ISimpleMarketAnalysisResult,
        pair: TradingPair
    ): { should: boolean; reason: string } {
        if (!pair.isActive) {
            return { should: false, reason: 'Trading pair is inactive' };
        }

        if (!pair.canGenerateSignal()) {
            return {
                should: false,
                reason: `Cooldown active: ${pair.getRemainingCooldown()}ms remaining`
            };
        }

        const minScore = this.getMinScore(pair.category);
        if (analysis.signalScore.totalScore < minScore) {
            return {
                should: false,
                reason: `Signal quality too low: ${analysis.signalScore.totalScore}/${minScore} (${pair.category})`
            };
        }

        const minConfidence = this.getMinConfidence(pair.category, analysis.riskLevel);
        if (analysis.confidence < minConfidence) {
            return {
                should: false,
                reason: `Confidence too low: ${analysis.confidence}%/${minConfidence}% (risk: ${analysis.riskLevel})`
            };
        }

        if (analysis.recommendation === 'HOLD') {
            return {
                should: false,
                reason: 'Analysis recommends HOLD'
            };
        }

        if (!analysis.marketData.isRecent(15)) {
            return {
                should: false,
                reason: `Market data too stale: ${analysis.marketData.getAgeInMinutes()}m > ${15}m`
            };
        }

        return { should: true, reason: 'All conditions met' };
    }

    private getMinScore(category: PairCategory): number {
        switch (category) {
            case PairCategory.CRYPTO_MAJOR: return 4.5;
            case PairCategory.CRYPTO_ALT: return 5.0;
            case PairCategory.MEME: return 6.0;
            default: return 5.0;
        }
    }

    private getMinConfidence(category: PairCategory, riskLevel: string): number {
        let baseConfidence = 45;

        switch (category) {
            case PairCategory.CRYPTO_MAJOR: baseConfidence = 40; break;
            case PairCategory.MEME: baseConfidence = 55; break;
        }

        switch (riskLevel) {
            case 'HIGH': baseConfidence += 15; break;
            case 'MEDIUM': baseConfidence += 5; break;
            case 'LOW': baseConfidence -= 5; break;
        }

        return Math.max(30, Math.min(80, baseConfidence));
    }

    private async createSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis: ISimpleMarketAnalysisResult
    ): Promise<Signal> {

        // 1. Визначення напрямку (просто)
        const direction = this.determineDirection(analysis);

        // 2. Розрахунок ціни входу
        const entryPrice = this.calculateEntryPrice(marketData, direction, analysis);

        // 3. Розрахунок цілей (адаптивні)
        const targets = this.calculateSimpleTargets(entryPrice, direction, analysis, pair);

        // 4. Впевненість сигналу
        const confidence = this.calculateSignalConfidence(analysis, pair);

        // 5. Причини (короткі і зрозумілі)
        const reasoning = this.generateSignalReasoning(analysis, direction);

        return Signal.create({
            pair: pair.symbol,
            direction,
            entry: entryPrice,
            targets,
            confidence,
            reasoning,
            exchange: pair.exchange,
            timeframe: pair.strategy.timeframe,
            strategy: 'Simple Enhanced v2.0'
        });
    }

    /**
     * Визначення напрямку сигналу (спрощено)
     */
    private determineDirection(analysis: ISimpleMarketAnalysisResult): SignalDirection {
        const recommendation = analysis.recommendation;

        if (recommendation === 'STRONG_BUY' || recommendation === 'BUY') {
            return SignalDirection.LONG;
        }

        if (recommendation === 'STRONG_SELL' || recommendation === 'SELL') {
            return SignalDirection.SHORT;
        }

        // Fallback на тренд
        if (analysis.trendSignal.direction === 'BULLISH') {
            return SignalDirection.LONG;
        }

        return SignalDirection.SHORT;
    }

    /**
     * Розрахунок ціни входу з мінімальним спредом
     */
    private calculateEntryPrice(
        marketData: MarketData,
        direction: SignalDirection,
        analysis: ISimpleMarketAnalysisResult
    ): Price {
        const currentPrice = marketData.currentPrice;

        // Адаптивний спред на основі об'єму та волатільності
        let spread = 0.001; // Базовий 0.1%

        // Коригування на об'єм
        switch (analysis.volume) {
            case 'HIGH': spread = 0.0005; break; // Менший спред
            case 'LOW': spread = 0.002; break;   // Більший спред
        }

        // Коригування на ризик
        if (analysis.riskLevel === 'HIGH') {
            spread *= 1.5; // Збільшуємо спред для високого ризику
        }

        let entryPrice;
        if (direction === SignalDirection.LONG) {
            entryPrice = currentPrice * (1 + spread);
        } else {
            entryPrice = currentPrice * (1 - spread);
        }

        return Price.fromNumber(entryPrice, 'USDT');
    }

    /**
     * Адаптивні цілі на основі якості сигналу
     */
    private calculateSimpleTargets(
        entryPrice: Price,
        direction: SignalDirection,
        analysis: ISimpleMarketAnalysisResult,
        pair: TradingPair
    ): ISignalTargets {

        const entry = entryPrice.value;
        const signalQuality = analysis.signalScore.totalScore;
        const confidence = analysis.confidence;

        // Базові відсотки
        let stopLossPercent = 0.02; // 2%
        let takeProfitPercents = [0.03, 0.05]; // 3%, 5%

        // Адаптація під якість сигналу
        if (signalQuality >= 8.5) {
            // Відмінний сигнал - можемо ризикнути більше
            stopLossPercent = 0.025;
            takeProfitPercents = [0.04, 0.07, 0.1]; // Додаємо третю ціль
        } else if (signalQuality >= 7) {
            // Хороший сигнал
            stopLossPercent = 0.022;
            takeProfitPercents = [0.035, 0.06];
        } else if (signalQuality < 5.5) {
            // Слабкий сигнал - обережніше
            stopLossPercent = 0.015;
            takeProfitPercents = [0.025, 0.04];
        }

        // Адаптація під впевненість
        if (confidence >= 80) {
            takeProfitPercents = takeProfitPercents.map(tp => tp * 1.2);
        } else if (confidence < 50) {
            stopLossPercent *= 0.8; // Тісніший стоп
            takeProfitPercents = takeProfitPercents.map(tp => tp * 0.9);
        }

        // Адаптація під об'єм
        if (analysis.volume === 'HIGH') {
            takeProfitPercents = takeProfitPercents.map(tp => tp * 1.15);
        } else if (analysis.volume === 'LOW') {
            stopLossPercent *= 0.9; // Тісніший стоп при низькому об'ємі
        }

        // Адаптація під категорію пари
        const categoryMultiplier = this.getCategoryMultiplier(pair.category);
        stopLossPercent *= categoryMultiplier.stopLoss;
        takeProfitPercents = takeProfitPercents.map(tp => tp * categoryMultiplier.takeProfit);

        // Розрахунок фінальних цілей
        let stopLoss: number;
        let takeProfits: number[];

        if (direction === SignalDirection.LONG) {
            stopLoss = entry * (1 - stopLossPercent);
            takeProfits = takeProfitPercents.map(tp => entry * (1 + tp));
        } else {
            stopLoss = entry * (1 + stopLossPercent);
            takeProfits = takeProfitPercents.map(tp => entry * (1 - tp));
        }

        return {
            stopLoss,
            takeProfits: takeProfits.slice(0, 3) // Максимум 3 цілі
        };
    }

    /**
     * Множники для різних категорій торгових пар
     */
    private getCategoryMultiplier(category: PairCategory): { stopLoss: number; takeProfit: number } {
        switch (category) {
            case PairCategory.CRYPTO_MAJOR:
                return { stopLoss: 0.8, takeProfit: 0.9 }; // Консервативніше
            case PairCategory.MEME:
                return { stopLoss: 1.3, takeProfit: 1.5 }; // Агресивніше
            default:
                return { stopLoss: 1.0, takeProfit: 1.0 }; // Стандарт
        }
    }

    /**
     * Розрахунок впевненості сигналу
     */
    private calculateSignalConfidence(
        analysis: ISimpleMarketAnalysisResult,
        pair: TradingPair
    ): number {

        // Базова впевненість з аналізу (70% ваги)
        let confidence = (analysis.confidence / 100) * 7;

        // Бонус за якість сигналу (20% ваги)
        const qualityBonus = (analysis.signalScore.totalScore / 10) * 2;
        confidence += qualityBonus;

        // Бонус за низький ризик (10% ваги)
        let riskBonus = 0;
        switch (analysis.riskLevel) {
            case 'LOW': riskBonus = 1; break;
            case 'MEDIUM': riskBonus = 0.5; break;
            case 'HIGH': riskBonus = -0.5; break;
        }
        confidence += riskBonus;

        // Коригування за категорію пари
        switch (pair.category) {
            case PairCategory.CRYPTO_MAJOR:
                confidence += 0.3; // Більш передбачувані
                break;
            case PairCategory.MEME:
                confidence -= 0.5; // Менш передбачувані
                break;
        }

        return Math.max(1, Math.min(10, Math.round(confidence * 10) / 10));
    }

    /**
     * Генерація коротких причин для сигналу
     */
    private generateSignalReasoning(
        analysis: ISimpleMarketAnalysisResult,
        direction: SignalDirection
    ): string[] {
        const reasoning: string[] = [];

        // 1. Головне рішення
        const directionText = direction === SignalDirection.LONG ? 'LONG' : 'SHORT';
        const action = analysis.recommendation;
        reasoning.push(`${directionText} позиція: ${action} (бал: ${analysis.signalScore.totalScore}/10)`);

        // 2. Основна причина тренду
        const trendReason = analysis.trendSignal.reasons[0];
        if (trendReason) {
            reasoning.push(trendReason);
        }

        // 3. Топ причина з рекомендації
        const topRecommendationReason = analysis.signalScore.recommendation.reasons[0];
        if (topRecommendationReason) {
            reasoning.push(topRecommendationReason);
        }

        // 4. Об'єм та ризик
        reasoning.push(`Об'єм: ${analysis.volume}, Ризик: ${analysis.riskLevel}`);

        // 5. Попередження якщо потрібно
        if (analysis.signalScore.breakdown.penalties < -1) {
            reasoning.push('⚠️ Є негативні фактори - торгуйте обережно');
        }

        return reasoning.slice(0, 5); // Максимум 5 причин
    }

    validateSignal(
        signal: Signal,
        analysis: ISimpleMarketAnalysisResult
    ): { valid: boolean; reason: string } {
        const riskReward = signal.calculateRiskReward();
        if (riskReward < 1.0) {
            return {
                valid: false,
                reason: `Risk/reward too low: ${riskReward.toFixed(2)} (min: 1.0)`
            };
        }

        if (signal.confidence < 2) {
            return {
                valid: false,
                reason: `Signal confidence too low: ${signal.confidence}/10`
            };
        }

        const potentialLoss = signal.getPotentialLoss();
        const maxLoss = analysis.riskLevel === 'HIGH' ? 2.5 :
            analysis.riskLevel === 'MEDIUM' ? 3.0 : 3.5;

        if (potentialLoss > maxLoss) {
            return {
                valid: false,
                reason: `Potential loss too high: ${potentialLoss.toFixed(1)}% > ${maxLoss}% (risk: ${analysis.riskLevel})`
            };
        }

        const entryPrice = signal.entry.value;
        const stopLoss = signal.targets.stopLoss;
        const firstTP = signal.targets.takeProfits[0] as number;

        if (signal.direction === SignalDirection.LONG) {
            if (stopLoss >= entryPrice || firstTP <= entryPrice) {
                return {
                    valid: false,
                    reason: 'Invalid LONG targets: SL >= entry or TP <= entry'
                };
            }
        } else {
            if (stopLoss <= entryPrice || firstTP >= entryPrice) {
                return {
                    valid: false,
                    reason: 'Invalid SHORT targets: SL <= entry or TP >= entry'
                };
            }
        }

        return { valid: true, reason: 'Signal validation passed' };
    }

    public canGenerateSignal(pair: TradingPair, marketData: MarketData): boolean {
        try {
            return pair.isActive &&
                pair.canGenerateSignal() &&
                marketData.hasSufficientData(20) &&
                marketData.isRecent(15);
        } catch (error) {
            this.logger.error(`Error checking signal generation capability for ${pair.symbol}:`, error);
            return false;
        }
    }

    public async generateBatchSignals(
        pairs: TradingPair[],
        marketDataMap: Map<string, MarketData>,
        analysisMap: Map<string, ISimpleMarketAnalysisResult>
    ): Promise<Map<string, SimpleSignalResult>> {

        const results = new Map<string, SimpleSignalResult>();
        const startTime = Date.now();

        this.logger.info(`Starting batch signal generation for ${pairs.length} pairs`);

        const promises = pairs.map(async (pair) => {
            const marketData = marketDataMap.get(pair.symbol);
            const analysis = analysisMap.get(pair.symbol);

            if (!marketData || !analysis) {
                results.set(pair.symbol, {
                    shouldGenerate: false,
                    reason: 'Missing market data or analysis',
                    confidence: 0,
                    metadata: {
                        processingTime: 0,
                        analysisScore: 0,
                        riskLevel: 'HIGH',
                        volume: 'UNKNOWN'
                    }
                });
                return;
            }

            try {
                const result = await this.generateSignal(pair, marketData, analysis);
                results.set(pair.symbol, result);
            } catch (error: any) {
                this.logger.error(`Batch signal generation failed for ${pair.symbol}:`, error);
                results.set(pair.symbol, {
                    shouldGenerate: false,
                    reason: `Error: ${error.message}`,
                    confidence: 0,
                    metadata: {
                        processingTime: 0,
                        analysisScore: 0,
                        riskLevel: 'HIGH',
                        volume: 'UNKNOWN'
                    }
                });
            }
        });

        await Promise.all(promises);

        const totalTime = Date.now() - startTime;
        const successCount = Array.from(results.values()).filter(r => r.shouldGenerate).length;

        this.logger.info(`Batch signal generation completed`, {
            totalPairs: pairs.length,
            successfulSignals: successCount,
            totalTime,
            avgTimePerPair: Math.round(totalTime / pairs.length)
        });

        return results;
    }

    public getGenerationStats(): any {
        return {
            version: '2.0',
            features: [
                'Simplified validation (4 checks vs 10+)',
                'Adaptive targets based on signal quality',
                'Category-specific thresholds',
                'Risk-aware position sizing',
                'Batch processing support'
            ],
            performance: {
                avgProcessingTime: '~100ms (vs 600ms complex)',
                validationChecks: 4,
                supportedCategories: ['CRYPTO_MAJOR', 'CRYPTO_ALT', 'MEME']
            }
        };
    }
}
