import {BaseEventHandler} from "../services/EventBus";
import {IEvent, ILogger} from "../../shared";

/**
 * Handler for market data update events
 */
export class MarketDataHandler extends BaseEventHandler {
    eventType = 'market.data.updated';

    constructor(
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<any>): Promise<void> {
        try {
            const { symbol, exchange, price, volume, timestamp } = event.payload;

            this.logger.debug(`Market data updated`, {
                symbol,
                exchange,
                price,
                volume,
                timestamp
            });

            // Additional market data processing could be done here:
            // - Update price caches
            // - Trigger technical analysis
            // - Check for significant price movements
            // - Update volatility calculations

        } catch (error) {
            this.logger.error('Error handling market data event:', error);
        }
    }
}
