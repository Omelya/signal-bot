export class InfrastructureError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'InfrastructureError';
        Object.setPrototypeOf(this, InfrastructureError.prototype);
    }
}

export class DatabaseConnectionError extends InfrastructureError {
    constructor(message: string, public readonly database?: string) {
        super(message, 'DATABASE_CONNECTION_ERROR');
        this.name = 'DatabaseConnectionError';
    }
}

export class ExternalApiError extends InfrastructureError {
    constructor(
        message: string,
        public readonly apiName: string,
        public readonly statusCode?: number,
        public readonly responseBody?: any
    ) {
        super(message, 'EXTERNAL_API_ERROR');
        this.name = 'ExternalApiError';
    }
}

export class NetworkError extends InfrastructureError {
    constructor(message: string, public readonly url?: string) {
        super(message, 'NETWORK_ERROR');
        this.name = 'NetworkError';
    }
}

export class ConfigurationError extends InfrastructureError {
    constructor(message: string, public readonly configKey?: string) {
        super(message, 'CONFIGURATION_ERROR');
        this.name = 'ConfigurationError';
    }
}

export class FileSystemError extends InfrastructureError {
    constructor(message: string, public readonly filePath?: string) {
        super(message, 'FILE_SYSTEM_ERROR');
        this.name = 'FileSystemError';
    }
}

export class SerializationError extends InfrastructureError {
    constructor(message: string, public readonly data?: any) {
        super(message, 'SERIALIZATION_ERROR');
        this.name = 'SerializationError';
    }
}

export class CacheError extends InfrastructureError {
    constructor(message: string, public readonly key?: string) {
        super(message, 'CACHE_ERROR');
        this.name = 'CacheError';
    }
}

export class RateLimitError extends InfrastructureError {
    constructor(
        message: string,
        public readonly retryAfter?: number,
        public readonly limit?: number
    ) {
        super(message, 'RATE_LIMIT_ERROR');
        this.name = 'RateLimitError';
    }
}

export class TimeoutError extends InfrastructureError {
    constructor(message: string, public readonly timeoutMs?: number) {
        super(message, 'TIMEOUT_ERROR');
        this.name = 'TimeoutError';
    }
}

export class AuthenticationError extends InfrastructureError {
    constructor(message: string, public readonly service?: string) {
        super(message, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends InfrastructureError {
    constructor(message: string, public readonly resource?: string) {
        super(message, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

export class WebSocketError extends InfrastructureError {
    constructor(
        message: string,
        public readonly wsUrl?: string,
        public readonly code?: string
    ) {
        super(message, 'WEBSOCKET_ERROR');
        this.name = 'WebSocketError';
    }
}

export class MessageQueueError extends InfrastructureError {
    constructor(message: string, public readonly queue?: string) {
        super(message, 'MESSAGE_QUEUE_ERROR');
        this.name = 'MessageQueueError';
    }
}

export class HealthCheckError extends InfrastructureError {
    constructor(message: string, public readonly service?: string) {
        super(message, 'HEALTH_CHECK_ERROR');
        this.name = 'HealthCheckError';
    }
}

export class NotificationDeliveryError extends InfrastructureError {
    constructor(
        message: string,
        public readonly channel?: string,
        public readonly recipient?: string
    ) {
        super(message, 'NOTIFICATION_DELIVERY_ERROR');
        this.name = 'NotificationDeliveryError';
    }
}

export class ParseError extends InfrastructureError {
    constructor(message: string, public readonly input?: any) {
        super(message, 'PARSE_ERROR');
        this.name = 'ParseError';
    }
}

export class ValidationError extends InfrastructureError {
    constructor(
        message: string,
        public readonly field?: string,
        public readonly value?: any
    ) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export class ResourceNotFoundError extends InfrastructureError {
    constructor(message: string, public readonly resourceId?: string) {
        super(message, 'RESOURCE_NOT_FOUND');
        this.name = 'ResourceNotFoundError';
    }
}

export class ResourceConflictError extends InfrastructureError {
    constructor(message: string, public readonly resourceId?: string) {
        super(message, 'RESOURCE_CONFLICT');
        this.name = 'ResourceConflictError';
    }
}

export class ServiceUnavailableError extends InfrastructureError {
    constructor(message: string, public readonly service?: string) {
        super(message, 'SERVICE_UNAVAILABLE');
        this.name = 'ServiceUnavailableError';
    }
}

export class CircuitBreakerError extends InfrastructureError {
    constructor(message: string, public readonly service?: string) {
        super(message, 'CIRCUIT_BREAKER_OPEN');
        this.name = 'CircuitBreakerError';
    }
}
