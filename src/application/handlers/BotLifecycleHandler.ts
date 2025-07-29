import {IEvent, ILogger} from "../../shared";
import {BaseEventHandler} from "../services/EventBus";

/**
 * Handler for bot lifecycle events
 */
export class BotLifecycleHandler extends BaseEventHandler {
    eventType = 'bot.started';

    constructor(
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<any>): Promise<void> {
        try {
            const { botId, status } = event.payload;

            this.logger.info(`Bot lifecycle event: ${event.type}`, {
                botId,
                status,
                timestamp: new Date().toISOString()
            });

            // Additional actions for bot lifecycle:
            // - Send status notifications
            // - Update monitoring dashboards
            // - Log to external systems
            // - Trigger backup procedures

        } catch (error) {
            this.logger.error('Error handling bot lifecycle event:', error);
        }
    }

    // Handle multiple bot lifecycle events
    canHandle(event: IEvent<any>): boolean {
        return [
            'bot.started',
            'bot.stopped',
            'bot.error',
            'bot.healthy',
            'bot.unhealthy'
        ].includes(event.type);
    }
}
