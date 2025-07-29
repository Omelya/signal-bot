import {IEvent, ILogger} from "../../shared";
import {BaseEventHandler} from "../services/EventBus";

/**
 * Handler for configuration change events
 */
export class ConfigurationChangeHandler extends BaseEventHandler {
    eventType = 'config.changed';

    constructor(
        private readonly logger: ILogger
    ) {
        super();
    }

    async handle(event: IEvent<any>): Promise<void> {
        try {
            const { configKey, oldValue, newValue } = event.payload;

            this.logger.info(`Configuration changed`, {
                configKey,
                oldValue,
                newValue,
                timestamp: new Date().toISOString()
            });

            // Actions on configuration changes:
            // - Validate new configuration
            // - Apply changes to running services
            // - Send notifications to administrators
            // - Log configuration audit trail

        } catch (error) {
            this.logger.error('Error handling configuration change event:', error);
        }
    }

    canHandle(event: IEvent<any>): boolean {
        return [
            'config.changed',
            'config.pair.added',
            'config.pair.removed',
            'config.pair.activated',
            'config.pair.deactivated'
        ].includes(event.type);
    }
}
