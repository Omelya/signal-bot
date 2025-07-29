export interface IHealthStatus {
    readonly isHealthy: boolean;
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly checks: IHealthCheckResult[];
    readonly timestamp: number;
    readonly uptime: number;
}

export interface IHealthCheckResult {
    readonly name: string;
    readonly status: 'pass' | 'fail' | 'warn';
    readonly message?: string;
    readonly duration?: number;
    readonly data?: any;
}

export interface IHealthCheck {
    name: string;
    check(): Promise<IHealthCheckResult>;
}
