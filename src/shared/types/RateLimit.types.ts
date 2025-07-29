export interface IRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}

export interface IRateLimiter {
    isAllowed(key: string): Promise<IRateLimitResult>;
    reset(key: string): Promise<void>;
    getStatus(key: string): Promise<{
        remaining: number;
        resetTime: number;
        totalRequests: number;
    }>;
}
