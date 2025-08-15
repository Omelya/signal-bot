import { ISignalRepository } from '../../domain/repositories/ISignalRepository';
import { ISignalGenerator } from '../../domain/services/ISignalGenerator';
import { INotificationService } from '../../domain/services/INotificationService';
import { Signal } from '../../domain/entities/Signal';
import { MarketData } from '../../domain/entities/MarketData';
import { TradingPair } from '../../domain/entities/TradingPair';
import { IEventBus } from '../../shared';
import { ILogger } from '../../shared';
import { DomainError } from '../../shared';
import { ISignalEventPayload } from '../../shared';

export interface IGenerateSignalUseCase {
    execute(marketData: MarketData, tradingPair: TradingPair): Promise<Signal | null>;
    executeForMultiplePairs(marketDataList: Array<{ marketData: MarketData; pair: TradingPair }>): Promise<Signal[]>;
}

export class GenerateSignalUseCase implements IGenerateSignalUseCase {
    constructor(
        private readonly signalGenerator: ISignalGenerator,
        private readonly signalRepository: ISignalRepository,
        private readonly notificationService: INotificationService,
        private readonly eventBus: IEventBus,
        private readonly logger: ILogger
    ) {}

    async execute(marketData: MarketData, tradingPair: TradingPair): Promise<Signal | null> {
        try {
            this.validateInputs(marketData, tradingPair);

            if (!tradingPair.canGenerateSignal()) {
                this.logger.info(`Pair ${tradingPair.symbol} cannot generate signal`, {
                    isActive: tradingPair.isActive,
                    cooldownRemaining: tradingPair.getRemainingCooldown()
                });
                return null;
            }

            if (!tradingPair.isGoodTimeToTrade()) {
                this.logger.info(`Not a good time to trade ${tradingPair.symbol}`, {
                    symbol: tradingPair.symbol
                });
                return null;
            }

            if (!marketData.hasSufficientData()) {
                this.logger.warn(`Insufficient market data for ${tradingPair.symbol}`, {
                    candleCount: marketData.candleCount,
                    required: 50
                });
                return null;
            }

            if (!marketData.isRecent()) {
                this.logger.warn(`Market data is stale for ${tradingPair.symbol}`, {
                    ageMinutes: marketData.getAgeInMinutes()
                });
                return null;
            }

            const strategy = tradingPair.getAdaptedStrategy();

            const signal = await this
                .signalGenerator
                .generateSignal(tradingPair, marketData);

            // If no signal was generated, log and return
            if (!signal.signal) {
                this.logger.info(`No signal generated for ${tradingPair.symbol}`, {
                    symbol: tradingPair.symbol,
                    currentPrice: marketData.currentPrice
                });
                return null;
            }

            // Validate signal against strategy requirements
            if (signal.confidence < strategy.minSignalStrength) {
                this.logger.info(`Signal confidence too low for ${tradingPair.symbol}`, {
                    confidence: signal.confidence,
                    required: strategy.minSignalStrength
                });
                return null;
            }

            // Check if we haven't exceeded max simultaneous signals
            const activeSignals = await this.signalRepository.findActive();
            if (activeSignals.length >= strategy.maxSimultaneousSignals) {
                this.logger.warn(`Max simultaneous signals reached`, {
                    active: activeSignals.length,
                    max: strategy.maxSimultaneousSignals,
                });
                return null;
            }

            const signalItem = signal.signal;

            // Save signal to repository
            await this.signalRepository.save(signalItem);

            // Update trading pair's last signal time
            tradingPair.updateLastSignalTime();

            // Send notification
            await this.sendSignalNotification(signalItem, tradingPair);

            // Publish signal generated event
            await this.publishSignalEvent(signalItem);

            // Mark signal as sent
            signalItem.markAsSent();
            await this.signalRepository.save(signalItem);

            this.logger.info(`Signal generated successfully for ${tradingPair.symbol}`, {
                signalId: signalItem.id,
                direction: signalItem.direction,
                confidence: signalItem.confidence,
                entry: signalItem.entry.value,
                riskReward: signalItem.calculateRiskReward()
            });

            return signalItem;
        } catch (error: any) {
            this.logger.error(`Error generating signal for ${tradingPair.symbol}:`, error);

            // Publish error event
            await this.eventBus.publish({
                type: 'signal.generation.failed',
                source: 'GenerateSignalUseCase',
                version: '1.0',
                payload: {
                    pair: tradingPair.symbol,
                    exchange: marketData.exchange,
                    error: error.message
                }
            });

            throw error;
        }
    }

    async executeForMultiplePairs(
        marketDataList: Array<{ marketData: MarketData; pair: TradingPair }>
    ): Promise<Signal[]> {
        this.logger.info(`Generating signals for ${marketDataList.length} pairs`);

        const signals: Signal[] = [];
        const promises = marketDataList.map(async ({ marketData, pair }) => {
            try {
                const signal = await this.execute(marketData, pair);
                if (signal) {
                    signals.push(signal);
                }
            } catch (error) {
                this.logger.error(`Error processing pair ${pair.symbol}:`, error);
                // Continue with other pairs even if one fails
            }
        });

        await Promise.all(promises);

        this.logger.info(`Generated ${signals.length} signals from ${marketDataList.length} pairs`);

        // Publish batch completion event
        await this.eventBus.publish({
            type: 'signal.batch.completed',
            source: 'GenerateSignalUseCase',
            version: '1.0',
            payload: {
                totalPairs: marketDataList.length,
                signalsGenerated: signals.length,
                signals: signals.map(s => ({
                    id: s.id,
                    pair: s.pair,
                    direction: s.direction,
                    confidence: s.confidence
                }))
            }
        });

        return signals;
    }

    private validateInputs(marketData: MarketData, tradingPair: TradingPair): void {
        if (!marketData) {
            throw new DomainError('Market data is required');
        }

        if (!tradingPair) {
            throw new DomainError('Trading pair is required');
        }

        if (marketData.exchange !== tradingPair.exchange) {
            throw new DomainError('Market data exchange must match trading pair exchange');
        }

        if (marketData.symbol !== tradingPair.symbol) {
            throw new DomainError('Market data symbol must match trading pair symbol');
        }
    }

    private async sendSignalNotification(signal: Signal, tradingPair: TradingPair): Promise<void> {
        try {
            const message = this.formatSignalNotification(signal, tradingPair);
            await this.notificationService.sendSignalNotification(signal, message);

            this.logger.debug(`Signal notification sent for ${signal.pair}`, {
                signalId: signal.id,
                channels: this.notificationService.getEnabledChannels()
            });
        } catch (error) {
            this.logger.error(`Failed to send signal notification for ${signal.pair}:`, error);
            // Don't throw - notification failure shouldn't prevent signal generation
        }
    }

    private formatSignalNotification(signal: Signal, tradingPair: TradingPair): string {
        const riskReward = signal.calculateRiskReward();
        const strength = signal.getStrength();

        return `🎯 **${signal.direction} Signal Generated**\n\n` +
            `📊 **Pair:** ${signal.pair}\n` +
            `🏢 **Exchange:** ${signal.exchange.toUpperCase()}\n` +
            `💰 **Entry:** ${signal.entry.value} ${signal.entry.currency}\n` +
            `🎲 **Confidence:** ${signal.confidence}/10 (${strength})\n` +
            `⚖️ **Risk/Reward:** 1:${riskReward}\n` +
            `📈 **Strategy:** ${signal.strategy}\n` +
            `⏰ **Timeframe:** ${signal.timeframe}\n\n` +
            `🎯 **Take Profits:**\n` +
            signal.targets.takeProfits.map((tp, i) => `   TP${i + 1}: ${tp}`).join('\n') + '\n' +
            `🛑 **Stop Loss:** ${signal.targets.stopLoss}\n\n` +
            `📝 **Analysis:**\n` +
            signal.reasoning.map(reason => `• ${reason}`).join('\n') + '\n\n' +
            `🔗 **Signal ID:** \`${signal.id}\``;
    }

    private async publishSignalEvent(signal: Signal): Promise<void> {
        const payload: ISignalEventPayload = {
            signalId: signal.id,
            pair: signal.pair,
            direction: signal.direction,
            entry: signal.entry.value,
            confidence: signal.confidence,
            exchange: signal.exchange,
            strategy: signal.strategy,
            timestamp: signal.createdAt.getTime()
        };

        await this.eventBus.publish({
            type: 'signal.generated',
            source: 'GenerateSignalUseCase',
            version: '1.0',
            payload
        });
    }
}
