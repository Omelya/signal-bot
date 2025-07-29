import { IExchangeRepository } from '../../domain/repositories/IExchangeRepository';
import { IExchangeFactory } from '../../infrastructure/exchanges/factories/ExchangeFactory';
import { Exchange } from '../../domain/entities/Exchange';
import { IEventBus } from '../../shared';
import { ILogger } from '../../shared';
import { ExchangeType } from '../../shared';
import { DomainError } from '../../shared';
import { IExchangeEventPayload } from '../../shared';

export interface IExchangeStatus {
    exchangeType: ExchangeType;
    isConnected: boolean;
    isHealthy: boolean;
    healthScore: number;
    latency: number;
    errorCount: number;
    successCount: number;
    lastPing: number;
    uptime: number;
    rateLimitRemaining: number;
    supportedSymbolsCount: number;
    lastError?: string;
    lastErrorTime?: number;
}

export interface IManageExchangesUseCase {
    initializeAllConfiguredExchanges(): Promise<void>;
    initializeExchange(exchangeType: ExchangeType): Promise<Exchange>;
    disconnectExchange(exchangeType: ExchangeType): Promise<void>;
    disconnectAllExchanges(): Promise<void>;
    reconnectExchange(exchangeType: ExchangeType): Promise<void>;
    getExchangeStatuses(): Promise<IExchangeStatus[]>;
    getConnectedExchanges(): Promise<Exchange[]>;
    healthCheckAllExchanges(): Promise<Map<ExchangeType, boolean>>;
    getExchangeMetrics(exchangeType: ExchangeType): Promise<any>;
}

export class ManageExchangesUseCase implements IManageExchangesUseCase {
    private healthCheckInterval?: NodeJS.Timeout | undefined;
    private readonly healthCheckIntervalMs = 60000; // 1 minute

    constructor(
        private readonly exchangeFactory: IExchangeFactory,
        private readonly exchangeRepository: IExchangeRepository,
        private readonly eventBus: IEventBus,
        private readonly logger: ILogger
    ) {}

    async initializeAllConfiguredExchanges(): Promise<void> {
        this.logger.info('🔗 Initializing all configured exchanges...');

        try {
            const supportedExchanges = this.exchangeFactory.getSupportedExchanges();
            const initPromises = supportedExchanges.map(async (exchangeType) => {
                try {
                    await this.initializeExchange(exchangeType);
                } catch (error: any) {
                    this.logger.warn(`Failed to initialize ${exchangeType}:`, error.message);
                    // Continue with other exchanges even if one fails
                }
            });

            await Promise.all(initPromises);

            const connectedExchanges = await this.getConnectedExchanges();
            if (connectedExchanges.length === 0) {
                throw new DomainError('No exchanges were successfully initialized');
            }

            // Start health monitoring
            this.startHealthMonitoring();

            this.logger.info(`✅ Successfully initialized ${connectedExchanges.length} exchanges`, {
                connected: connectedExchanges.map(e => e.type)
            });

            // Publish initialization complete event
            await this.eventBus.publish({
                type: 'exchanges.initialized',
                source: 'ManageExchangesUseCase',
                version: '1.0',
                payload: {
                    totalExchanges: connectedExchanges.length,
                    exchanges: connectedExchanges.map(e => e.type)
                }
            });

        } catch (error) {
            this.logger.error('❌ Failed to initialize exchanges:', error);
            throw error;
        }
    }

    async initializeExchange(exchangeType: ExchangeType): Promise<Exchange> {
        this.logger.info(`🔌 Initializing ${exchangeType} exchange...`);

        try {
            // Check if exchange is already initialized
            const existingExchange = await this.exchangeRepository.findByType(exchangeType);
            if (existingExchange?.isInitialized) {
                this.logger.info(`${exchangeType} is already initialized`);
                return existingExchange;
            }

            // Create exchange adapter
            const adapter = await this.exchangeFactory.createAdapter(exchangeType, {
                // Configuration would be loaded from config service
                apiKey: process.env[`${exchangeType.toUpperCase()}_API_KEY`] || '',
                secretKey: process.env[`${exchangeType.toUpperCase()}_SECRET`] || '',
                sandbox: process.env[`${exchangeType.toUpperCase()}_SANDBOX`] !== 'false',
                enabled: true,
                timeout: 30000,
                retryCount: 3,
                enableRateLimit: true
            });

            const exchange = adapter.exchange;

            // Test connection
            await adapter.ping();

            // Load market information
            try {
                const markets = await adapter.getMarkets();
                this.logger.info(`Loaded ${markets.length} markets for ${exchangeType}`);
            } catch (error: any) {
                this.logger.warn(`Failed to load markets for ${exchangeType}:`, error.message);
            }

            // Save to repository
            await this.exchangeRepository.save(exchange);

            // Publish exchange connected event
            await this.publishExchangeEvent(exchange, 'connected');

            this.logger.info(`✅ Successfully initialized ${exchangeType}`, {
                healthScore: exchange.getHealthScore(),
                supportedSymbols: exchange.getSupportedSymbols().length
            });

            return exchange;

        } catch (error: any) {
            this.logger.error(`❌ Failed to initialize ${exchangeType}:`, error);

            // Publish exchange connection failed event
            await this.eventBus.publish({
                type: 'exchange.connection.failed',
                source: 'ManageExchangesUseCase',
                version: '1.0',
                payload: {
                    exchange: exchangeType,
                    error: error.message,
                    timestamp: Date.now()
                }
            });

            throw error;
        }
    }

    async disconnectExchange(exchangeType: ExchangeType): Promise<void> {
        this.logger.info(`🔌 Disconnecting ${exchangeType} exchange...`);

        try {
            const exchange = await this.exchangeRepository.findByType(exchangeType);
            if (!exchange) {
                this.logger.warn(`Exchange ${exchangeType} not found`);
                return;
            }

            // Get adapter and disconnect
            const adapter = this.exchangeFactory.getAdapter(exchangeType);
            if (adapter) {
                await adapter.disconnect();
            }

            // Update exchange status
            exchange.updateConnectionStatus(false);
            await this.exchangeRepository.save(exchange);

            // Publish disconnection event
            await this.publishExchangeEvent(exchange, 'disconnected');

            this.logger.info(`✅ Successfully disconnected ${exchangeType}`);

        } catch (error) {
            this.logger.error(`❌ Failed to disconnect ${exchangeType}:`, error);
            throw error;
        }
    }

    async disconnectAllExchanges(): Promise<void> {
        this.logger.info('🔌 Disconnecting all exchanges...');

        try {
            // Stop health monitoring
            this.stopHealthMonitoring();

            const exchanges = await this.exchangeRepository.findAll();
            const disconnectPromises = exchanges.map(exchange =>
                this.disconnectExchange(exchange.type)
            );

            await Promise.all(disconnectPromises);

            // Clean up factory adapters
            await this.exchangeFactory.disconnectAll();

            this.logger.info('✅ All exchanges disconnected successfully');

        } catch (error) {
            this.logger.error('❌ Failed to disconnect all exchanges:', error);
            throw error;
        }
    }

    async reconnectExchange(exchangeType: ExchangeType): Promise<void> {
        this.logger.info(`🔄 Reconnecting ${exchangeType} exchange...`);

        try {
            // Disconnect first
            await this.disconnectExchange(exchangeType);

            // Wait a bit
            await this.sleep(2000);

            // Reconnect
            await this.initializeExchange(exchangeType);

            this.logger.info(`✅ Successfully reconnected ${exchangeType}`);

        } catch (error) {
            this.logger.error(`❌ Failed to reconnect ${exchangeType}:`, error);
            throw error;
        }
    }

    async getExchangeStatuses(): Promise<IExchangeStatus[]> {
        const exchanges = await this.exchangeRepository.findAll();

        return exchanges.map(exchange => ({
            exchangeType: exchange.type,
            isConnected: exchange.status.isConnected,
            isHealthy: exchange.isHealthy(),
            healthScore: exchange.getHealthScore(),
            latency: exchange.status.latency,
            errorCount: exchange.status.errorCount,
            successCount: exchange.status.successCount,
            lastPing: exchange.status.lastPing,
            uptime: exchange.getUptimePercentage(),
            rateLimitRemaining: exchange.status.rateLimitRemaining,
            supportedSymbolsCount: exchange.getSupportedSymbols().length,
            lastError: undefined, // Would be tracked in real implementation
            lastErrorTime: undefined,
        })) as unknown as IExchangeStatus[];
    }

    async getConnectedExchanges(): Promise<Exchange[]> {
        const exchanges = await this.exchangeRepository.findAll();

        return exchanges.filter(exchange =>
            exchange.isInitialized && exchange.status.isConnected
        );
    }

    async healthCheckAllExchanges(): Promise<Map<ExchangeType, boolean>> {
        this.logger.debug('🏥 Performing health check on all exchanges...');

        const healthResults = new Map<ExchangeType, boolean>();
        const exchanges = await this.exchangeRepository.findAll();

        const healthPromises = exchanges.map(async (exchange) => {
            try {
                const adapter = this.exchangeFactory.getAdapter(exchange.type);
                if (!adapter) {
                    healthResults.set(exchange.type, false);
                    return;
                }

                // Perform ping test
                const latency = await adapter.ping();
                const isHealthy = exchange.isHealthy() && latency < 5000; // 5 second threshold

                healthResults.set(exchange.type, isHealthy);

                if (!isHealthy) {
                    this.logger.warn(`Health check failed for ${exchange.type}`, {
                        latency,
                        healthScore: exchange.getHealthScore()
                    });
                }

            } catch (error) {
                this.logger.error(`Health check error for ${exchange.type}:`, error);
                healthResults.set(exchange.type, false);

                // Try to reconnect if health check fails
                try {
                    await this.reconnectExchange(exchange.type);
                } catch (reconnectError) {
                    this.logger.error(`Failed to reconnect ${exchange.type}:`, reconnectError);
                }
            }
        });

        await Promise.all(healthPromises);

        const healthyCount = Array.from(healthResults.values()).filter(Boolean).length;
        this.logger.debug(`Health check complete: ${healthyCount}/${exchanges.length} exchanges healthy`);

        return healthResults;
    }

    async getExchangeMetrics(exchangeType: ExchangeType): Promise<any> {
        const exchange = await this.exchangeRepository.findByType(exchangeType);
        if (!exchange) {
            throw new DomainError(`Exchange not found: ${exchangeType}`);
        }

        return {
            type: exchange.type,
            status: exchange.status,
            healthScore: exchange.getHealthScore(),
            uptimePercentage: exchange.getUptimePercentage(),
            supportedSymbolsCount: exchange.getSupportedSymbols().length,
            capabilities: exchange.capabilities,
            isApproachingRateLimit: exchange.isApproachingRateLimit(),
            recommendedDelay: exchange.getRecommendedDelay(),
            hasStaleMarketData: exchange.hasStaleMarketData(),
            displayName: exchange.getDisplayName(),
            createdAt: exchange.createdAt
        };
    }

    private startHealthMonitoring(): void {
        this.logger.info('🏥 Starting exchange health monitoring...');

        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.healthCheckAllExchanges();
            } catch (error) {
                this.logger.error('Health monitoring error:', error);
            }
        }, this.healthCheckIntervalMs);
    }

    private stopHealthMonitoring(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
            this.logger.info('🏥 Stopped exchange health monitoring');
        }
    }

    private async publishExchangeEvent(exchange: Exchange, action: string): Promise<void> {
        const payload: IExchangeEventPayload = {
            exchange: exchange.type,
            status: action,
            latency: exchange.status.latency,
            timestamp: Date.now()
        };

        if (action === 'disconnected' || action === 'error') {
            payload.errorMessage = 'Exchange connection issue';
        }

        await this.eventBus.publish({
            type: `exchange.${action}`,
            source: 'ManageExchangesUseCase',
            version: '1.0',
            payload,
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
