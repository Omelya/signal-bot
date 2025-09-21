import {BaseEventHandler} from "../services/EventBus";
import {EventTypes, IEvent, ILogger, IMarketDataEventPayload} from "../../shared";
import {IPairRepository} from "../../domain/repositories/IPairRepository";
import {IGenerateSignalUseCase} from "../usecases/GenerateSignalUseCase";

/**
 * Handler for market data update events
 */
export class MarketDataHandler extends BaseEventHandler {
    eventType = EventTypes.MARKET_DATA_UPDATED;

    constructor(
        private readonly pairRepository: IPairRepository,
        private readonly generateSignalUseCase: IGenerateSignalUseCase,
        private readonly logger: ILogger,
    ) {
        super();
    }

    async handle(event: IEvent<IMarketDataEventPayload>): Promise<void> {
        try {
            const { marketData, pair } = event.payload;

            const signal = await this.generateSignalUseCase.execute(marketData, pair);

            if (signal) {
                pair.markSignalAsSuccessful();

                await this.pairRepository.update(pair);
            }
        } catch (error) {
            this.logger.error('Error handling market data event:', error);
        }
    }
}
