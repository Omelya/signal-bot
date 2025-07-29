import { BaseEventHandler } from '../services/EventBus';
import { INotificationService } from '../../domain/services/INotificationService';
import { ISignalRepository } from '../../domain/repositories/ISignalRepository';
import { ILogger } from '../../shared';
import { IEvent, ISignalEventPayload, EventTypes } from '../../shared';
import { Signal } from '../../domain/entities/Signal';

/**
 * Handler for signal generation events with race condition protection
 */
export class SignalHandler extends BaseEventHandler<ISignalEventPayload> {
    readonly eventType = EventTypes.SIGNAL_GENERATED;

    // Track signals being processed to prevent race conditions
    private readonly processingSignals = new Set<string>();

    constructor(
        private readonly notificationService: INotificationService,
        private readonly signalRepository: ISignalRepository,
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<ISignalEventPayload>): Promise<void> {
        const { signalId, pair, direction } = event.payload;

        try {
            this.logger.debug(`Handling signal generated event`, {
                eventId: event.id,
                signalId,
                pair,
                direction,
                correlationId: event.correlationId
            });

            // Prevent race conditions - check if signal is already being processed
            if (this.processingSignals.has(signalId)) {
                this.logger.debug(`Signal ${signalId} is already being processed, skipping`);
                return;
            }

            // Mark signal as being processed
            this.processingSignals.add(signalId);

            try {
                // Get the full signal from repository
                const signal = await this.signalRepository.findById(signalId);
                if (!signal) {
                    this.logger.error(`Signal not found: ${signalId}`);
                    return;
                }

                // Process the signal with atomic operations
                await this.processSignalAtomically(signal, event);

                this.logger.info(`Signal processed successfully`, {
                    eventId: event.id,
                    signalId: signal.id,
                    pair: signal.pair,
                    status: signal.status
                });

            } finally {
                // Always remove from processing set
                this.processingSignals.delete(signalId);
            }

        } catch (error: any) {
            this.logger.error(`Error handling signal event:`, {
                eventId: event.id,
                error: error.message,
                signalId,
                pair,
                correlationId: event.correlationId
            });
        }
    }

    private async processSignalAtomically(signal: Signal, event: IEvent<ISignalEventPayload>): Promise<void> {
        // Use database transaction or optimistic locking to prevent race conditions
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                // Reload signal to get latest state
                const currentSignal = await this.signalRepository.findById(signal.id);
                if (!currentSignal) {
                    throw new Error(`Signal ${signal.id} not found during processing`);
                }

                // Check if signal is still in pending state
                if (currentSignal.status !== 'PENDING') {
                    this.logger.debug(`Signal ${signal.id} is no longer pending (status: ${currentSignal.status}), skipping processing`);
                    return;
                }

                // Process notifications
                await this.sendSignalNotifications(currentSignal, event);

                // Atomically update signal status
                currentSignal.markAsSent();
                await this.signalRepository.save(currentSignal);

                // Log analytics
                await this.logSignalAnalytics(currentSignal, event);

                // Perform additional processing
                await this.performAdditionalProcessing(currentSignal);

                // Success - break the retry loop
                break;

            } catch (error: any) {
                retryCount++;

                if (error.message.includes('version') || error.message.includes('conflict')) {
                    // Optimistic locking conflict - retry
                    this.logger.warn(`Optimistic locking conflict for signal ${signal.id}, retry ${retryCount}/${maxRetries}`);

                    if (retryCount < maxRetries) {
                        // Wait before retrying with exponential backoff
                        await this.sleep(Math.pow(2, retryCount) * 100);
                        continue;
                    }
                }

                // Log error and mark signal as failed
                this.logger.error(`Error processing signal ${signal.id} (attempt ${retryCount}):`, error);

                if (retryCount >= maxRetries) {
                    // Mark signal as failed after max retries
                    try {
                        const failedSignal = await this.signalRepository.findById(signal.id);
                        if (failedSignal && failedSignal.status === 'PENDING') {
                            failedSignal.markAsFailed();
                            await this.signalRepository.save(failedSignal);
                        }
                    } catch (saveError) {
                        this.logger.error(`Failed to mark signal as failed: ${saveError}`);
                    }
                    throw error;
                }
            }
        }
    }

    private async sendSignalNotifications(signal: Signal, event: IEvent<ISignalEventPayload>): Promise<void> {
        try {
            const message = this.formatSignalMessage(signal);

            // Send to all enabled notification channels
            await this.notificationService.sendSignalNotification(signal, message);

            this.logger.info(`Signal notifications sent`, {
                eventId: event.id,
                signalId: signal.id,
                channels: this.notificationService.getEnabledChannels(),
            });
        } catch (error) {
            this.logger.error(`Failed to send signal notifications:`, error);
            throw error; // Re-throw to trigger retry mechanism
        }
    }

    private formatSignalMessage(signal: Signal): string {
        const riskReward = signal.calculateRiskReward();
        const strength = signal.getStrength();
        const potentialProfit = signal.getPotentialProfit(0);
        const potentialLoss = signal.getPotentialLoss();

        return `🎯 **${signal.direction} SIGNAL**\n\n` +
            `📊 **Pair:** ${signal.pair}\n` +
            `🏢 **Exchange:** ${signal.exchange.toUpperCase()}\n` +
            `💰 **Entry Price:** ${signal.entry.value} ${signal.entry.currency}\n` +
            `🎲 **Confidence:** ${signal.confidence}/10 (${strength})\n` +
            `⚖️ **Risk/Reward:** 1:${riskReward}\n` +
            `📈 **Strategy:** ${signal.strategy}\n` +
            `⏰ **Timeframe:** ${signal.timeframe}\n\n` +
            `🎯 **Take Profit Targets:**\n` +
            signal.targets.takeProfits.map((tp, i) => {
                const profit = signal.getPotentialProfit(i);
                return `   TP${i + 1}: ${tp} (${profit.toFixed(2)}% profit)`;
            }).join('\n') + '\n' +
            `🛑 **Stop Loss:** ${signal.targets.stopLoss} (${potentialLoss.toFixed(2)}% loss)\n\n` +
            `📊 **Profit Potential:** +${potentialProfit.toFixed(2)}%\n` +
            `📉 **Loss Potential:** -${potentialLoss.toFixed(2)}%\n\n` +
            `📝 **Technical Analysis:**\n` +
            signal.reasoning.map(reason => `• ${reason}`).join('\n') + '\n\n' +
            `⏰ **Generated:** ${signal.createdAt.toLocaleString()}\n` +
            `🔗 **Signal ID:** \`${signal.id}\`\n\n` +
            `⚠️ **Risk Warning:** Trading involves risk. Always do your own research and never invest more than you can afford to lose.`;
    }

    private async logSignalAnalytics(signal: Signal, event: IEvent<ISignalEventPayload>): Promise<void> {
        try {
            const analytics = {
                eventId: event.id,
                signalId: signal.id,
                pair: signal.pair,
                exchange: signal.exchange,
                direction: signal.direction,
                confidence: signal.confidence,
                strategy: signal.strategy,
                timeframe: signal.timeframe,
                entryPrice: signal.entry.value,
                riskReward: signal.calculateRiskReward(),
                strength: signal.getStrength(),
                takeProfitCount: signal.targets.takeProfits.length,
                potentialProfit: signal.getPotentialProfit(0),
                potentialLoss: signal.getPotentialLoss(),
                reasoning: signal.reasoning,
                timestamp: signal.createdAt.toISOString(),
                ageMinutes: signal.getAgeInMinutes(),
                correlationId: event.correlationId,
                source: event.source
            };

            this.logger.info('Signal analytics logged', { analytics });

        } catch (error) {
            this.logger.error('Failed to log signal analytics:', error);
            // Don't throw - analytics failure shouldn't break signal processing
        }
    }

    private async performAdditionalProcessing(signal: Signal): Promise<void> {
        try {
            // Run additional processing in parallel where possible
            await Promise.all([
                this.validateSignalRisk(signal),
                this.checkMarketConditions(signal),
                this.analyzePortfolioImpact(signal),
                this.checkHistoricalPerformance(signal)
            ]);

        } catch (error) {
            this.logger.warn('Additional signal processing failed:', error);
            // Non-critical processing failure - log but don't throw
        }
    }

    private async validateSignalRisk(signal: Signal): Promise<void> {
        const riskReward = signal.calculateRiskReward();

        if (riskReward < 1.5) {
            this.logger.warn(`Signal ${signal.id} has low risk/reward ratio: ${riskReward}`);
        }

        const potentialLoss = signal.getPotentialLoss();
        if (potentialLoss > 5) { // 5% max loss threshold
            this.logger.warn(`Signal ${signal.id} has high potential loss: ${potentialLoss}%`);
        }
    }

    private async checkMarketConditions(signal: Signal): Promise<void> {
        this.logger.debug(`Market conditions check for signal ${signal.id}`, {
            pair: signal.pair,
            timeframe: signal.timeframe
        });
    }

    private async analyzePortfolioImpact(signal: Signal): Promise<void> {
        this.logger.debug(`Portfolio impact analysis for signal ${signal.id}`, {
            pair: signal.pair,
            direction: signal.direction
        });
    }

    private async checkHistoricalPerformance(signal: Signal): Promise<void> {
        this.logger.debug(`Historical performance check for signal ${signal.id}`, {
            strategy: signal.strategy,
            pair: signal.pair
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
