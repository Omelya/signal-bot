import { IEvent, IEventBus, IEventHandler, IEventBusMetrics, IEventStore } from '../../shared';
import { ILogger } from '../../shared';
import {UniqueId} from '../../domain/valueObjects/UniqueId';

export class EventBus implements IEventBus {
    private handlers = new Map<string, Set<IEventHandler>>();
    private readonly eventStore?: IEventStore|undefined;
    private metrics: IEventBusMetrics = {
        totalEventsPublished: 0,
        totalEventsHandled: 0,
        eventsByType: {},
        handlersByType: {},
        averageHandlingTime: 0,
        errorCount: 0,
        lastEventTimestamp: 0
    };
    private handlingTimes: number[] = [];
    private readonly maxHandlingTimes = 1000;

    constructor(
        private readonly logger: ILogger,
        eventStore?: IEventStore
    ) {
        this.eventStore = eventStore;
    }

    async publish<T>(eventData: Omit<IEvent<T>, 'id' | 'timestamp'>): Promise<void> {
        const event: IEvent<T> = {
            id: UniqueId.generate().value,
            timestamp: Date.now(),
            ...eventData
        };

        try {
            this.logger.debug(`Publishing event: ${event.type}`, {
                eventId: event.id,
                type: event.type,
                source: event.source,
                correlationId: event.correlationId
            });

            // Update metrics
            this.updatePublishMetrics(event);

            // Store event if persistence is enabled
            if (this.eventStore) {
                try {
                    await this.eventStore.append(event);
                } catch (error) {
                    this.logger.warn('Failed to store event:', error);
                    // Continue processing even if storage fails
                }
            }

            // Get handlers for this event type
            const eventHandlers = this.handlers.get(event.type);
            if (!eventHandlers || eventHandlers.size === 0) {
                this.logger.debug(`No handlers registered for event type: ${event.type}`);
                return;
            }

            // Execute all handlers with error isolation
            await this.executeHandlers(event, eventHandlers);

        } catch (error) {
            this.metrics.errorCount++;
            this.logger.error(`Error publishing event ${event.type}:`, error);
            throw error;
        }
    }

    subscribe<T>(eventType: string, handler: IEventHandler<T>): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }

        const eventHandlers = this.handlers.get(eventType)!;
        eventHandlers.add(handler as IEventHandler);

        // Update metrics
        this.metrics.handlersByType[eventType] = eventHandlers.size;

        this.logger.debug(`Handler subscribed to event type: ${eventType}`, {
            handler: handler.constructor.name,
            totalHandlers: eventHandlers.size
        });
    }

    unsubscribe<T>(eventType: string, handler: IEventHandler<T>): void {
        const eventHandlers = this.handlers.get(eventType);
        if (!eventHandlers) {
            this.logger.warn(`No handlers found for event type: ${eventType}`);
            return;
        }

        const removed = eventHandlers.delete(handler as IEventHandler);
        if (removed) {
            this.metrics.handlersByType[eventType] = eventHandlers.size;

            if (eventHandlers.size === 0) {
                this.handlers.delete(eventType);
                delete this.metrics.handlersByType[eventType];
            }

            this.logger.debug(`Handler unsubscribed from event type: ${eventType}`, {
                handler: handler.constructor.name,
                remainingHandlers: eventHandlers.size
            });
        }
    }

    clear(): void {
        const totalHandlers = Array.from(this.handlers.values())
            .reduce((sum, handlers) => sum + handlers.size, 0);

        this.handlers.clear();
        this.metrics.handlersByType = {};

        this.logger.info(`EventBus cleared`, {
            removedHandlers: totalHandlers
        });
    }

    getMetrics(): IEventBusMetrics {
        return { ...this.metrics };
    }

    async waitForEvent<T>(eventType: string, timeout: number = 5000): Promise<IEvent<T>> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.unsubscribe(eventType, handler);
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeout);

            const handler: IEventHandler<T> = {
                eventType,
                handle: (event: IEvent<T>) => {
                    clearTimeout(timeoutId);
                    this.unsubscribe(eventType, handler);
                    resolve(event);
                }
            };

            this.subscribe(eventType, handler);
        });
    }

    // Helper Methods

    private async executeHandlers<T>(event: IEvent<T>, handlers: Set<IEventHandler>): Promise<void> {
        const handlerPromises = Array.from(handlers).map(async (handler) => {
            const startTime = Date.now();

            try {
                // Check if handler can handle this specific event
                if (handler.canHandle && !handler.canHandle(event)) {
                    this.logger.debug(`Handler skipped event ${event.type} (canHandle returned false)`, {
                        handler: handler.constructor.name
                    });
                    return;
                }

                await handler.handle(event);

                // Track successful handling
                const handlingTime = Date.now() - startTime;
                this.trackHandlingTime(handlingTime);
                this.metrics.totalEventsHandled++;

                this.logger.debug(`Event ${event.type} handled successfully`, {
                    eventId: event.id,
                    handler: handler.constructor.name,
                    handlingTime: `${handlingTime}ms`
                });

            } catch (error: any) {
                this.metrics.errorCount++;
                this.logger.error(`Error handling event ${event.type}:`, {
                    eventId: event.id,
                    error: error.message,
                    handler: handler.constructor.name,
                    correlationId: event.correlationId
                });
                // Continue with other handlers even if one fails
            }
        });

        await Promise.all(handlerPromises);
    }

    private updatePublishMetrics<T>(event: IEvent<T>): void {
        this.metrics.totalEventsPublished++;
        this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1;
        this.metrics.lastEventTimestamp = event.timestamp;
    }

    private trackHandlingTime(handlingTime: number): void {
        this.handlingTimes.push(handlingTime);

        if (this.handlingTimes.length > this.maxHandlingTimes) {
            this.handlingTimes.shift();
        }

        if (this.handlingTimes.length > 0) {
            const sum = this.handlingTimes.reduce((total, time) => total + time, 0);
            this.metrics.averageHandlingTime = Math.round(sum / this.handlingTimes.length);
        }
    }

    // Additional utility methods

    getRegisteredEventTypes(): string[] {
        return Array.from(this.handlers.keys());
    }

    getHandlerCount(eventType: string): number {
        const handlers = this.handlers.get(eventType);
        return handlers ? handlers.size : 0;
    }

    hasHandlers(eventType: string): boolean {
        return this.getHandlerCount(eventType) > 0;
    }

    async publishBatch<T>(events: Array<Omit<IEvent<T>, 'id' | 'timestamp'>>): Promise<void> {
        if (events.length === 0) return;

        this.logger.debug(`Publishing batch of ${events.length} events`);

        const promises = events.map(eventData => this.publish(eventData));
        await Promise.all(promises);

        this.logger.debug(`Batch of ${events.length} events published successfully`);
    }

    resetMetrics(): void {
        this.metrics = {
            totalEventsPublished: 0,
            totalEventsHandled: 0,
            eventsByType: {},
            handlersByType: { ...this.metrics.handlersByType },
            averageHandlingTime: 0,
            errorCount: 0,
            lastEventTimestamp: 0
        };
        this.handlingTimes = [];

        this.logger.info('EventBus metrics reset');
    }

    getHealthStatus(): {
        isHealthy: boolean;
        issues: string[];
        metrics: IEventBusMetrics;
    } {
        const issues: string[] = [];
        let isHealthy = true;

        const totalEvents = this.metrics.totalEventsPublished;
        if (totalEvents > 100) {
            const errorRate = this.metrics.errorCount / totalEvents;
            if (errorRate > 0.05) {
                issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
                isHealthy = false;
            }
        }

        if (this.metrics.averageHandlingTime > 1000) {
            issues.push(`Slow event handling: ${this.metrics.averageHandlingTime}ms average`);
            isHealthy = false;
        }

        const totalHandlers = Object.values(this.metrics.handlersByType)
            .reduce((sum, count) => sum + count, 0);

        if (totalHandlers === 0 && totalEvents > 0) {
            issues.push('No event handlers registered but events are being published');
            isHealthy = false;
        }

        return {
            isHealthy,
            issues,
            metrics: this.getMetrics()
        };
    }
}

export abstract class BaseEventHandler<T = any> implements IEventHandler<T> {
    abstract readonly eventType: string;
    abstract handle(event: IEvent<T>): Promise<void> | void;

    canHandle?(event: IEvent<any>): boolean {
        return event.type === this.eventType;
    }
}
