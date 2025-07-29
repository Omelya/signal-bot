export interface IMetricLabels {
    [key: string]: string | number;
}

export interface ICounter {
    inc(value?: number, labels?: IMetricLabels): void;
    get(labels?: IMetricLabels): number;
}

export interface IGauge {
    set(value: number, labels?: IMetricLabels): void;
    inc(value?: number, labels?: IMetricLabels): void;
    dec(value?: number, labels?: IMetricLabels): void;
    get(labels?: IMetricLabels): number;
}

export interface IHistogram {
    observe(value: number, labels?: IMetricLabels): void;
    get(labels?: IMetricLabels): {
        count: number;
        sum: number;
        buckets: { [bucket: string]: number };
    };
}

export interface IMetrics {
    createCounter(name: string, help: string, labelNames?: string[]): ICounter;
    createGauge(name: string, help: string, labelNames?: string[]): IGauge;
    createHistogram(name: string, help: string, buckets?: number[], labelNames?: string[]): IHistogram;
    register(): string; // Returns metrics in Prometheus format
    clear(): void;
}
