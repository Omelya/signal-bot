import { IEvent, IEventStore, IEventFilter } from '../../shared';
import { ILogger } from '../../shared';

type EventStats = {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
    oldestEvent?: Date;
    newestEvent?: Date;
}

/**
 * In-memory Event Store implementation
 * In production, this should be replaced with a persistent storage solution
 * like PostgreSQL, MongoDB, or a specialized event store like EventStore
 */
export class InMemoryEventStore implements IEventStore {
    private events: IEvent<any>[] = [];
    private readonly maxEvents: number;

    constructor(
        private readonly logger: ILogger,
        maxEvents: number = 10000 // Limit to prevent memory issues
    ) {
        this.maxEvents = maxEvents;
        this.logger.info(`InMemoryEventStore initialized with max events: ${maxEvents}`);
    }

    async append(event: IEvent<any>): Promise<void> {
        try {
            // Add event to store
            this.events.push(event);

            // Maintain size limit (FIFO)
            if (this.events.length > this.maxEvents) {
                const removedEvents = this.events.splice(0, this.events.length - this.maxEvents);
                this.logger.debug(`Removed ${removedEvents.length} old events to maintain size limit`);
            }

            this.logger.debug(`Event stored: ${event.type}`, {
                eventId: event.id,
                totalEvents: this.events.length
            });

        } catch (error) {
            this.logger.error('Failed to append event to store:', error);
            throw error;
        }
    }

    async getEvents(filter?: IEventFilter, limit?: number, offset: number = 0): Promise<IEvent<any>[]> {
        try {
            let filteredEvents = [...this.events];

            // Apply filters
            if (filter) {
                filteredEvents = this.applyFilter(filteredEvents, filter);
            }

            // Sort by timestamp (newest first)
            filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

            // Apply pagination
            if (limit !== undefined) {
                filteredEvents = filteredEvents.slice(offset, offset + limit);
            }

            return filteredEvents;

        } catch (error) {
            this.logger.error('Failed to get events from store:', error);
            throw error;
        }
    }

    async getEventsByType(type: string, limit?: number): Promise<IEvent<any>[]> {
        return this.getEvents({ types: [type] }, limit);
    }

    async getEventsByCorrelationId(correlationId: string): Promise<IEvent<any>[]> {
        return this.getEvents({ correlationIds: [correlationId] });
    }

    async getEventsAfter(timestamp: number, limit?: number): Promise<IEvent<any>[]> {
        return this.getEvents({
            timeRange: { start: timestamp, end: Date.now() }
        }, limit);
    }

    async count(filter?: IEventFilter): Promise<number> {
        try {
            if (!filter) {
                return this.events.length;
            }

            const filteredEvents = this.applyFilter([...this.events], filter);
            return filteredEvents.length;

        } catch (error) {
            this.logger.error('Failed to count events in store:', error);
            throw error;
        }
    }

    // Additional utility methods

    async getEventById(eventId: string): Promise<IEvent<any> | null> {
        const event = this.events.find(e => e.id === eventId);
        return event || null;
    }

    async getLatestEvents(limit: number = 10): Promise<IEvent<any>[]> {
        return this.getEvents(undefined, limit);
    }

    async getEventsBySource(source: string, limit?: number): Promise<IEvent<any>[]> {
        return this.getEvents({ sources: [source] }, limit);
    }

    async getEventStats(): Promise<EventStats> {
        const eventsByType: Record<string, number> = {};
        const eventsBySource: Record<string, number> = {};
        let oldestTimestamp = Number.MAX_SAFE_INTEGER;
        let newestTimestamp = 0;

        for (const event of this.events) {
            // Count by type
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

            // Count by source
            eventsBySource[event.source] = (eventsBySource[event.source] || 0) + 1;

            // Track timestamps
            if (event.timestamp < oldestTimestamp) {
                oldestTimestamp = event.timestamp;
            }
            if (event.timestamp > newestTimestamp) {
                newestTimestamp = event.timestamp;
            }
        }

        return {
            totalEvents: this.events.length,
            eventsByType,
            eventsBySource,
            oldestEvent: oldestTimestamp < Number.MAX_SAFE_INTEGER ? new Date(oldestTimestamp) : undefined,
            newestEvent: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
        } as EventStats;
    }

    async clear(): Promise<void> {
        const eventCount = this.events.length;
        this.events = [];
        this.logger.info(`Event store cleared, removed ${eventCount} events`);
    }

    private applyFilter(events: IEvent<any>[], filter: IEventFilter): IEvent<any>[] {
        return events.filter(event => {
            // Filter by types
            if (filter.types && !filter.types.includes(event.type)) {
                return false;
            }

            // Filter by sources
            if (filter.sources && !filter.sources.includes(event.source)) {
                return false;
            }

            // Filter by correlation IDs
            if (filter.correlationIds && event.correlationId &&
                !filter.correlationIds.includes(event.correlationId)) {
                return false;
            }

            // Filter by time range
            if (filter.timeRange) {
                if (event.timestamp < filter.timeRange.start ||
                    event.timestamp > filter.timeRange.end) {
                    return false;
                }
            }

            // Apply custom predicate
            if (filter.predicate && !filter.predicate(event)) {
                return false;
            }

            return true;
        });
    }
}

/**
 * File-based Event Store implementation for persistence
 * Suitable for development and small-scale production use
 */
export class FileEventStore implements IEventStore {
    private readonly filePath: string;

    constructor(
        private readonly logger: ILogger,
        filePath: string = './events.jsonl'
    ) {
        this.filePath = filePath;
        this.logger.info(`FileEventStore initialized with file: ${filePath}`);
    }

    async append(event: IEvent<any>): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const eventLine = JSON.stringify(event) + '\n';

            await fs.appendFile(this.filePath, eventLine, 'utf8');

            this.logger.debug(`Event appended to file: ${event.type}`, {
                eventId: event.id,
                file: this.filePath
            });

        } catch (error) {
            this.logger.error('Failed to append event to file:', error);
            throw error;
        }
    }

    async getEvents(filter?: IEventFilter, limit?: number, offset: number = 0): Promise<IEvent<any>[]> {
        try {
            const events = await this.loadEventsFromFile();

            let filteredEvents = events;
            if (filter) {
                filteredEvents = this.applyFilter(events, filter);
            }

            // Sort by timestamp (newest first)
            filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

            // Apply pagination
            if (limit !== undefined) {
                filteredEvents = filteredEvents.slice(offset, offset + limit);
            }

            return filteredEvents;

        } catch (error) {
            this.logger.error('Failed to get events from file:', error);
            throw error;
        }
    }

    async getEventsByType(type: string, limit?: number): Promise<IEvent<any>[]> {
        return this.getEvents({ types: [type] }, limit);
    }

    async getEventsByCorrelationId(correlationId: string): Promise<IEvent<any>[]> {
        return this.getEvents({ correlationIds: [correlationId] });
    }

    async getEventsAfter(timestamp: number, limit?: number): Promise<IEvent<any>[]> {
        return this.getEvents({
            timeRange: { start: timestamp, end: Date.now() }
        }, limit);
    }

    async count(filter?: IEventFilter): Promise<number> {
        try {
            const events = await this.loadEventsFromFile();

            if (!filter) {
                return events.length;
            }

            const filteredEvents = this.applyFilter(events, filter);
            return filteredEvents.length;

        } catch (error) {
            this.logger.error('Failed to count events in file:', error);
            throw error;
        }
    }

    private async loadEventsFromFile(): Promise<IEvent<any>[]> {
        try {
            const fs = await import('fs/promises');

            // Check if file exists
            try {
                await fs.access(this.filePath);
            } catch {
                // File doesn't exist, return empty array
                return [];
            }

            const fileContent = await fs.readFile(this.filePath, 'utf8');
            const lines = fileContent.trim().split('\n').filter(line => line.trim());

            const events: IEvent<any>[] = [];
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    events.push(event);
                } catch (parseError) {
                    this.logger.warn(`Failed to parse event line: ${line}`, parseError);
                }
            }

            return events;

        } catch (error) {
            this.logger.error('Failed to load events from file:', error);
            return [];
        }
    }

    private applyFilter(events: IEvent<any>[], filter: IEventFilter): IEvent<any>[] {
        return events.filter(event => {
            if (filter.types && !filter.types.includes(event.type)) {
                return false;
            }

            if (filter.sources && !filter.sources.includes(event.source)) {
                return false;
            }

            if (filter.correlationIds && event.correlationId &&
                !filter.correlationIds.includes(event.correlationId)) {
                return false;
            }

            if (filter.timeRange) {
                if (event.timestamp < filter.timeRange.start ||
                    event.timestamp > filter.timeRange.end) {
                    return false;
                }
            }

            return !(filter.predicate && !filter.predicate(event));
        });
    }
}
