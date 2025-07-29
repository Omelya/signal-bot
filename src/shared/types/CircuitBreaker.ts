export interface ICircuitBreakerOptions {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    minimumRequestThreshold: number;
    monitoringPeriod: number;
}

export interface ICircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    successes: number;
    requests: number;
    nextAttempt: number;
}

export interface ICircuitBreaker {
    execute<T>(operation: () => Promise<T>): Promise<T>;
    getState(): ICircuitBreakerState;
    reset(): void;
}
