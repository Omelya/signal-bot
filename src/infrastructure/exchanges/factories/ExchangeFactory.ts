import { Exchange } from '../../../domain/entities/Exchange';
import { IExchangeAdapter } from '../adapters/BaseExchangeAdapter';
import { BybitAdapter } from '../adapters/BybitAdapter';
import { BinanceAdapter } from '../adapters/BinanceAdapter';
import {
    DIContainer,
    ILogger,
    ExchangeType,
    IExchangeApiConfig,
    UnsupportedExchangeError,
    ConfigurationError, IExchangeConfig,
} from '../../../shared';

export interface IExchangeFactory {
    createAdapter(exchangeType: ExchangeType, config: IExchangeApiConfig): Promise<IExchangeAdapter>;
    getAdapter(exchangeType: ExchangeType): IExchangeAdapter | undefined;
    getSupportedExchanges(): ExchangeType[];
    isExchangeSupported(exchangeType: ExchangeType): boolean;
    disconnectAll(): Promise<void>,
}

export class ExchangeFactory implements IExchangeFactory {
    private readonly adapters = new Map<ExchangeType, IExchangeAdapter>();
    private readonly logger: ILogger;

    constructor(private readonly container: DIContainer) {
        this.logger = container.get<ILogger>('logger');
    }

    async createAdapter(exchangeType: ExchangeType, config: IExchangeApiConfig): Promise<IExchangeAdapter> {
        this.validateExchangeType(exchangeType);
        this.validateConfig(config);

        // Check if adapter already exists and is connected
        const existingAdapter = this.adapters.get(exchangeType);
        if (existingAdapter && existingAdapter.isConnected()) {
            this.logger.info(`Reusing existing ${exchangeType} adapter`);
            return existingAdapter;
        }

        this.logger.info(`Creating new ${exchangeType} adapter...`);

        try {
            const exchange = this.createExchange(exchangeType, config);
            const adapter = this.createAdapterInstance(exchangeType, exchange, config);

            // Connect to the exchange
            await adapter.connect();

            // Cache the adapter
            this.adapters.set(exchangeType, adapter);

            this.logger.info(`Successfully created and connected ${exchangeType} adapter`);
            return adapter;

        } catch (error) {
            this.logger.error(`Failed to create ${exchangeType} adapter:`, error);
            throw error;
        }
    }

    getSupportedExchanges(): ExchangeType[] {
        return [
            ExchangeType.BYBIT,
            ExchangeType.BINANCE,
            // ExchangeType.OKX, // TODO: Implement OKX adapter
            // ExchangeType.COINBASE // TODO: Implement Coinbase adapter
        ];
    }

    isExchangeSupported(exchangeType: ExchangeType): boolean {
        return this.getSupportedExchanges().includes(exchangeType);
    }

    /**
     * Get existing adapter if available
     */
    getAdapter(exchangeType: ExchangeType): IExchangeAdapter | undefined {
        return this.adapters.get(exchangeType);
    }

    /**
     * Disconnect and remove adapter
     */
    async removeAdapter(exchangeType: ExchangeType): Promise<void> {
        const adapter = this.adapters.get(exchangeType);
        if (adapter) {
            try {
                await adapter.disconnect();
            } catch (error) {
                this.logger.warn(`Error disconnecting ${exchangeType} adapter:`, error);
            }
            this.adapters.delete(exchangeType);
            this.logger.info(`Removed ${exchangeType} adapter`);
        }
    }

    /**
     * Disconnect all adapters
     */
    async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.adapters.keys()).map(exchangeType =>
            this.removeAdapter(exchangeType)
        );

        await Promise.all(disconnectPromises);
        this.logger.info('Disconnected all exchange adapters');
    }

    /**
     * Get all active adapters
     */
    getActiveAdapters(): Map<ExchangeType, IExchangeAdapter> {
        const activeAdapters = new Map<ExchangeType, IExchangeAdapter>();

        for (const [exchangeType, adapter] of this.adapters) {
            if (adapter.isConnected()) {
                activeAdapters.set(exchangeType, adapter);
            }
        }

        return activeAdapters;
    }

    /**
     * Get adapters status
     */
    getAdaptersStatus(): Array<{
        exchange: ExchangeType;
        connected: boolean;
        status: any;
        healthScore?: number;
    }> {
        const status = [];

        for (const [exchangeType, adapter] of this.adapters) {
            status.push({
                exchange: exchangeType,
                connected: adapter.isConnected(),
                status: adapter.getStatus(),
                healthScore: adapter.exchange.getHealthScore()
            });
        }

        return status;
    }

    /**
     * Health check for all adapters
     */
    async healthCheckAll(): Promise<Map<ExchangeType, any>> {
        const healthChecks = new Map<ExchangeType, any>();

        for (const [exchangeType, adapter] of this.adapters) {
            try {
                if (adapter.isConnected()) {
                    // Try to ping the exchange
                    const pingTime = await adapter.ping();
                    healthChecks.set(exchangeType, {
                        status: 'healthy',
                        ping: pingTime,
                        healthScore: adapter.exchange.getHealthScore()
                    });
                } else {
                    healthChecks.set(exchangeType, {
                        status: 'disconnected',
                        ping: null,
                        healthScore: 0
                    });
                }
            } catch (error: any) {
                healthChecks.set(exchangeType, {
                    status: 'unhealthy',
                    error: error.message,
                    ping: null,
                    healthScore: 0
                });
            }
        }

        return healthChecks;
    }

    /**
     * Reconnect unhealthy adapters
     */
    async reconnectUnhealthy(): Promise<void> {
        const reconnectPromises = [];

        for (const [exchangeType, adapter] of this.adapters) {
            if (!adapter.isConnected() || adapter.exchange.getHealthScore() < 50) {
                this.logger.info(`Attempting to reconnect ${exchangeType} adapter`);

                const reconnectPromise = this.reconnectAdapter(exchangeType, adapter);
                reconnectPromises.push(reconnectPromise);
            }
        }

        await Promise.all(reconnectPromises);
    }

    // Private methods

    private createExchange(exchangeType: ExchangeType, config: IExchangeApiConfig): Exchange {
        const exchangeConfig = {
            name: exchangeType,
            apiKey: config.apiKey,
            secretKey: config.secretKey,
            sandbox: config.sandbox,
            enableRateLimit: config.enableRateLimit,
            timeout: config.timeout,
            retryCount: config.retryCount,
            baseUrl: config.baseUrl,
            testnet: config.testnet,
        } as  Omit<IExchangeConfig, "name">;

        switch (exchangeType) {
            case ExchangeType.BYBIT:
                return Exchange.createBybit(exchangeConfig);

            case ExchangeType.BINANCE:
                return Exchange.createBinance(exchangeConfig);

            default:
                throw new UnsupportedExchangeError(`Exchange ${exchangeType} is not supported`);
        }
    }

    private createAdapterInstance(
        exchangeType: ExchangeType,
        exchange: Exchange,
        config: IExchangeApiConfig
    ): IExchangeAdapter {
        switch (exchangeType) {
            case ExchangeType.BYBIT:
                return new BybitAdapter(exchange, config, this.logger);

            case ExchangeType.BINANCE:
                return new BinanceAdapter(exchange, config, this.logger);

            default:
                throw new UnsupportedExchangeError(`Adapter for ${exchangeType} is not implemented`);
        }
    }

    private async reconnectAdapter(exchangeType: ExchangeType, adapter: IExchangeAdapter): Promise<void> {
        try {
            // Disconnect first
            await adapter.disconnect();

            // Wait a bit before reconnecting
            await this.sleep(2000);

            // Reconnect
            await adapter.connect();

            this.logger.info(`Successfully reconnected ${exchangeType} adapter`);
        } catch (error) {
            this.logger.error(`Failed to reconnect ${exchangeType} adapter:`, error);
        }
    }

    private validateExchangeType(exchangeType: ExchangeType): void {
        if (!this.isExchangeSupported(exchangeType)) {
            throw new UnsupportedExchangeError(
                `Exchange ${exchangeType} is not supported. Supported exchanges: ${this.getSupportedExchanges().join(', ')}`
            );
        }
    }

    private validateConfig(config: IExchangeApiConfig): void {
        if (!config.apiKey || config.apiKey.trim().length === 0) {
            throw new ConfigurationError('API key is required');
        }

        if (!config.secretKey || config.secretKey.trim().length === 0) {
            throw new ConfigurationError('Secret key is required');
        }

        if (config.timeout < 1000 || config.timeout > 60000) {
            throw new ConfigurationError('Timeout must be between 1000ms and 60000ms');
        }

        if (config.retryCount < 0 || config.retryCount > 10) {
            throw new ConfigurationError('Retry count must be between 0 and 10');
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
