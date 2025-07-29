import { IEvent, IPerformanceEventPayload, EventTypes } from '../../shared';
import { ILogger } from '../../shared';
import { BaseEventHandler } from '../services/EventBus';

// Configurable Performance Thresholds
export interface IPerformanceConfig {
    memoryThreshold: number;      // MB
    cpuThreshold: number;         // %
    successRateThreshold: number; // %
    latencyThreshold: number;     // ms
    errorRateThreshold: number;   // %
    signalRateThreshold: {
        min: number;              // signals per hour (minimum)
        max: number;              // signals per hour (maximum)
    };
}

// Default configuration
const DEFAULT_PERFORMANCE_CONFIG: IPerformanceConfig = {
    memoryThreshold: 512,         // 512 MB
    cpuThreshold: 80,            // 80%
    successRateThreshold: 60,    // 60%
    latencyThreshold: 2000,      // 2 seconds
    errorRateThreshold: 5,       // 5%
    signalRateThreshold: {
        min: 1,                  // At least 1 signal per hour
        max: 60                  // Max 60 signals per hour
    }
};

/**
 * Handler for performance monitoring events with configurable thresholds
 */
export class PerformanceMonitoringHandler extends BaseEventHandler<IPerformanceEventPayload> {
    readonly eventType = EventTypes.PERFORMANCE_METRICS;

    private config: IPerformanceConfig;

    constructor(
        private readonly logger: ILogger,
        config?: Partial<IPerformanceConfig>
    ) {
        super();
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };

        this.logger.info('PerformanceMonitoringHandler initialized with thresholds:', this.config);
    }

    canHandle(event: IEvent<any>): boolean {
        return [
            EventTypes.PERFORMANCE_METRICS,
            EventTypes.BOT_METRICS,
            'exchange.metrics'
        ].includes(event.type);
    }

    async handle(event: IEvent<IPerformanceEventPayload>): Promise<void> {
        try {
            const { botId, metrics, timestamp } = event.payload;

            this.logger.debug('Performance metrics collected', {
                eventId: event.id,
                botId,
                metrics,
                timestamp,
                correlationId: event.correlationId
            });

            // Analyze metrics against thresholds
            const alerts = await this.analyzeMetrics(metrics, event);

            // Log alerts if any
            if (alerts.length > 0) {
                for (const alert of alerts) {
                    this.logger.warn(alert.message, {
                        eventId: event.id,
                        botId,
                        metric: alert.metric,
                        value: alert.value,
                        threshold: alert.threshold,
                        severity: alert.severity
                    });
                }
            }

            // Store metrics for trending (if needed)
            await this.storeMetricsForTrending(metrics, event);

            // Generate performance reports if needed
            await this.generatePerformanceReports(metrics, alerts, event);

        } catch (error: any) {
            this.logger.error('Error handling performance monitoring event:', {
                eventId: event.id,
                error: error.message,
                correlationId: event.correlationId
            });
        }
    }

    private async analyzeMetrics(
        metrics: IPerformanceEventPayload['metrics'],
        event: IEvent<IPerformanceEventPayload>
    ): Promise<IPerformanceAlert[]> {
        const alerts: IPerformanceAlert[] = [];

        // Memory usage check
        if (metrics.memoryUsage > this.config.memoryThreshold) {
            alerts.push({
                metric: 'memoryUsage',
                value: metrics.memoryUsage,
                threshold: this.config.memoryThreshold,
                message: `High memory usage detected: ${metrics.memoryUsage}MB (threshold: ${this.config.memoryThreshold}MB)`,
                severity: this.getSeverity(metrics.memoryUsage, this.config.memoryThreshold, 'memory')
            });
        }

        // CPU usage check
        if (metrics.cpuUsage > this.config.cpuThreshold) {
            alerts.push({
                metric: 'cpuUsage',
                value: metrics.cpuUsage,
                threshold: this.config.cpuThreshold,
                message: `High CPU usage detected: ${metrics.cpuUsage}% (threshold: ${this.config.cpuThreshold}%)`,
                severity: this.getSeverity(metrics.cpuUsage, this.config.cpuThreshold, 'cpu')
            });
        }

        // Success rate check
        if (metrics.successRate < this.config.successRateThreshold) {
            alerts.push({
                metric: 'successRate',
                value: metrics.successRate,
                threshold: this.config.successRateThreshold,
                message: `Low success rate detected: ${metrics.successRate}% (threshold: ${this.config.successRateThreshold}%)`,
                severity: this.getSeverity(this.config.successRateThreshold, metrics.successRate, 'rate')
            });
        }

        // Latency check
        if (metrics.averageLatency > this.config.latencyThreshold) {
            alerts.push({
                metric: 'averageLatency',
                value: metrics.averageLatency,
                threshold: this.config.latencyThreshold,
                message: `High latency detected: ${metrics.averageLatency}ms (threshold: ${this.config.latencyThreshold}ms)`,
                severity: this.getSeverity(metrics.averageLatency, this.config.latencyThreshold, 'latency')
            });
        }

        // Signal rate checks
        if (metrics.signalsPerHour < this.config.signalRateThreshold.min) {
            alerts.push({
                metric: 'signalsPerHour',
                value: metrics.signalsPerHour,
                threshold: this.config.signalRateThreshold.min,
                message: `Low signal generation rate: ${metrics.signalsPerHour}/hour (minimum: ${this.config.signalRateThreshold.min}/hour)`,
                severity: 'warning'
            });
        }

        if (metrics.signalsPerHour > this.config.signalRateThreshold.max) {
            alerts.push({
                metric: 'signalsPerHour',
                value: metrics.signalsPerHour,
                threshold: this.config.signalRateThreshold.max,
                message: `High signal generation rate: ${metrics.signalsPerHour}/hour (maximum: ${this.config.signalRateThreshold.max}/hour)`,
                severity: 'warning'
            });
        }

        // Error rate calculation and check
        const totalOperations = metrics.signalsPerHour + metrics.errorCount;
        if (totalOperations > 0) {
            const errorRate = (metrics.errorCount / totalOperations) * 100;
            if (errorRate > this.config.errorRateThreshold) {
                alerts.push({
                    metric: 'errorRate',
                    value: errorRate,
                    threshold: this.config.errorRateThreshold,
                    message: `High error rate detected: ${errorRate.toFixed(2)}% (threshold: ${this.config.errorRateThreshold}%)`,
                    severity: this.getSeverity(errorRate, this.config.errorRateThreshold, 'rate')
                });
            }
        }

        return alerts;
    }

    private getSeverity(value: number, threshold: number, type: 'memory' | 'cpu' | 'rate' | 'latency'): 'warning' | 'critical' {
        let criticalMultiplier: number;

        switch (type) {
            case 'memory':
            case 'cpu':
                criticalMultiplier = 1.5; // 50% over threshold is critical
                break;
            case 'latency':
                criticalMultiplier = 2.0; // 100% over threshold is critical
                break;
            case 'rate':
                criticalMultiplier = 2.0; // For rates, 2x threshold is critical
                break;
            default:
                criticalMultiplier = 1.5;
        }

        if (type === 'rate' && value < threshold) {
            // For success rate, check how far below threshold
            const ratio = threshold / value;
            return ratio > criticalMultiplier ? 'critical' : 'warning';
        } else {
            // For other metrics, check how far above threshold
            const ratio = value / threshold;
            return ratio > criticalMultiplier ? 'critical' : 'warning';
        }
    }

    private async storeMetricsForTrending(
        metrics: IPerformanceEventPayload['metrics'],
        event: IEvent<IPerformanceEventPayload>
    ): Promise<void> {
        try {
            // In a real implementation, this would store metrics in a time-series database
            // For now, we'll just log the metrics for trending analysis
            this.logger.debug('Storing metrics for trending analysis', {
                eventId: event.id,
                timestamp: event.timestamp,
                metrics: {
                    memoryUsage: metrics.memoryUsage,
                    cpuUsage: metrics.cpuUsage,
                    signalsPerHour: metrics.signalsPerHour,
                    successRate: metrics.successRate,
                    averageLatency: metrics.averageLatency,
                    errorCount: metrics.errorCount
                }
            });

            // TODO: Implement actual time-series storage
            // await this.metricsStore.store(event.timestamp, metrics);

        } catch (error) {
            this.logger.error('Failed to store metrics for trending:', error);
            // Don't throw - trending failure shouldn't break performance monitoring
        }
    }

    private async generatePerformanceReports(
        metrics: IPerformanceEventPayload['metrics'],
        alerts: IPerformanceAlert[],
        event: IEvent<IPerformanceEventPayload>
    ): Promise<void> {
        try {
            // Generate performance reports based on alerts and metrics
            if (alerts.length > 0) {
                const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
                const warningAlerts = alerts.filter(alert => alert.severity === 'warning');

                if (criticalAlerts.length > 0) {
                    this.logger.error('CRITICAL performance issues detected', {
                        eventId: event.id,
                        botId: event.payload.botId,
                        criticalAlerts: criticalAlerts.map(alert => ({
                            metric: alert.metric,
                            value: alert.value,
                            threshold: alert.threshold
                        }))
                    });

                    // TODO: Trigger emergency notifications
                    // await this.notificationService.sendCriticalAlert(...);
                }

                if (warningAlerts.length > 0) {
                    this.logger.warn('Performance warnings detected', {
                        eventId: event.id,
                        botId: event.payload.botId,
                        warningAlerts: warningAlerts.map(alert => ({
                            metric: alert.metric,
                            value: alert.value,
                            threshold: alert.threshold
                        }))
                    });
                }
            }

            // Generate periodic performance summary
            const performanceSummary = {
                timestamp: new Date().toISOString(),
                botId: event.payload.botId,
                overallHealth: this.calculateOverallHealth(metrics, alerts),
                metrics,
                alertCount: alerts.length,
                criticalAlertCount: alerts.filter(a => a.severity === 'critical').length
            };

            this.logger.info('Performance summary generated', performanceSummary);

        } catch (error) {
            this.logger.error('Failed to generate performance reports:', error);
            // Don't throw - report generation failure shouldn't break monitoring
        }
    }

    private calculateOverallHealth(
        metrics: IPerformanceEventPayload['metrics'],
        alerts: IPerformanceAlert[]
    ): 'healthy' | 'degraded' | 'critical' {
        const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
        const warningAlerts = alerts.filter(alert => alert.severity === 'warning');

        if (criticalAlerts.length > 0) {
            return 'critical';
        } else if (warningAlerts.length > 2) {
            return 'degraded';
        } else if (warningAlerts.length > 0) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    // Configuration management methods
    updateConfig(newConfig: Partial<IPerformanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Performance monitoring configuration updated', this.config);
    }

    getConfig(): IPerformanceConfig {
        return { ...this.config };
    }

    resetToDefaults(): void {
        this.config = { ...DEFAULT_PERFORMANCE_CONFIG };
        this.logger.info('Performance monitoring configuration reset to defaults');
    }
}

interface IPerformanceAlert {
    metric: string;
    value: number;
    threshold: number;
    message: string;
    severity: 'warning' | 'critical';
}
