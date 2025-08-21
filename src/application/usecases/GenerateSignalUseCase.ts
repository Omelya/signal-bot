import { ISignalRepository } from '../../domain/repositories/ISignalRepository';
import { ISignalGenerator } from '../../domain/services/ISignalGenerator';
import { INotificationService } from '../../domain/services/INotificationService';
import { Signal } from '../../domain/entities/Signal';
import { MarketData } from '../../domain/entities/MarketData';
import { TradingPair } from '../../domain/entities/TradingPair';
import {DIContainer, IEventBus} from '../../shared';
import { ILogger } from '../../shared';
import { DomainError } from '../../shared';
import { ISignalEventPayload } from '../../shared';
import {SimpleSignalGenerator} from "../../domain/services/SimpleSignalGenerator";

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
            await this.signalRepository.cleanupExpiredSignals();

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

            const simpleSignalGenerator = DIContainer.initialize().get('simpleSignalGenerator') as SimpleSignalGenerator;

            const signal = await simpleSignalGenerator
                .generateSignal(tradingPair, marketData);

            if (!signal.signal) {
                this.logger.info(`No signal generated for ${tradingPair.symbol}`, {
                    symbol: tradingPair.symbol,
                    currentPrice: marketData.currentPrice
                });

                return null;
            }

            if (signal.confidence < strategy.minSignalStrength) {
                this.logger.info(`Signal confidence too low for ${tradingPair.symbol}`, {
                    confidence: signal.confidence,
                    required: strategy.minSignalStrength
                });

                return null;
            }

            const signalItem = signal.signal;

            const activePairSignal = await this.signalRepository.findActiveByPair(signalItem.pair);
            if (activePairSignal) {
                this.logger.warn(`Max simultaneous signals reached for ${tradingPair.symbol}`);

                return null;
            }

            await this.signalRepository.save(signalItem);

            tradingPair.updateLastSignalTime();

            await this.sendSignalNotification(signalItem);
            await this.publishSignalEvent(signalItem);

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

    private async sendSignalNotification(signal: Signal): Promise<void> {
        try {
            const message = this.formatSignalNotification(signal);
            await this.notificationService.sendSignalNotification(signal, message);
        } catch (error) {
            this.logger.error(`Failed to send signal notification for ${signal.pair}:`, error);
        }
    }

    private formatSignalNotification(signal: Signal): string {
        const riskReward = signal.calculateRiskReward();
        const strength = signal.getStrength();

        return `🎯 <b>${signal.direction} Signal Generated</b>\n\n` +
            `📊 <b>Pair:</b> ${signal.pair}\n` +
            `🏢 <b>Exchange:</b> ${signal.exchange.toUpperCase()}\n` +
            `💰 <b>Entry:</b> ${signal.entry.value} ${signal.entry.currency}\n` +
            `🎲 <b>Confidence:</b> ${signal.confidence}/10 (${strength})\n` +
            `⚖️ <b>Risk/Reward:</b> 1:${riskReward}\n` +
            `📈 <b>Strategy:</b> ${signal.strategy}\n` +
            `⏰ <b>Timeframe:</b> ${signal.timeframe}\n\n` +
            `🎯 <b>Take Profits:</b>\n` +
            signal.targets.takeProfits.map((tp, i) => `   TP${i + 1}: ${tp}`).join('\n') + '\n' +
            `🛑 <b>Stop Loss:</b> ${signal.targets.stopLoss}\n\n` +
            `📝 <b>Analysis:</b>\n` +
            signal.reasoning.map(reason => `• ${reason}`).join('\n') + '\n\n' +
            `🔗 <b>Signal ID:</b> <code>${signal.id}</code>`;
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
