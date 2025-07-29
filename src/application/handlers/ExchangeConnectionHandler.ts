import {IEvent, ILogger} from "../../shared";
import {BaseEventHandler} from "../services/EventBus";

/**
 * Handler for exchange connection events
 */
export class ExchangeConnectionHandler extends BaseEventHandler {
    eventType = 'exchange.connected';

    constructor(
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<any>): Promise<void> {
        try {
            const { exchange, latency } = event.payload;

            this.logger.info(`Exchange connected`, {
                exchange,
                latency,
                timestamp: new Date().toISOString()
            });

            // Additional actions when exchange connects:
            // - Start monitoring for this exchange
            // - Load market data
            // - Update exchange status in dashboard
            // - Send notification to administrators

        } catch (error) {
            this.logger.error('Error handling exchange connection event:', error);
        }
    }

    // Override canHandle to handle multiple exchange events
    canHandle(event: IEvent<any>): boolean {
        return [
            'exchange.connected',
            'exchange.disconnected',
            'exchange.error'
        ].includes(event.type);
    }
}
