// Unified Event Interface
import {SignalDirection} from "./Signal.types";

export interface IEvent<T = any> {
    readonly id: string;
    readonly type: string;
    readonly timestamp: number;
    readonly payload: T;
    readonly correlationId?: string;
    readonly source: string;
    readonly version: string;
}

// Event Bus Interface
export interface IEventBus {
    publish<T>(event: Omit<IEvent<T>, 'id' | 'timestamp'>): Promise<void>;
    subscribe<T>(eventType: string, handler: IEventHandler<T>): void;
    unsubscribe<T>(eventType: string, handler: IEventHandler<T>): void;
    clear(): void;
    getMetrics(): IEventBusMetrics;
    waitForEvent<T>(eventType: string, timeout?: number): Promise<IEvent<T>>;
}

// Event Handler Interface
export interface IEventHandler<T = any> {
    readonly eventType: string;
    handle(event: IEvent<T>): Promise<void> | void;
    canHandle?(event: IEvent<any>): boolean;
}

// Event Bus Metrics
export interface IEventBusMetrics {
    totalEventsPublished: number;
    totalEventsHandled: number;
    eventsByType: Record<string, number>;
    handlersByType: Record<string, number>;
    averageHandlingTime: number;
    errorCount: number;
    lastEventTimestamp: number;
}

// Event Store Interface
export interface IEventStore {
    append(event: IEvent<any>): Promise<void>;
    getEvents(filter?: IEventFilter, limit?: number, offset?: number): Promise<IEvent<any>[]>;
    getEventsByType(type: string, limit?: number): Promise<IEvent<any>[]>;
    getEventsByCorrelationId(correlationId: string): Promise<IEvent<any>[]>;
    getEventsAfter(timestamp: number, limit?: number): Promise<IEvent<any>[]>;
    count(filter?: IEventFilter): Promise<number>;
}

// Event Filter Interface
export interface IEventFilter {
    types?: string[];
    sources?: string[];
    correlationIds?: string[];
    timeRange?: { start: number; end: number };
    predicate?: (event: IEvent<any>) => boolean;
}

// Common Event Payloads
export interface ISignalEventPayload {
    signalId: string;
    pair: string;
    direction: SignalDirection;
    entry: number;
    confidence: number;
    exchange: string;
    strategy: string;
    timestamp: number;
}

export interface IMarketDataEventPayload {
    symbol: string;
    exchange: string;
    timeframe: string;
    timestamp: number;
    candleCount: number;
    price: number;
    volume: number;
}

export interface IExchangeEventPayload {
    exchange: string;
    status: string;
    latency?: number;
    errorMessage?: string;
    timestamp: number;
}

export interface IBotEventPayload {
    botId: string;
    status: 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'ERROR';
    uptime?: number;
    activeExchanges?: string[];
    activePairs?: string[];
    timestamp: number;
    error?: string;
}

export interface IConfigEventPayload {
    configKey: string;
    oldValue?: any;
    newValue?: any;
    timestamp: number;
}

export interface IPerformanceEventPayload {
    botId: string;
    metrics: {
        memoryUsage: number;
        cpuUsage: number;
        signalsPerHour: number;
        successRate: number;
        averageLatency: number;
        errorCount: number;
    };
    timestamp: number;
}

// Event Categories for organization
export enum EventCategory {
    SIGNAL = 'signal',
    MARKET = 'market',
    EXCHANGE = 'exchange',
    BOT = 'bot',
    CONFIG = 'config',
    PERFORMANCE = 'performance',
    SYSTEM = 'system'
}

// Event Types Constants
export const EventTypes = {
    // Signal Events
    SIGNAL_GENERATED: 'signal.generated',
    SIGNAL_EXECUTED: 'signal.executed',
    SIGNAL_FAILED: 'signal.failed',
    SIGNAL_BATCH_COMPLETED: 'signal.batch.completed',
    SIGNAL_GENERATION_FAILED: 'signal.generation.failed',

    // Bot Events
    BOT_STARTING: 'bot.starting',
    BOT_STARTED: 'bot.started',
    BOT_STOPPING: 'bot.stopping',
    BOT_STOPPED: 'bot.stopped',
    BOT_ERROR: 'bot.error',
    BOT_HEALTHY: 'bot.healthy',
    BOT_UNHEALTHY: 'bot.unhealthy',
    BOT_METRICS: 'bot.metrics',

    // Exchange Events
    EXCHANGE_CONNECTED: 'exchange.connected',
    EXCHANGE_DISCONNECTED: 'exchange.disconnected',
    EXCHANGE_ERROR: 'exchange.error',
    EXCHANGE_CONNECTION_FAILED: 'exchange.connection.failed',
    EXCHANGES_INITIALIZED: 'exchanges.initialized',

    // Market Events
    MARKET_DATA_UPDATED: 'market.data.updated',
    MONITORING_STARTED: 'monitoring.started',
    MONITORING_STOPPED: 'monitoring.stopped',
    MONITORING_ERROR: 'monitoring.error',

    // Config Events
    CONFIG_CHANGED: 'config.changed',
    CONFIG_PAIR_ADDED: 'config.pair.added',
    CONFIG_PAIR_REMOVED: 'config.pair.removed',
    CONFIG_PAIR_ACTIVATED: 'config.pair.activated',
    CONFIG_PAIR_DEACTIVATED: 'config.pair.deactivated',
    CONFIG_PAIR_UPDATED: 'config.pair.updated',
    CONFIG_PAIRS_LOADED: 'config.pairs.loaded',
    CONFIG_STRATEGIES_OPTIMIZED: 'config.strategies.optimized',

    // Performance Events
    PERFORMANCE_METRICS: 'performance.metrics'
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
