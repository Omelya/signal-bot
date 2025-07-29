import {IEvent, ILogger} from "../../shared";
import {ISignalRepository} from "../../domain/repositories/ISignalRepository";
import {BaseEventHandler} from "../services/EventBus";

/**
 * Handler for signal execution events
 */
export class SignalExecutionHandler extends BaseEventHandler {
    eventType = 'signal.executed';

    constructor(
        private readonly signalRepository: ISignalRepository,
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<any>): Promise<void> {
        try {
            const signalId = event.payload.signalId;
            const signal = await this.signalRepository.findById(signalId);

            if (!signal) {
                this.logger.error(`Signal not found for execution: ${signalId}`);
                return;
            }

            // Mark signal as executed
            signal.markAsExecuted();
            await this.signalRepository.save(signal);

            this.logger.info(`Signal marked as executed`, {
                signalId: signal.id,
                pair: signal.pair,
                direction: signal.direction,
                executionTime: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('Error handling signal execution event:', error);
        }
    }
}
