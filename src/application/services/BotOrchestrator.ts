import { IMonitorMarketUseCase } from '../usecases/MonitorMarketUseCase';
import { IManageExchangesUseCase } from '../usecases/ManageExchangesUseCase';
import { IConfigureBotUseCase } from '../usecases/ConfigureBotUseCase';
import {
    IEventBus,
    IBotEventPayload,
    IPerformanceEventPayload,
    EventTypes,
    IEvent,
    DIContainer
} from '../../shared';
import { ILogger } from '../../shared';
import { DomainError } from '../../shared';
import {MarketDataHandler} from "../handlers/MarketHandler";
import {ExchangeConnectionHandler} from "../handlers/ExchangeConnectionHandler";
import {SignalHandler} from "../handlers/SignalHandler";

export interface IBotStatus {
    id: string;
    status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';
    startTime?: Date;
    uptime: number;
    activeExchanges: string[];
    activePairs: string[];
    totalSignalsGenerated: number;
    todaySignalsGenerated: number;
    errorCount: number;
    lastErrorTime?: Date;
    healthScore: number;
    version: string;
}

export interface IBotMetrics {
    signalsPerHour: number;
    averageSignalConfidence: number;
    successRate: number;
    exchangeLatencies: Record<string, number>;
    memoryUsage: number;
    cpuUsage: number;
}

export interface IBotOrchestrator {
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    getStatus(): Promise<IBotStatus>;
    getMetrics(): Promise<IBotMetrics>;
    isRunning(): boolean;
    healthCheck(): Promise<boolean>;
}

export class BotOrchestrator implements IBotOrchestrator {
    private botId: string;
    private status: IBotStatus['status'] = 'STOPPED';
    private startTime?: Date | undefined;
    private errorCount: number = 0;
    private lastErrorTime?: Date | undefined;
    private healthCheckInterval?: NodeJS.Timeout | undefined;
    private metricsInterval?: NodeJS.Timeout | undefined;
    private signalMetrics: Array<{ timestamp: number; confidence: number; success: boolean }> = [];

    constructor(
        private readonly monitorMarketUseCase: IMonitorMarketUseCase,
        private readonly manageExchangesUseCase: IManageExchangesUseCase,
        private readonly configureBotUseCase: IConfigureBotUseCase,
        private readonly eventBus: IEventBus,
        private readonly logger: ILogger
    ) {
        this.botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.setupEventHandlers();
    }

    async start(): Promise<void> {
        if (this.status === 'RUNNING') {
            throw new DomainError('Bot is already running');
        }

        if (this.status === 'STARTING') {
            throw new DomainError('Bot is already starting');
        }

        this.logger.info('🚀 Starting Universal Signal Bot v2.0...');
        this.status = 'STARTING';

        try {
            // Publish starting event
            await this.publishBotEvent('starting');

            // 1. Initialize and connect to exchanges
            this.logger.info('🔗 Initializing exchanges...');
            await this.manageExchangesUseCase.initializeAllConfiguredExchanges();

            // 2. Validate bot configuration
            this.logger.info('⚙️ Validating bot configuration...');
            await this.configureBotUseCase.validateConfiguration();

            // 3. Load and validate trading pairs
            this.logger.info('📊 Loading trading pairs...');
            await this.configureBotUseCase.loadTradingPairs();

            // 4. Start market monitoring
            this.logger.info('📈 Starting market monitoring...');
            await this.monitorMarketUseCase.startMonitoring();

            // 5. Start health check and metrics collection
            this.startHealthCheck();
            this.startMetricsCollection();

            this.status = 'RUNNING';
            this.startTime = new Date();

            // Reset daily counters if needed
            this.resetDailyCountersIfNeeded();

            // Publish started event
            await this.publishBotEvent('started');

            this.logger.info('✅ Universal Signal Bot v2.0 started successfully!');
            this.logger.info(`🤖 Bot ID: ${this.botId}`);
            this.logger.info(`⏰ Start time: ${this.startTime.toISOString()}`);

        } catch (error: any) {
            this.status = 'ERROR';
            this.errorCount++;
            this.lastErrorTime = new Date();

            this.logger.error('❌ Failed to start bot:', error);
            await this.publishBotEvent('error', error.message);

            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.status === 'STOPPED') {
            this.logger.warn('Bot is already stopped');
            return;
        }

        if (this.status === 'STOPPING') {
            throw new DomainError('Bot is already stopping');
        }

        this.logger.info('🛑 Stopping Universal Signal Bot v2.0...');
        this.status = 'STOPPING';

        try {
            // Publish stopping event
            await this.publishBotEvent('stopping');

            // 1. Stop market monitoring
            this.logger.info('📊 Stopping market monitoring...');
            await this.monitorMarketUseCase.stopMonitoring();

            // 2. Disconnect from exchanges
            this.logger.info('🔌 Disconnecting exchanges...');
            await this.manageExchangesUseCase.disconnectAllExchanges();

            // 3. Stop health check and metrics
            this.stopHealthCheck();
            this.stopMetricsCollection();

            this.status = 'STOPPED';
            this.startTime = undefined;

            // Publish stopped event
            await this.publishBotEvent('stopped');

            this.logger.info('✅ Universal Signal Bot v2.0 stopped successfully');

        } catch (error: any) {
            this.status = 'ERROR';
            this.errorCount++;
            this.lastErrorTime = new Date();

            this.logger.error('❌ Error stopping bot:', error);
            await this.publishBotEvent('error', error.message);

            throw error;
        }
    }

    async restart(): Promise<void> {
        this.logger.info('🔄 Restarting Universal Signal Bot v2.0...');

        try {
            await this.stop();
            // Wait a bit before restarting
            await this.sleep(2000);
            await this.start();

            this.logger.info('✅ Bot restarted successfully');
        } catch (error) {
            this.logger.error('❌ Failed to restart bot:', error);
            throw error;
        }
    }

    async getStatus(): Promise<IBotStatus> {
        const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
        const healthScore = await this.calculateHealthScore();

        const monitoringStatus = await this.monitorMarketUseCase.getMonitoringStatus();
        const exchangeStatuses = await this.manageExchangesUseCase.getExchangeStatuses();

        return {
            id: this.botId,
            status: this.status,
            startTime: this.startTime,
            uptime,
            activeExchanges: exchangeStatuses
                .filter(e => e.isConnected)
                .map(e => e.exchangeType),
            activePairs: monitoringStatus.activePairs,
            totalSignalsGenerated: monitoringStatus.totalSignals,
            todaySignalsGenerated: monitoringStatus.signalsGeneratedToday,
            errorCount: this.errorCount,
            lastErrorTime: this.lastErrorTime,
            healthScore,
            version: '2.0.0'
        } as IBotStatus;
    }

    async getMetrics(): Promise<IBotMetrics> {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        // Calculate signals per hour
        const recentSignals = this.signalMetrics.filter(s => now - s.timestamp < oneHour);
        const signalsPerHour = recentSignals.length;

        // Calculate average confidence
        const averageSignalConfidence = recentSignals.length > 0
            ? recentSignals.reduce((sum, s) => sum + s.confidence, 0) / recentSignals.length
            : 0;

        // Calculate success rate
        const successfulSignals = recentSignals.filter(s => s.success).length;
        const successRate = recentSignals.length > 0
            ? (successfulSignals / recentSignals.length) * 100
            : 0;

        // Get exchange latencies
        const exchangeStatuses = await this.manageExchangesUseCase.getExchangeStatuses();
        const exchangeLatencies: Record<string, number> = {};
        for (const status of exchangeStatuses) {
            exchangeLatencies[status.exchangeType] = status.latency || 0;
        }

        // Get system metrics
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        const cpuUsage = process.cpuUsage().user / 1000; // Convert to milliseconds

        return {
            signalsPerHour,
            averageSignalConfidence: Math.round(averageSignalConfidence * 100) / 100,
            successRate: Math.round(successRate * 100) / 100,
            exchangeLatencies,
            memoryUsage: Math.round(memoryUsage * 100) / 100,
            cpuUsage
        };
    }

    isRunning(): boolean {
        return this.status === 'RUNNING';
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (this.status !== 'RUNNING') {
                return false;
            }

            // Check if market monitoring is active
            if (!this.monitorMarketUseCase.isMonitoring()) {
                this.logger.warn('Health check failed: Market monitoring is not active');
                return false;
            }

            // Check exchange connections
            const exchangeStatuses = await this.manageExchangesUseCase.getExchangeStatuses();
            const healthyExchanges = exchangeStatuses.filter(e => e.isConnected && e.healthScore > 70);

            if (healthyExchanges.length === 0) {
                this.logger.warn('Health check failed: No healthy exchanges');
                return false;
            }

            // Check error rate
            const recentErrors = this.errorCount; // Simplified - in real implementation, track recent errors
            const errorRate = recentErrors / 100; // Simplified calculation

            if (errorRate > 0.1) { // 10% error rate threshold
                this.logger.warn(`Health check failed: High error rate ${errorRate * 100}%`);
                return false;
            }

            return true;

        } catch (error) {
            this.logger.error('Health check failed with error:', error);
            return false;
        }
    }

    private setupEventHandlers(): void {
        const monitoringErrorHandler = {
            eventType: EventTypes.MONITORING_ERROR,
            handle: async (event: IEvent<any>) => {
                this.errorCount++;
                this.lastErrorTime = new Date();

                this.logger.warn('Monitoring error occurred', {
                    error: event.payload.error,
                    totalErrors: this.errorCount
                });
            }
        };

        const marketDataHandler = DIContainer.getInstance().get<MarketDataHandler>('marketDataHandler');
        const exchangeHandler = DIContainer.getInstance().get<ExchangeConnectionHandler>('exchangeConnectionHandler');
        const signalGeneratedHandler = DIContainer.getInstance().get<SignalHandler>('signalHandler');

        this.eventBus.subscribe(EventTypes.SIGNAL_GENERATED, signalGeneratedHandler);
        this.eventBus.subscribe(EventTypes.MONITORING_ERROR, monitoringErrorHandler);
        this.eventBus.subscribe(EventTypes.EXCHANGE_CONNECTED, exchangeHandler);
        this.eventBus.subscribe(EventTypes.EXCHANGE_DISCONNECTED, exchangeHandler);
        this.eventBus.subscribe(EventTypes.MARKET_DATA_UPDATED, marketDataHandler);
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const isHealthy = await this.healthCheck();

                if (!isHealthy && this.status === 'RUNNING') {
                    this.logger.error('❌ Health check failed - bot may need attention');
                    await this.publishBotEvent('unhealthy');
                } else if (isHealthy && this.status === 'RUNNING') {
                    await this.publishBotEvent('healthy');
                }
            } catch (error) {
                this.logger.error('Error during health check:', error);
            }
        }, 60000); // Check every minute
    }

    private stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }

    private startMetricsCollection(): void {
        this.metricsInterval = setInterval(async () => {
            try {
                const metrics = await this.getMetrics();

                // Publish bot metrics event
                await this.eventBus.publish({
                    type: EventTypes.BOT_METRICS,
                    source: 'BotOrchestrator',
                    version: '1.0',
                    payload: {
                        botId: this.botId,
                        metrics: {
                            memoryUsage: metrics.memoryUsage,
                            cpuUsage: metrics.cpuUsage,
                            signalsPerHour: metrics.signalsPerHour,
                            successRate: metrics.successRate,
                            averageLatency: Object.values(metrics.exchangeLatencies).reduce((sum, lat) => sum + lat, 0) / Object.keys(metrics.exchangeLatencies).length || 0,
                            errorCount: this.errorCount
                        },
                        timestamp: Date.now()
                    } as IPerformanceEventPayload
                });

            } catch (error) {
                this.logger.error('Error collecting metrics:', error);
            }
        }, 300000); // Collect every 5 minutes
    }

    private stopMetricsCollection(): void {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = undefined;
        }
    }

    private async calculateHealthScore(): Promise<number> {
        try {
            let score = 100;

            const monitoringStatus = await this.monitorMarketUseCase.getMonitoringStatus();

            // Deduct for errors
            const errorRate = this.errorCount / Math.max(monitoringStatus.totalSignals, 1);
            score -= errorRate * 50;

            // Deduct if not running
            if (this.status !== 'RUNNING') {
                score -= 50;
            }

            // Check exchanges health
            const exchangeStatuses = await this.manageExchangesUseCase.getExchangeStatuses();
            const avgExchangeHealth = exchangeStatuses.length > 0
                ? exchangeStatuses.reduce((sum, e) => sum + e.healthScore, 0) / exchangeStatuses.length
                : 0;

            // Incorporate exchange health (30% weight)
            score = score * 0.7 + avgExchangeHealth * 0.3;

            return Math.max(0, Math.min(100, Math.round(score)));

        } catch (error) {
            this.logger.error('Error calculating health score:', error);
            return 0;
        }
    }

    private resetDailyCountersIfNeeded(): void {
        const now = new Date();
        const today = now.toDateString();
        const lastResetDate = this.getLastResetDate();

        if (lastResetDate !== today) {
            this.setLastResetDate(today);
            this.logger.info('Daily counters reset');
        }
    }

    private getLastResetDate(): string {
        // In real implementation, this would be persisted
        return new Date().toDateString();
    }

    private setLastResetDate(date: string): void {
        // In real implementation, this would be persisted
    }

    private async publishBotEvent(action: string, error?: string): Promise<void> {
        const payload: IBotEventPayload = {
            botId: this.botId,
            status: this.status,
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
            activeExchanges: [], // Will be filled by actual data
            activePairs: [], // Will be filled by actual data
            timestamp: Date.now()
        };

        if (error) {
            (payload as any).error = error;
        }

        const eventType = `bot.${action}` as keyof typeof EventTypes;

        await this.eventBus.publish({
            type: EventTypes[eventType.toUpperCase().replace('.', '_') as keyof typeof EventTypes] || eventType,
            source: 'BotOrchestrator',
            version: '1.0',
            payload
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
