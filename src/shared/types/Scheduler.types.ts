export interface IScheduledTask {
    id: string;
    name: string;
    schedule: string; // Cron expression
    enabled: boolean;
    lastRun?: Date;
    nextRun: Date;
    runCount: number;
    errorCount: number;
}

export interface ITaskResult {
    success: boolean;
    duration: number;
    error?: Error;
    output?: any;
}

export interface IScheduler {
    schedule(name: string, schedule: string, task: () => Promise<void>): string;
    unschedule(taskId: string): boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    getTasks(): IScheduledTask[];
    getTask(taskId: string): IScheduledTask | undefined;
    isRunning(): boolean;
}
