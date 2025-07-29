export class DomainError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'DomainError';
        Object.setPrototypeOf(this, DomainError.prototype);
    }
}

export class SignalGenerationError extends DomainError {
    constructor(message: string) {
        super(message, 'SIGNAL_GENERATION_ERROR');
        this.name = 'SignalGenerationError';
    }
}

export class MarketDataError extends DomainError {
    constructor(message: string) {
        super(message, 'MARKET_DATA_ERROR');
        this.name = 'MarketDataError';
    }
}

export class NotificationError extends DomainError {
    constructor(message: string) {
        super(message, 'NOTIFICATION_ERROR');
        this.name = 'NotificationError';
    }
}

export class ExchangeNotInitializedError extends DomainError {
    constructor(exchangeType: string) {
        super(`Exchange ${exchangeType} is not initialized`, 'EXCHANGE_NOT_INITIALIZED');
        this.name = 'ExchangeNotInitializedError';
    }
}

export class ExchangeApiError extends DomainError {
    constructor(message: string) {
        super(message, 'EXCHANGE_API_ERROR');
        this.name = 'ExchangeApiError';
    }
}

export class UnsupportedExchangeError extends DomainError {
    constructor(message: string) {
        super(message, 'UNSUPPORTED_EXCHANGE');
        this.name = 'UnsupportedExchangeError';
    }
}

export class BotAlreadyRunningError extends DomainError {
    constructor(message: string = 'Bot is already running') {
        super(message, 'BOT_ALREADY_RUNNING');
        this.name = 'BotAlreadyRunningError';
    }
}

export class ServiceNotFoundError extends DomainError {
    constructor(message: string) {
        super(message, 'SERVICE_NOT_FOUND');
        this.name = 'ServiceNotFoundError';
    }
}
