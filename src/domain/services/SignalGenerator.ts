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
    DomainError,
    SignalGenerationError,
    MarketDataError,
    ValidationUtil,
    ILogger,
    TRADING_CONSTANTS
} from '../../shared';

export class SignalGenerator implements ISignalGenerator {
    constructor(
        private readonly marketAnalyzer: IMarketAnalyzer,
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
            const marketAnalysis = analysis || await this.analyzeMarket(marketData, pair);

            // Check if signal should be generated
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
            const validation = await this.validateSignal(signal);
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
                entry: signal.entry.value
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

            if (error instanceof DomainError) {
                throw error;
            }

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

    private async analyzeMarket(marketData: MarketData, pair: TradingPair): Promise<IMarketAnalysisResult> {
        try {
            return await this.marketAnalyzer.analyze(marketData, pair.strategy);
        } catch (error: any) {
            throw new MarketDataError(`Market analysis failed: ${error.message}`);
        }
    }

    private async shouldGenerateSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis: IMarketAnalysisResult
    ): Promise<{ should: boolean; reason: string }> {
        // Check if pair can generate signal
        if (!await this.canGenerateSignal(pair, marketData)) {
            return { should: false, reason: 'Pair cannot generate signal at this time' };
        }

        // Check market analysis confidence
        if (analysis.confidence < pair.strategy.minSignalStrength * 10) {
            return {
                should: false,
                reason: `Market analysis confidence ${analysis.confidence}% below threshold ${pair.strategy.minSignalStrength * 10}%`
            };
        }

        // Check if recommendation is actionable
        if (analysis.recommendation === 'HOLD') {
            return { should: false, reason: 'Market analysis recommends HOLD' };
        }

        // Check signal conditions
        const signalConditions = pair.strategy.getSignalConditions();
        const meetsConditions = this.checkSignalConditions(analysis.indicators, signalConditions);

        if (!meetsConditions.meets) {
            return { should: false, reason: meetsConditions.reason };
        }

        // Check market volatility
        if (analysis.volatility === 'HIGH' && pair.strategy.type !== 'SCALPING') {
            return { should: false, reason: 'High volatility unsuitable for strategy type' };
        }

        // Check volume conditions
        if (analysis.volume === 'LOW') {
            return { should: false, reason: 'Low volume conditions' };
        }

        return { should: true, reason: 'All conditions met for signal generation' };
    }

    private checkSignalConditions(
        indicators: TechnicalIndicators,
        conditions: any
    ): { meets: boolean; reason: string } {
        const overallSignal = indicators.getOverallSignal();

        // Check if we have enough bullish or bearish indicators
        const bullishCount = overallSignal.indicators.bullish.length;
        const bearishCount = overallSignal.indicators.bearish.length;

        if (bullishCount < 2 && bearishCount < 2) {
            return { meets: false, reason: 'Insufficient indicator signals' };
        }

        // Check signal strength
        if (overallSignal.strength < 6) {
            return { meets: false, reason: `Signal strength ${overallSignal.strength} too low` };
        }

        // Check for divergence
        if (indicators.hasDivergence()) {
            return { meets: false, reason: 'Technical indicator divergence detected' };
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

        // Calculate entry price
        const entryPrice = this.calculateEntryPrice(marketData, direction, analysis);

        // Calculate targets
        const targets = this.calculateTargets(entryPrice, direction, pair, analysis);

        // Calculate confidence
        const confidence = this.calculateConfidence(analysis, pair);

        // Generate reasoning
        const reasoning = this.generateReasoning(analysis, direction);

        return Signal.create({
            pair: pair.symbol,
            direction,
            entry: entryPrice,
            targets,
            confidence,
            reasoning,
            exchange: pair.exchange,
            timeframe: pair.strategy.timeframe,
            strategy: pair.strategy.name
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
        const indicators = analysis.indicators;

        // For LONG signals, enter slightly above current price
        // For SHORT signals, enter slightly below current price
        let entryPrice = currentPrice;

        if (direction === SignalDirection.LONG) {
            // Enter at current price or slightly above (market buy)
            entryPrice = currentPrice * 1.001; // 0.1% above
        } else {
            // Enter at current price or slightly below (market sell)
            entryPrice = currentPrice * 0.999; // 0.1% below
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

        let stopLoss: number;
        let takeProfits: number[];

        if (direction === SignalDirection.LONG) {
            // Stop loss below entry
            stopLoss = entry * (1 - riskManagement.stopLoss);

            // Take profits above entry
            takeProfits = riskManagement.takeProfits.map(tpRatio =>
                entry * (1 + tpRatio)
            );
        } else {
            // Stop loss above entry
            stopLoss = entry * (1 + riskManagement.stopLoss);

            // Take profits below entry
            takeProfits = riskManagement.takeProfits.map(tpRatio =>
                entry * (1 - tpRatio)
            );
        }

        // Adjust for volatility
        if (analysis.volatility === 'HIGH') {
            const volatilityMultiplier = 1.2;

            if (direction === SignalDirection.LONG) {
                stopLoss = entry * (1 - riskManagement.stopLoss * volatilityMultiplier);
                takeProfits = takeProfits.map(tp => entry + (tp - entry) * volatilityMultiplier);
            } else {
                stopLoss = entry * (1 + riskManagement.stopLoss * volatilityMultiplier);
                takeProfits = takeProfits.map(tp => entry - (entry - tp) * volatilityMultiplier);
            }
        }

        return {
            stopLoss,
            takeProfits
        };
    }

    private calculateConfidence(analysis: IMarketAnalysisResult, pair: TradingPair): number {
        let confidence = analysis.confidence / 10; // Convert from 0-100 to 0-10

        // Adjust based on signal strength
        confidence += analysis.strength * 0.1;

        // Adjust based on volume
        if (analysis.volume === 'HIGH') {
            confidence += 0.5;
        } else if (analysis.volume === 'LOW') {
            confidence -= 1;
        }

        // Adjust based on volatility for strategy type
        if (analysis.volatility === 'HIGH' && pair.strategy.type === 'SCALPING') {
            confidence += 0.5; // High volatility is good for scalping
        } else if (analysis.volatility === 'HIGH') {
            confidence -= 0.5; // High volatility is risky for other strategies
        }

        // Adjust based on trend alignment
        const overallSignal = analysis.indicators.getOverallSignal();
        if (analysis.trend === 'BULLISH' && overallSignal.direction === 'BUY') {
            confidence += 0.5;
        } else if (analysis.trend === 'BEARISH' && overallSignal.direction === 'SELL') {
            confidence += 0.5;
        }

        // Ensure confidence is within valid range
        return Math.max(1, Math.min(10, Math.round(confidence * 10) / 10));
    }

    private generateReasoning(analysis: IMarketAnalysisResult, direction: SignalDirection): string[] {
        const reasoning: string[] = [];
        const overallSignal = analysis.indicators.getOverallSignal();

        // Add direction-specific reasoning
        if (direction === SignalDirection.LONG) {
            reasoning.push(`LONG signal: ${overallSignal.indicators.bullish.join(', ')} indicators are bullish`);
        } else {
            reasoning.push(`SHORT signal: ${overallSignal.indicators.bearish.join(', ')} indicators are bearish`);
        }

        // Add trend reasoning
        if (analysis.trend !== 'SIDEWAYS') {
            reasoning.push(`Market trend is ${analysis.trend.toLowerCase()}`);
        }

        // Add volume reasoning
        if (analysis.volume === 'HIGH') {
            reasoning.push('High volume confirms price movement');
        }

        // Add volatility reasoning
        if (analysis.volatility === 'LOW') {
            reasoning.push('Low volatility suggests stable market conditions');
        } else if (analysis.volatility === 'HIGH') {
            reasoning.push('High volatility presents both opportunity and risk');
        }

        // Add confidence reasoning
        if (analysis.confidence > 80) {
            reasoning.push('High confidence signal based on multiple confirmations');
        } else if (analysis.confidence > 60) {
            reasoning.push('Moderate confidence signal with good technical setup');
        }

        // Add strength reasoning
        if (analysis.strength >= 8) {
            reasoning.push('Strong technical signal with clear direction');
        }

        // Add any specific pattern or condition reasoning
        if (analysis.reasoning.length > 0) {
            reasoning.push(...analysis.reasoning.slice(0, 2)); // Take first 2 analysis reasons
        }

        return reasoning;
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
}
