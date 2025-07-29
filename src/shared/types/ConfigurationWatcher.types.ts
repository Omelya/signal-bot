export interface IConfigurationChange {
    key: string;
    oldValue: any;
    newValue: any;
    timestamp: Date;
}

export interface IConfigurationWatcher {
    watch(key: string, callback: (change: IConfigurationChange) => void): void;
    unwatch(key: string, callback: (change: IConfigurationChange) => void): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    isWatching(): boolean;
}
