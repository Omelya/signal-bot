import { Signal } from '../entities/Signal';
import { TradingPair } from '../entities/TradingPair';
import { MarketData } from '../entities/MarketData';
import { IMarketAnalyzer, IMarketAnalysisResult } from './IMarketAnalyzer';
import { ISignalGenerator, ISignalGenerationResult } from './ISignalGenerator';
import { Price } from '../valueObjects/Price';
import { TechnicalIndicators } from '../valueObjects/TechnicalIndicators';
import {
    SignalDirection,
    ISignalTargets,
    SignalGenerationError,
    MarketDataError,
    ValidationUtil,
    ILogger,
    TRADING_CONSTANTS, PairCategory
} from '../../shared';
import {ISignalRepository} from "../repositories/ISignalRepository";

export class SignalGenerator implements ISignalGenerator {
    constructor(
        private readonly marketAnalyzer: IMarketAnalyzer,
        private readonly signalRepository: ISignalRepository,
        private readonly logger: ILogger
    ) {}

    async generateSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis?: IMarketAnalysisResult
    ): Promise<ISignalGenerationResult> {
        try {
            this.logger.debug(`Generating signal for ${pair.symbol}`, {
                symbol: pair.symbol,
                exchange: pair.exchange,
                timeframe: pair.strategy.timeframe
            });

            // Validate inputs
            this.validateInputs(pair, marketData);

            // Analyze market if not provided
            const marketAnalysis = analysis || this.analyzeMarket(marketData, pair);

            const shouldGenerate = await this.shouldGenerateSignal(pair, marketData, marketAnalysis);
            if (!shouldGenerate.should) {
                this.logger.info(`Signal generation failed for ${pair.symbol}`, shouldGenerate)

                return {
                    shouldGenerate: false,
                    reason: shouldGenerate.reason,
                    confidence: 0,
                    analysis: marketAnalysis
                };
            }

            // Generate the actual signal
            const signal = await this.createSignal(pair, marketData, marketAnalysis);

            // Validate generated signal
            const validation = await this.enhancedValidateSignal(signal, marketAnalysis);
            if (!validation.isValid) {
                this.logger.warn(`Generated signal failed validation`, {
                    symbol: pair.symbol,
                    errors: validation.errors
                });

                return {
                    shouldGenerate: false,
                    reason: `Signal validation failed: ${validation.errors.join(', ')}`,
                    confidence: 0,
                    analysis: marketAnalysis
                };
            }

            this.logger.info(`Signal generated successfully for ${pair.symbol}`, {
                signalId: signal.id,
                direction: signal.direction,
                confidence: signal.confidence,
                entry: signal.entry.value,
                reasoning: signal.reasoning.length,
            });

            return {
                signal,
                shouldGenerate: true,
                reason: 'Signal generated successfully',
                confidence: signal.confidence,
                analysis: marketAnalysis
            };

        } catch (error: any) {
            this.logger.error(`Failed to generate signal for ${pair.symbol}:`, error);
            throw new SignalGenerationError(`Signal generation failed: ${error.message}`);
        }
    }

    async canGenerateSignal(pair: TradingPair, marketData: MarketData): Promise<boolean> {
        try {
            // Basic validation checks
            if (!pair.isActive) {
                return false;
            }

            if (!pair.canGenerateSignal()) {
                return false;
            }

            if (!marketData.hasSufficientData(TRADING_CONSTANTS.MIN_CANDLES_FOR_ANALYSIS)) {
                return false;
            }

            return marketData.isRecent();
        } catch (error) {
            this.logger.error(`Error checking if signal can be generated for ${pair.symbol}:`, error);
            return false;
        }
    }

    async enhancedValidateSignal(
        signal: Signal,
        analysis: IMarketAnalysisResult
    ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Basic validation
        const basicValidation = await this.validateSignal(signal);
        errors.push(...basicValidation.errors);
        warnings.push(...basicValidation.warnings);

        // 2. Context-aware validation
        const riskReward = signal.calculateRiskReward();
        if (riskReward < 1.2) { // Lowered from 1.5
            warnings.push(`Low risk/reward ratio: ${riskReward.toFixed(2)}`);
        }

        // 3. Market condition validation
        if (analysis.trend === 'SIDEWAYS' && signal.confidence < 7) {
            warnings.push(`Sideways market with medium confidence - high risk`);
        }

        // 4. Volatility vs targets validation
        const potentialLoss = signal.getPotentialLoss();
        if (analysis.volatility === 'HIGH' && potentialLoss > 3) {
            warnings.push(`High volatility with high potential loss: ${potentialLoss.toFixed(1)}%`);
        }

        // 5. Volume validation
        if (analysis.volume === 'LOW' && signal.confidence > 8) {
            warnings.push(`High confidence signal with low volume - execution risk`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    async validateSignal(signal: Signal): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Validate confidence score
            if (signal.confidence < TRADING_CONSTANTS.MIN_CONFIDENCE_SCORE) {
                errors.push(`Confidence score ${signal.confidence} below minimum ${TRADING_CONSTANTS.MIN_CONFIDENCE_SCORE}`);
            }

            // Validate risk/reward ratio
            const riskReward = signal.calculateRiskReward();
            if (riskReward < TRADING_CONSTANTS.MIN_RISK_REWARD_RATIO) {
                errors.push(`Risk/reward ratio ${riskReward} below minimum ${TRADING_CONSTANTS.MIN_RISK_REWARD_RATIO}`);
            }

            // Validate take profit levels
            if (signal.targets.takeProfits.length === 0) {
                errors.push('At least one take profit level is required');
            }

            if (signal.targets.takeProfits.length > TRADING_CONSTANTS.MAX_TAKE_PROFIT_LEVELS) {
                errors.push(`Too many take profit levels (max: ${TRADING_CONSTANTS.MAX_TAKE_PROFIT_LEVELS})`);
            }

            // Validate entry price vs targets
            const entryPrice = signal.entry.value;
            const stopLoss = signal.targets.stopLoss;

            if (signal.direction === SignalDirection.LONG) {
                if (stopLoss >= entryPrice) {
                    errors.push('Stop loss must be below entry price for LONG signals');
                }

                for (const tp of signal.targets.takeProfits) {
                    if (tp <= entryPrice) {
                        errors.push('Take profit levels must be above entry price for LONG signals');
                    }
                }
            } else {
                if (stopLoss <= entryPrice) {
                    errors.push('Stop loss must be above entry price for SHORT signals');
                }

                for (const tp of signal.targets.takeProfits) {
                    if (tp >= entryPrice) {
                        errors.push('Take profit levels must be below entry price for SHORT signals');
                    }
                }
            }

            // Validate potential loss
            const potentialLoss = signal.getPotentialLoss();
            if (potentialLoss > TRADING_CONSTANTS.MAX_RISK_PER_TRADE) {
                warnings.push(`High potential loss: ${potentialLoss.toFixed(2)}%`);
            }

            // Validate reasoning
            if (signal.reasoning.length === 0) {
                errors.push('Signal must have at least one reasoning');
            }

            // Age validation
            if (signal.getAgeInMinutes() > 5) {
                warnings.push('Signal is more than 5 minutes old');
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };

        } catch (error: any) {
            this.logger.error('Error validating signal:', error);
            return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                warnings
            };
        }
    }

    async optimizeSignal(signal: Signal, marketConditions: any): Promise<Signal> {
        try {
            this.logger.debug(`Optimizing signal ${signal.id}`, {
                currentConfidence: signal.confidence,
                direction: signal.direction
            });

            // Create optimized targets based on market conditions
            const optimizedTargets = this.optimizeTargets(signal, marketConditions);

            // Adjust confidence based on market conditions
            const optimizedConfidence = this.optimizeConfidence(signal, marketConditions);

            // Create new signal with optimized parameters
            return Signal.create({
                pair: signal.pair,
                direction: signal.direction,
                entry: signal.entry,
                targets: optimizedTargets,
                confidence: optimizedConfidence,
                reasoning: [
                    ...signal.reasoning,
                    'Optimized for current market conditions'
                ],
                exchange: signal.exchange,
                timeframe: signal.timeframe,
                strategy: signal.strategy
            });

        } catch (error) {
            this.logger.error(`Failed to optimize signal ${signal.id}:`, error);
            return signal; // Return original signal if optimization fails
        }
    }

    // Private methods

    private validateInputs(pair: TradingPair, marketData: MarketData): void {
        ValidationUtil.required(pair, 'trading pair');
        ValidationUtil.required(marketData, 'market data');

        if (marketData.exchange !== pair.exchange) {
            throw new SignalGenerationError('Market data exchange must match trading pair exchange');
        }

        if (marketData.symbol !== pair.symbol) {
            throw new SignalGenerationError('Market data symbol must match trading pair symbol');
        }
    }

    private analyzeMarket(marketData: MarketData, pair: TradingPair): IMarketAnalysisResult {
        try {
            return this.marketAnalyzer.analyze(marketData, pair.strategy);
        } catch (error: any) {
            throw new MarketDataError(`Market analysis failed: ${error.message}`);
        }
    }

    private async shouldGenerateSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis: IMarketAnalysisResult
    ): Promise<{ should: boolean; reason: string }> {
        // 1. Basic checks
        if (!pair.isActive) {
            return { should: false, reason: 'Trading pair is not active' };
        }

        if (!pair.canGenerateSignal()) {
            return { should: false, reason: `Cooldown active: ${pair.getRemainingCooldown()}ms remaining` };
        }

        if (!marketData.hasSufficientData(TRADING_CONSTANTS.MIN_CANDLES_FOR_ANALYSIS)) {
            return { should: false, reason: 'Insufficient market data' };
        }

        if (!marketData.isRecent(15)) { // Збільшено до 15 хвилин
            return { should: false, reason: 'Market data is stale' };
        }

        // 2. ПОКРАЩЕНІ умови для сили сигналу
        const minStrength = this.getAdjustedMinStrength(pair, analysis);
        if (analysis.strength < minStrength) {
            return {
                should: false,
                reason: `Signal strength ${analysis.strength} below adjusted threshold ${minStrength}`
            };
        }

        // 3. Перевірка впевненості з динамічним порогом
        const minConfidence = this.getAdjustedMinConfidence(pair, analysis);
        if (analysis.confidence < minConfidence) {
            return {
                should: false,
                reason: `Analysis confidence ${analysis.confidence}% below threshold ${minConfidence}%`
            };
        }

        // 4. Перевірка рекомендації
        if (analysis.recommendation === 'HOLD') {
            return { should: false, reason: 'Market analysis recommends HOLD' };
        }

        // 5. ПОКРАЩЕНА перевірка умов сигналу
        const signalConditions = pair.strategy.getSignalConditions();
        const meetsConditions = this.checkSignalConditions(analysis.indicators, signalConditions, analysis);

        if (!meetsConditions.meets) {
            return { should: false, reason: meetsConditions.reason };
        }

        // 6. Перевірка ринкових умов
        const marketSuitability = this.checkMarketSuitability(pair, analysis);
        if (!marketSuitability.suitable) {
            return { should: false, reason: marketSuitability.reason };
        }

        // 7. Перевірка ризику
        const riskCheck = await this.checkRiskConditions(pair, marketData, analysis);
        if (!riskCheck.acceptable) {
            return { should: false, reason: riskCheck.reason };
        }

        return { should: true, reason: 'All conditions met for signal generation' };
    }

    private checkSignalConditions(
        indicators: TechnicalIndicators,
        conditions: any,
        analysis: IMarketAnalysisResult,
    ): { meets: boolean; reason: string } {
        const overallSignal = indicators.getOverallSignal();

        // 1. Мінімальна кількість сигналів
        const bullishCount = overallSignal.indicators.bullish.length;
        const bearishCount = overallSignal.indicators.bearish.length;
        const dominantCount = Math.max(bullishCount, bearishCount);

        const minIndicators = analysis.trend === 'SIDEWAYS' ? 3 : 2;
        if (dominantCount < minIndicators) {
            return {
                meets: false,
                reason: `Insufficient indicator signals: ${dominantCount} (need ${minIndicators})`
            };
        }

        // 2. Перевірка сили сигналу з урахуванням тренду
        const minSignalStrength = analysis.trend === 'SIDEWAYS' ? 7 : 5;
        if (overallSignal.strength < minSignalStrength) {
            return {
                meets: false,
                reason: `Signal strength ${overallSignal.strength} too low (need ${minSignalStrength} for ${analysis.trend})`
            };
        }

        // 3. Менш сувора перевірка дивергенції
        if (indicators.hasDivergence() && analysis.confidence < 70) {
            return {
                meets: false,
                reason: 'Technical indicator divergence with low confidence'
            };
        }

        // 4. Перевірка momentum для сильних сигналів
        if (analysis.strength >= 8) {
            const adx = indicators.values.adx;
            if (adx < 20) {
                return {
                    meets: false,
                    reason: `Weak momentum (ADX: ${adx.toFixed(1)}) for strong signal`
                };
            }
        }

        return { meets: true, reason: 'Signal conditions satisfied' };
    }

    private async createSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis: IMarketAnalysisResult
    ): Promise<Signal> {
        // Determine signal direction
        const direction = this.determineSignalDirection(analysis);

        // Calculate entry price with spread consideration
        const entryPrice = this.calculateEntryPrice(marketData, direction, analysis);

        // Calculate targets with market conditions
        const targets = this.calculateTargets(entryPrice, direction, pair, analysis);

        // Calculate confidence with market context
        const confidence = this.calculateSignalConfidence(analysis, pair);

        // Generate enhanced reasoning
        const reasoning = this.generateReasoning(analysis, direction, pair);

        return Signal.create({
            pair: pair.symbol,
            direction,
            entry: entryPrice,
            targets,
            confidence,
            reasoning,
            exchange: pair.exchange,
            timeframe: pair.strategy.timeframe,
            strategy: `${pair.strategy.name} (Enhanced)`
        });
    }

    private determineSignalDirection(analysis: IMarketAnalysisResult): SignalDirection {
        const overallSignal = analysis.indicators.getOverallSignal();

        if (overallSignal.direction === 'BUY') {
            return SignalDirection.LONG;
        } else if (overallSignal.direction === 'SELL') {
            return SignalDirection.SHORT;
        }

        // Fallback to trend analysis
        if (analysis.trend === 'BULLISH') {
            return SignalDirection.LONG;
        } else {
            return SignalDirection.SHORT;
        }
    }

    private calculateEntryPrice(
        marketData: MarketData,
        direction: SignalDirection,
        analysis: IMarketAnalysisResult
    ): Price {
        const currentPrice = marketData.currentPrice;
        const volatility = analysis.volatility;
        const volume = analysis.volume;

        // Базовий спред
        let spread = 0.001; // 0.1%

        // Adjust spread based on volatility
        if (volatility === 'HIGH') {
            spread = 0.002; // 0.2%
        } else if (volatility === 'LOW') {
            spread = 0.0005; // 0.05%
        }

        // Adjust spread based on volume
        if (volume === 'LOW') {
            spread *= 1.5; // Збільшуємо спред при низькому об'ємі
        } else if (volume === 'HIGH') {
            spread *= 0.8; // Зменшуємо спред при високому об'ємі
        }

        let entryPrice;

        if (direction === SignalDirection.LONG) {
            // Для LONG входимо трохи вище для гарантованого виконання
            entryPrice = currentPrice * (1 + spread);
        } else {
            // Для SHORT входимо трохи нижче
            entryPrice = currentPrice * (1 - spread);
        }

        return Price.fromNumber(entryPrice, 'USDT');
    }

    private calculateTargets(
        entryPrice: Price,
        direction: SignalDirection,
        pair: TradingPair,
        analysis: IMarketAnalysisResult
    ): ISignalTargets {
        const strategy = pair.getAdaptedStrategy();
        const riskManagement = strategy.risk;
        const entry = entryPrice.value;

        // Adjust targets based on market conditions
        const volatilityMultiplier = this.getVolatilityMultiplier(analysis.volatility);
        const trendMultiplier = this.getTrendMultiplier(analysis.trend, analysis.strength);
        const volumeMultiplier = this.getVolumeMultiplier(analysis.volume);

        // Combined multiplier
        const totalMultiplier = volatilityMultiplier * trendMultiplier * volumeMultiplier;

        let stopLoss: number;
        let takeProfits: number[];

        if (direction === SignalDirection.LONG) {
            // Stop loss below entry
            stopLoss = entry * (1 - riskManagement.stopLoss * totalMultiplier);

            // Take profits above entry
            takeProfits = riskManagement.takeProfits.map(tpRatio =>
                entry * (1 + tpRatio * totalMultiplier)
            );
        } else {
            // Stop loss above entry
            stopLoss = entry * (1 + riskManagement.stopLoss * totalMultiplier);

            // Take profits below entry
            takeProfits = riskManagement.takeProfits.map(tpRatio =>
                entry * (1 - tpRatio * totalMultiplier)
            );
        }

        // Ensure minimum risk/reward ratio
        const minRiskReward = 1.5;
        if (direction === SignalDirection.LONG) {
            const risk = entry - stopLoss;
            const minReward = risk * minRiskReward;

            takeProfits = takeProfits.map((tp, index) => {
                const currentReward = tp - entry;
                if (currentReward < minReward) {
                    return entry + minReward * (index + 1) * 0.8; // Graduated targets
                }
                return tp;
            });
        } else {
            const risk = stopLoss - entry;
            const minReward = risk * minRiskReward;

            takeProfits = takeProfits.map((tp, index) => {
                const currentReward = entry - tp;
                if (currentReward < minReward) {
                    return entry - minReward * (index + 1) * 0.8; // Graduated targets
                }
                return tp;
            });
        }

        return {
            stopLoss,
            takeProfits: takeProfits.slice(0, 3)
        };
    }

    private generateReasoning(
        analysis: IMarketAnalysisResult,
        direction: SignalDirection,
        pair: TradingPair,
    ): string[] {
        const reasoning: string[] = [];
        const overallSignal = analysis.indicators.getOverallSignal();
        const statistics = analysis.marketData.getStatistics();

        // 1. Main signal reason
        const directionText = direction === SignalDirection.LONG ? 'LONG' : 'SHORT';
        const trendText = analysis.trend.toLowerCase();
        reasoning.push(`${directionText} сигнал в ${trendText} тренді (сила: ${analysis.strength}/10)`);

        // 2. Price movement
        const priceChange = statistics.priceChangePercent;
        if (Math.abs(priceChange) > 2) {
            const changeText = priceChange > 0 ? 'зросла' : 'впала';
            reasoning.push(`Ціна ${changeText} на ${Math.abs(priceChange).toFixed(1)}% за 24h`);
        }

        // 3. Technical indicators (top 3)
        const indicators = direction === SignalDirection.LONG
            ? overallSignal.indicators.bullish
            : overallSignal.indicators.bearish;

        if (indicators.length > 0) {
            const topIndicators = indicators.slice(0, 3).join(', ');
            reasoning.push(`Технічні індикатори: ${topIndicators}`);
        }

        // 4. Volume confirmation
        if (analysis.volume === 'HIGH') {
            reasoning.push(`Високий об'єм (${(statistics.totalVolume / 1000000).toFixed(1)}M) підтверджує рух`);
        } else if (analysis.volume === 'LOW') {
            reasoning.push(`Низький об'єм - обережно з розміром позиції`);
        }

        // 5. Volatility context
        if (analysis.volatility === 'HIGH') {
            reasoning.push(`Висока волатільність - потенціал швидкого прибутку і ризику`);
        }

        // 6. Strategy-specific reasoning
        if (pair.strategy.type === 'SCALPING' && analysis.volatility === 'HIGH') {
            reasoning.push(`Скальпінг стратегія оптимальна для високої волатільності`);
        }

        // 7. Risk/Reward note
        reasoning.push(`Ризик/прибуток співвідношення оптимізовано для поточних умов`);

        // 8. Warnings if any
        if (analysis.indicators.hasDivergence()) {
            reasoning.push(`⚠️ Розбіжність між індикаторами - зменшіть розмір позиції`);
        }

        if (analysis.confidence < 60) {
            reasoning.push(`⚠️ Помірна впевненість (${analysis.confidence}%) - торгуйте обережно`);
        }

        return reasoning.slice(0, 6); // Maximum 6 reasons
    }

    private optimizeTargets(signal: Signal, marketConditions: any): ISignalTargets {
        const currentTargets = signal.targets;

        // Adjust targets based on market conditions
        // This is a simplified optimization - in real implementation,
        // you would use more sophisticated algorithms

        let stopLossMultiplier = 1.0;
        let takeProfitMultiplier = 1.0;

        // Adjust for volatility
        if (marketConditions.volatility > 0.05) { // High volatility
            stopLossMultiplier = 1.2;
            takeProfitMultiplier = 1.3;
        } else if (marketConditions.volatility < 0.02) { // Low volatility
            stopLossMultiplier = 0.8;
            takeProfitMultiplier = 0.8;
        }

        // Adjust for volume
        if (marketConditions.volume > 2.0) { // High volume
            takeProfitMultiplier *= 1.1;
        }

        const entryPrice = signal.entry.value;

        let optimizedStopLoss: number;
        let optimizedTakeProfits: number[];

        if (signal.direction === SignalDirection.LONG) {
            const stopLossDistance = entryPrice - currentTargets.stopLoss;
            optimizedStopLoss = entryPrice - (stopLossDistance * stopLossMultiplier);

            optimizedTakeProfits = currentTargets.takeProfits.map(tp => {
                const distance = tp - entryPrice;
                return entryPrice + (distance * takeProfitMultiplier);
            });
        } else {
            const stopLossDistance = currentTargets.stopLoss - entryPrice;
            optimizedStopLoss = entryPrice + (stopLossDistance * stopLossMultiplier);

            optimizedTakeProfits = currentTargets.takeProfits.map(tp => {
                const distance = entryPrice - tp;
                return entryPrice - (distance * takeProfitMultiplier);
            });
        }

        return {
            stopLoss: optimizedStopLoss,
            takeProfits: optimizedTakeProfits
        };
    }

    private optimizeConfidence(signal: Signal, marketConditions: any): number {
        let optimizedConfidence = signal.confidence;

        // Increase confidence for favorable market conditions
        if (marketConditions.trendStrength > 0.7) {
            optimizedConfidence += 0.5;
        }

        if (marketConditions.volume > 1.5) {
            optimizedConfidence += 0.3;
        }

        // Decrease confidence for unfavorable conditions
        if (marketConditions.volatility > 0.08) { // Very high volatility
            optimizedConfidence -= 0.5;
        }

        if (marketConditions.conflictingSignals) {
            optimizedConfidence -= 1.0;
        }

        // Ensure confidence stays within valid range
        return Math.max(1, Math.min(10, optimizedConfidence));
    }

    private getAdjustedMinStrength(pair: TradingPair, analysis: IMarketAnalysisResult): number {
        let baseStrength = pair.strategy.minSignalStrength;

        // Зменшуємо поріг для сильних трендів
        if (analysis.trend !== 'SIDEWAYS') {
            const priceChange = Math.abs(analysis.marketData.getStatistics().priceChangePercent);
            if (priceChange > 5) baseStrength -= 2;
            else if (priceChange > 3) baseStrength -= 1;
        }

        // Зменшуємо поріг для високого об'єму
        if (analysis.volume === 'HIGH') {
            baseStrength -= 1;
        }

        // Збільшуємо поріг для MEME coins (більший ризик)
        if (pair.category === PairCategory.MEME) {
            baseStrength += 0.5;
        }

        // Зменшуємо поріг для основних криптовалют
        if (pair.category === PairCategory.CRYPTO_MAJOR) {
            baseStrength -= 0.5;
        }

        return Math.max(3, Math.min(8, baseStrength)); // Межі 3-8
    }

    private getAdjustedMinConfidence(pair: TradingPair, analysis: IMarketAnalysisResult): number {
        let baseConfidence = 50; // Базовий поріг

        // Підвищуємо для бічного тренду
        if (analysis.trend === 'SIDEWAYS') {
            baseConfidence += 15;
        }

        // Знижуємо для сильних трендів
        if (analysis.trend !== 'SIDEWAYS') {
            const priceChange = Math.abs(analysis.marketData.getStatistics().priceChangePercent);
            if (priceChange > 5) baseConfidence -= 15;
            else if (priceChange > 3) baseConfidence -= 10;
        }

        // Підвищуємо для високої волатільності без тренду
        if (analysis.volatility === 'HIGH' && analysis.trend === 'SIDEWAYS') {
            baseConfidence += 10;
        }

        return Math.max(30, Math.min(80, baseConfidence));
    }

    private checkMarketSuitability(
        pair: TradingPair,
        analysis: IMarketAnalysisResult
    ): { suitable: boolean; reason: string } {

        // 1. Перевірка стратегії vs волатільність
        if (analysis.volatility === 'HIGH' && pair.strategy.type !== 'SCALPING' && analysis.trend === 'SIDEWAYS') {
            return {
                suitable: false,
                reason: 'High volatility unsuitable for non-scalping strategy in sideways market'
            };
        }

        // 2. Менш сувора перевірка об'єму
        if (analysis.volume === 'LOW' && analysis.strength < 7) {
            return {
                suitable: false,
                reason: 'Low volume with weak signal strength'
            };
        }

        // 3. Перевірка часу торгівлі
        if (!pair.isGoodTimeToTrade()) {
            return {
                suitable: false,
                reason: 'Not a good time to trade based on pair settings'
            };
        }

        return { suitable: true, reason: 'Market conditions suitable' };
    }

    private async checkRiskConditions(
        pair: TradingPair,
        marketData: MarketData,
        analysis: IMarketAnalysisResult
    ): Promise<{ acceptable: boolean; reason: string }> {

        // 1. Перевірка максимальної кількості сигналів (менш сувора)
        const activeSignals = await this.getActiveSignalsCount();
        const maxSignals = pair.strategy.maxSimultaneousSignals + 2; // +2 buffer

        if (activeSignals >= maxSignals) {
            return {
                acceptable: false,
                reason: `Max simultaneous signals reached: ${activeSignals}/${maxSignals}`
            };
        }

        // 2. Перевірка на основі категорії пари
        if (pair.category === PairCategory.MEME && analysis.volatility === 'HIGH' && analysis.confidence < 70) {
            return {
                acceptable: false,
                reason: 'High-risk MEME coin with high volatility and low confidence'
            };
        }

        // 3. Перевірка свіжості даних
        const dataAge = marketData.getAgeInMinutes();
        if (dataAge > 10 && analysis.strength < 7) {
            return {
                acceptable: false,
                reason: `Stale data (${dataAge}m) with weak signal`
            };
        }

        return { acceptable: true, reason: 'Risk conditions acceptable' };
    }

    private getVolatilityMultiplier(volatility: 'LOW' | 'MEDIUM' | 'HIGH'): number {
        switch (volatility) {
            case 'HIGH': return 1.3;
            case 'MEDIUM': return 1.0;
            case 'LOW': return 0.8;
        }
    }

    private getTrendMultiplier(trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS', strength: number): number {
        if (trend === 'SIDEWAYS') return 0.8;

        // Strong trends allow for wider targets
        if (strength >= 8) return 1.2;
        if (strength >= 6) return 1.1;
        return 1.0;
    }

    private getVolumeMultiplier(volume: 'LOW' | 'NORMAL' | 'HIGH'): number {
        switch (volume) {
            case 'HIGH': return 1.1; // Higher targets with high volume
            case 'NORMAL': return 1.0;
            case 'LOW': return 0.9; // Conservative targets with low volume
        }
    }

    private calculateSignalConfidence(
        analysis: IMarketAnalysisResult,
        pair: TradingPair
    ): number {
        let confidence = analysis.confidence / 10; // Convert from 0-100 to 0-10

        // Adjust based on analysis strength
        confidence += analysis.strength * 0.1;

        // Trend bonus
        if (analysis.trend !== 'SIDEWAYS') {
            confidence += 1;

            // Extra bonus for strong price movements
            const priceChange = Math.abs(analysis.marketData.getStatistics().priceChangePercent);
            if (priceChange > 5) confidence += 1;
            if (priceChange > 3) confidence += 0.5;
        }

        // Volume bonus
        if (analysis.volume === 'HIGH') {
            confidence += 0.5;
        } else if (analysis.volume === 'LOW') {
            confidence -= 1;
        }

        // Volatility adjustment based on strategy
        if (analysis.volatility === 'HIGH') {
            if (pair.strategy.type === 'SCALPING') {
                confidence += 0.5; // Good for scalping
            } else if (analysis.trend === 'SIDEWAYS') {
                confidence -= 0.5; // Risky for other strategies
            }
        }

        // Category-based adjustments
        switch (pair.category) {
            case PairCategory.CRYPTO_MAJOR:
                confidence += 0.3; // More reliable
                break;
            case PairCategory.MEME:
                confidence -= 0.3; // More risky
                break;
            default:
                break;
        }

        // Technical confirmation bonus
        const overallSignal = analysis.indicators.getOverallSignal();
        const indicatorAlignment = overallSignal.indicators.bullish.length + overallSignal.indicators.bearish.length;
        confidence += indicatorAlignment * 0.1;

        // Penalty for divergence
        if (analysis.indicators.hasDivergence()) {
            confidence -= 1;
        }

        return Math.max(1, Math.min(10, Math.round(confidence * 10) / 10));
    }

    private async getActiveSignalsCount(): Promise<number> {
        try {
            const activeSignals = await this.signalRepository.findActive();
            return activeSignals.length;
        } catch (error: any) {
            this.logger.error('Failed to get active signals count:', error);
            // Fallback: повертаємо 0 у випадку помилки, щоб не блокувати генерацію
            return 0;
        }
    }
}
