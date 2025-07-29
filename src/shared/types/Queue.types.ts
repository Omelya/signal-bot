export interface IQueueJob<T = any> {
    id: string;
    data: T;
    priority: number;
    attempts: number;
    maxAttempts: number;
    delay: number;
    timestamp: Date;
    processedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    error?: Error;
}

export interface IQueueOptions {
    concurrency?: number;
    maxAttempts?: number;
    retryDelay?: number;
    removeOnComplete?: number;
    removeOnFail?: number;
}

export interface IQueue<T = any> {
    add(data: T, options?: { priority?: number; delay?: number }): Promise<IQueueJob<T>>;
    process(processor: (job: IQueueJob<T>) => Promise<void>): void;
    pause(): Promise<void>;
    resume(): Promise<void>;
    empty(): Promise<void>;
    getJob(id: string): Promise<IQueueJob<T> | null>;
    getJobs(states: string[]): Promise<IQueueJob<T>[]>;
    getWaiting(): Promise<IQueueJob<T>[]>;
    getActive(): Promise<IQueueJob<T>[]>;
    getCompleted(): Promise<IQueueJob<T>[]>;
    getFailed(): Promise<IQueueJob<T>[]>;
    clean(grace: number, states: string[]): Promise<number>;
}
