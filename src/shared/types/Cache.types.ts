export interface ICacheOptions {
    ttl?: number; // Time to live in milliseconds
    maxSize?: number;
    refreshThreshold?: number;
}

export interface ICache<T = any> {
    get(key: string): Promise<T | null>;
    set(key: string, value: T, options?: ICacheOptions): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
    size(): Promise<number>;
}
