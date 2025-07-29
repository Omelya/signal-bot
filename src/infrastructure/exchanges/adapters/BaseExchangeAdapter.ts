import { Exchange } from '../../../domain/entities/Exchange';
import {
    NetworkError,
    ExternalApiError,
    RateLimitError,
    AuthenticationError,
    ExchangeApiError,
    TimeFrame,
    IExchangeApiConfig,
    ICandle,
    ITicker,
    IAccountBalance,
    IMarketInfo,
    ILogger,
} from '../../../shared';

export interface IExchangeAdapter {
    readonly exchange: Exchange;

    // Connection management
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    ping(): Promise<number>;

    // Market data
    getCandles(symbol: string, timeframe: TimeFrame, limit?: number): Promise<ICandle[]>;
    getTicker(symbol: string): Promise<ITicker>;
    getMarkets(): Promise<IMarketInfo[]>;

    // Account
    getBalance(): Promise<IAccountBalance>;

    // Health check
    isConnected(): boolean;
    getStatus(): any;
}

export abstract class BaseExchangeAdapter implements IExchangeAdapter {
    protected _isConnected: boolean = false;
    protected _lastPing: number = 0;
    protected _apiClient: any;
    protected _rateLimitRemaining: number = 1000;
    protected _nextResetTime: number = Date.now() + 60000;

    protected constructor(
        public readonly exchange: Exchange,
        protected readonly config: IExchangeApiConfig,
        protected readonly logger: ILogger
    ) {}

    // Abstract methods that must be implemented by concrete adapters
    protected abstract createApiClient(): any;
    protected abstract handleApiError(error: any): Error;
    protected abstract transformCandles(data: any[]): ICandle[];
    protected abstract transformTicker(data: any): ITicker;
    protected abstract transformMarkets(data: any[]): IMarketInfo[];
    protected abstract transformBalance(data: any): IAccountBalance;

    async connect(): Promise<void> {
        try {
            this.logger.info(`Connecting to ${this.exchange.type}...`);

            this._apiClient = this.createApiClient();

            // Test connection with a simple API call
            await this.ping();

            this._isConnected = true;
            this.exchange.markAsInitialized();
            this.exchange.updateConnectionStatus(true);

            this.logger.info(`Successfully connected to ${this.exchange.type}`);
        } catch (error) {
            this._isConnected = false;
            this.exchange.updateConnectionStatus(false);
            this.exchange.recordError();

            const processedError = this.handleApiError(error);
            this.logger.error(`Failed to connect to ${this.exchange.type}:`, processedError);
            throw processedError;
        }
    }

    async disconnect(): Promise<void> {
        try {
            this.logger.info(`Disconnecting from ${this.exchange.type}...`);

            if (this._apiClient) {
                // Close any websocket connections if they exist
                if (this._apiClient.close) {
                    await this._apiClient.close();
                }
            }

            this._isConnected = false;
            this.exchange.updateConnectionStatus(false);

            this.logger.info(`Disconnected from ${this.exchange.type}`);
        } catch (error) {
            this.logger.error(`Error disconnecting from ${this.exchange.type}:`, error);
            throw this.handleApiError(error);
        }
    }

    async ping(): Promise<number> {
        const startTime = Date.now();

        try {
            await this.makeApiCall('ping', {});

            const latency = Date.now() - startTime;
            this._lastPing = Date.now();

            this.exchange.updateConnectionStatus(true, latency);
            this.exchange.recordSuccess();

            return latency;
        } catch (error) {
            this.exchange.updateConnectionStatus(false);
            this.exchange.recordError();
            throw this.handleApiError(error);
        }
    }

    async getCandles(symbol: string, timeframe: TimeFrame, limit: number = 100): Promise<ICandle[]> {
        try {
            this.validateConnection();
            this.checkRateLimit();

            const params = {
                symbol: this.normalizeSymbol(symbol),
                interval: this.normalizeTimeframe(timeframe),
                limit: Math.min(limit, this.exchange.capabilities.maxCandleHistory)
            };

            const response = await this.makeApiCall('candles', params);
            const candles = this.transformCandles(response);

            this.exchange.recordSuccess();
            return candles;

        } catch (error) {
            this.exchange.recordError();
            throw this.handleApiError(error);
        }
    }

    async getTicker(symbol: string): Promise<ITicker> {
        try {
            this.validateConnection();
            this.checkRateLimit();

            const params = { symbol: this.normalizeSymbol(symbol) };
            const response = await this.makeApiCall('ticker', params);
            const ticker = this.transformTicker(response);

            this.exchange.recordSuccess();
            return ticker;

        } catch (error) {
            this.exchange.recordError();
            throw this.handleApiError(error);
        }
    }

    async getMarkets(): Promise<IMarketInfo[]> {
        try {
            this.validateConnection();
            this.checkRateLimit();

            const response = await this.makeApiCall('markets', {});
            const markets = this.transformMarkets(response);

            // Update exchange markets
            markets.forEach(market => {
                this.exchange.updateMarket(market.symbol, market);
            });

            this.exchange.recordSuccess();
            return markets;

        } catch (error) {
            this.exchange.recordError();
            throw this.handleApiError(error);
        }
    }

    async getBalance(): Promise<IAccountBalance> {
        try {
            this.validateConnection();
            this.checkRateLimit();

            const response = await this.makeApiCall('balance', {});
            const balance = this.transformBalance(response);

            this.exchange.recordSuccess();
            return balance;

        } catch (error) {
            this.exchange.recordError();
            throw this.handleApiError(error);
        }
    }

    isConnected(): boolean {
        return this._isConnected && this.exchange.isInitialized;
    }

    getStatus(): any {
        return {
            exchange: this.exchange.type,
            connected: this.isConnected(),
            lastPing: this._lastPing,
            rateLimitRemaining: this._rateLimitRemaining,
            nextResetTime: this._nextResetTime,
            healthScore: this.exchange.getHealthScore(),
            uptime: this.exchange.getUptimePercentage()
        };
    }

    // Protected helper methods
    protected async makeApiCall(endpoint: string, params: any): Promise<any> {
        if (!this._apiClient) {
            throw new ExchangeApiError('API client not initialized');
        }

        const delay = this.exchange.getRecommendedDelay();
        if (delay > 100) {
            await this.sleep(delay);
        }

        try {
            // This should be implemented by concrete adapters
            return await this.executeApiCall(endpoint, params);
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    protected abstract executeApiCall(endpoint: string, params: any): Promise<any>;

    protected validateConnection(): void {
        if (!this.isConnected()) {
            throw new ExchangeApiError(`Not connected to ${this.exchange.type}`);
        }
    }

    protected checkRateLimit(): void {
        if (this.exchange.isApproachingRateLimit(0.1)) {
            this.logger.warn(`Approaching rate limit for ${this.exchange.type}`);

            if (this._rateLimitRemaining <= 10) {
                const waitTime = this._nextResetTime - Date.now();
                throw new RateLimitError(
                    `Rate limit exceeded for ${this.exchange.type}`,
                    waitTime,
                    this.exchange.capabilities.rateLimits.maxWeight
                );
            }
        }
    }

    protected updateRateLimit(remaining: number, resetTime: number): void {
        this._rateLimitRemaining = remaining;
        this._nextResetTime = resetTime;
        this.exchange.updateRateLimit(remaining, resetTime);
    }

    protected normalizeSymbol(symbol: string): string {
        // Default implementation - override in concrete adapters
        return symbol.replace('/', '');
    }

    protected normalizeTimeframe(timeframe: TimeFrame): string {
        // Default implementation - override in concrete adapters
        return timeframe;
    }

    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    protected createErrorFromResponse(response: any, defaultMessage: string): Error {
        const message = response?.msg || response?.message || response?.error || defaultMessage;
        const code = response?.code || response?.error_code;

        if (code === 'RATE_LIMIT' || message.includes('rate limit') || message.includes('too many requests')) {
            return new RateLimitError(message);
        }

        if (code === 'UNAUTHORIZED' || message.includes('unauthorized') || message.includes('invalid api key')) {
            return new AuthenticationError(message, this.exchange.type);
        }

        if (code === 'NETWORK_ERROR' || message.includes('network') || message.includes('connection')) {
            return new NetworkError(message);
        }

        return new ExternalApiError(message, this.exchange.type, response?.status);
    }

    protected validateSymbol(symbol: string): void {
        if (!this.exchange.supportsSymbol(symbol)) {
            throw new ExchangeApiError(`Symbol ${symbol} is not supported on ${this.exchange.type}`);
        }
    }

    protected validateTimeframe(timeframe: TimeFrame): void {
        if (!this.exchange.supportsTimeframe(timeframe)) {
            throw new ExchangeApiError(`Timeframe ${timeframe} is not supported on ${this.exchange.type}`);
        }
    }

    protected logApiCall(endpoint: string, params: any, duration: number): void {
        this.logger.debug(`API call to ${this.exchange.type}/${endpoint}`, {
            params,
            duration: `${duration}ms`,
            rateLimitRemaining: this._rateLimitRemaining
        });
    }

    protected retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        return new Promise(async (resolve, reject) => {
            let attempt = 0;

            while (attempt < maxRetries) {
                try {
                    const result = await operation();
                    resolve(result);
                    return;
                } catch (error) {
                    attempt++;

                    if (attempt >= maxRetries) {
                        reject(error);
                        return;
                    }

                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    this.logger.warn(`API call failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);

                    await this.sleep(delay);
                }
            }
        });
    }
}
