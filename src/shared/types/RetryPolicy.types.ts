export interface IRetryOptions {
    maxAttempts: number;
    delay: number;
    backoffMultiplier?: number;
    maxDelay?: number;
    retryCondition?: (error: Error) => boolean;
}

export interface IRetryResult<T> {
    result?: T;
    error?: Error;
    attempts: number;
    totalTime: number;
}

export interface IRetryPolicy {
    execute<T>(operation: () => Promise<T>, options: IRetryOptions): Promise<T>;
    executeWithResult<T>(operation: () => Promise<T>, options: IRetryOptions): Promise<IRetryResult<T>>;
}
