import {Signal} from "../../domain/entities/Signal";
import {IEvent, ILogger} from "../../shared";
import {INotificationService} from "../../domain/services/INotificationService";
import {ISignalRepository} from "../../domain/repositories/ISignalRepository";
import {BaseEventHandler} from "../services/EventBus";

/**
 * Handler for signal failure events
 */
export class SignalFailureHandler extends BaseEventHandler {
    eventType = 'signal.failed';

    constructor(
        private readonly signalRepository: ISignalRepository,
        private readonly notificationService: INotificationService,
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<any>): Promise<void> {
        try {
            const signalId = event.payload.signalId;
            const reason = event.payload.reason;

            const signal = await this.signalRepository.findById(signalId);

            if (!signal) {
                this.logger.error(`Signal not found for failure: ${signalId}`);
                return;
            }

            // Mark signal as failed
            signal.markAsFailed();
            await this.signalRepository.save(signal);

            // Send failure notification if critical
            if (event.payload.critical) {
                await this.sendFailureNotification(signal, reason);
            }

            this.logger.warn(`Signal marked as failed`, {
                signalId: signal.id,
                pair: signal.pair,
                reason,
                failureTime: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('Error handling signal failure event:', error);
        }
    }

    private async sendFailureNotification(signal: Signal, reason: string): Promise<void> {
        try {
            const message = `❌ **Signal Failed**\n\n` +
                `📊 **Pair:** ${signal.pair}\n` +
                `🔗 **Signal ID:** ${signal.id}\n` +
                `📝 **Reason:** ${reason}\n` +
                `⏰ **Time:** ${new Date().toLocaleString()}`;

            const title = '❌ Error';

            await this.notificationService.sendAlert(title, message);
        } catch (error) {
            this.logger.error('Failed to send failure notification:', error);
        }
    }
}
