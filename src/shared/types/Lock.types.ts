export interface ILockOptions {
    timeout?: number;
    retryInterval?: number;
    maxRetries?: number;
}

export interface ILock {
    acquire(key: string, options?: ILockOptions): Promise<boolean>;
    release(key: string): Promise<boolean>;
    isLocked(key: string): Promise<boolean>;
    extend(key: string, ttl: number): Promise<boolean>;
    forceRelease(key: string): Promise<boolean>;
}
