import {
    ExchangeType,
    IExchangeCapabilities,
    IExchangeConfig, IExchangeCreateParams,
    IExchangeStatus,
    TimeFrame
} from '../../shared';
import { DomainError } from '../../shared';
import {IMarketInfo} from "../../shared";

export class Exchange {
    private _status: IExchangeStatus;
    private _markets: Map<string, IMarketInfo> = new Map();
    private _isInitialized: boolean = false;
    private _lastMarketUpdate: number = 0;
    private _connectionAttempts: number = 0;
    private _lastErrorTime: number = 0;

    private constructor(
        private readonly _type: ExchangeType,
        private readonly _config: IExchangeConfig,
        private readonly _capabilities: IExchangeCapabilities,
        private readonly _createdAt: Date = new Date()
    ) {
        this._status = this.initializeStatus();
        this.validateConfig();
        this.validateCapabilities();
    }

    /**
     * Factory method to create a new Exchange
     */
    static create(params: IExchangeCreateParams): Exchange {
        return new Exchange(
            params.type,
            params.config,
            params.capabilities
        );
    }

    /**
     * Factory method for Bybit exchange
     */
    static createBybit(config: Omit<IExchangeConfig, 'name'>): Exchange {
        const bybitCapabilities: IExchangeCapabilities = {
            supportedTimeframes: [
                TimeFrame.ONE_MINUTE,
                TimeFrame.FIVE_MINUTES,
                TimeFrame.FIFTEEN_MINUTES,
                TimeFrame.ONE_HOUR,
                TimeFrame.FOUR_HOURS,
                TimeFrame.ONE_DAY
            ],
            maxCandleHistory: 1000,
            rateLimits: {
                requestsPerSecond: 10,
                requestsPerMinute: 600,
                requestsPerHour: 36000,
                weightPerRequest: 1,
                maxWeight: 1200
            },
            supportedOrderTypes: ['market', 'limit', 'stop', 'stop_limit'],
            supportsFutures: true,
            supportsMargin: true,
            supportsSpot: true,
            minOrderSize: 0.0001,
            maxOrderSize: 1000000,
            tradingFees: {
                maker: 0.001, // 0.1%
                taker: 0.001, // 0.1%
                withdrawal: {
                    'BTC': 0.0005,
                    'ETH': 0.01,
                    'USDT': 1.0
                }
            }
        };

        return Exchange.create({
            type: ExchangeType.BYBIT,
            config: { ...config, name: 'bybit' },
            capabilities: bybitCapabilities
        });
    }

    /**
     * Factory method for Binance exchange
     */
    static createBinance(config: Omit<IExchangeConfig, 'name'>): Exchange {
        const binanceCapabilities: IExchangeCapabilities = {
            supportedTimeframes: [
                TimeFrame.ONE_MINUTE,
                TimeFrame.FIVE_MINUTES,
                TimeFrame.FIFTEEN_MINUTES,
                TimeFrame.ONE_HOUR,
                TimeFrame.FOUR_HOURS,
                TimeFrame.ONE_DAY
            ],
            maxCandleHistory: 1500,
            rateLimits: {
                requestsPerSecond: 10,
                requestsPerMinute: 1200,
                requestsPerHour: 72000,
                weightPerRequest: 1,
                maxWeight: 1200
            },
            supportedOrderTypes: ['market', 'limit', 'stop_loss', 'stop_loss_limit'],
            supportsFutures: true,
            supportsMargin: true,
            supportsSpot: true,
            minOrderSize: 0.00001,
            maxOrderSize: 9000000,
            tradingFees: {
                maker: 0.001, // 0.1%
                taker: 0.001, // 0.1%
                withdrawal: {
                    'BTC': 0.0005,
                    'ETH': 0.005,
                    'USDT': 1.0
                }
            }
        };

        return Exchange.create({
            type: ExchangeType.BINANCE,
            config: { ...config, name: 'binance' },
            capabilities: binanceCapabilities
        });
    }

    // Getters
    get type(): ExchangeType { return this._type; }
    get config(): IExchangeConfig { return this._config; }
    get capabilities(): IExchangeCapabilities { return this._capabilities; }
    get status(): IExchangeStatus { return this._status; }
    get isInitialized(): boolean { return this._isInitialized; }
    get createdAt(): Date { return this._createdAt; }
    get markets(): ReadonlyMap<string, IMarketInfo> { return this._markets; }

    // Business Methods

    /**
     * Mark exchange as initialized after successful connection
     */
    public markAsInitialized(): void {
        if (this._isInitialized) {
            throw new DomainError(`Exchange ${this._type} is already initialized`);
        }

        this._isInitialized = true;
        this.updateConnectionStatus(true);
    }

    /**
     * Update connection status
     */
    public updateConnectionStatus(isConnected: boolean, latency?: number): void {
        const now = Date.now();

        this._status = {
            ...this._status,
            isConnected,
            lastPing: now,
            latency: latency || this._status.latency
        };

        if (isConnected) {
            this._connectionAttempts = 0;
            this._status.successCount++;
        } else {
            this._connectionAttempts++;
            this._lastErrorTime = now;
        }
    }

    /**
     * Record a successful API call
     */
    public recordSuccess(): void {
        this._status.successCount++;
    }

    /**
     * Record a failed API call
     */
    public recordError(): void {
        this._status.errorCount++;
        this._lastErrorTime = Date.now();
    }

    /**
     * Update rate limit information
     */
    public updateRateLimit(remaining: number, resetTime: number): void {
        this._status = {
            ...this._status,
            rateLimitRemaining: remaining,
            nextResetTime: resetTime
        };
    }

    /**
     * Check if timeframe is supported
     */
    public supportsTimeframe(timeframe: TimeFrame): boolean {
        return this._capabilities.supportedTimeframes.includes(timeframe);
    }

    /**
     * Check if we're approaching rate limits
     */
    public isApproachingRateLimit(threshold: number = 0.1): boolean {
        const remaining = this._status.rateLimitRemaining;
        const max = this._capabilities.rateLimits.maxWeight;

        return (remaining / max) <= threshold;
    }

    /**
     * Get recommended delay between requests
     */
    public getRecommendedDelay(): number {
        if (this.isApproachingRateLimit()) {
            return 1000; // 1 second delay when approaching limit
        }

        const baseDelay = 1000 / this._capabilities.rateLimits.requestsPerSecond;
        return Math.max(100, baseDelay); // Minimum 100ms between requests
    }

    /**
     * Update market information
     */
    public updateMarket(symbol: string, marketInfo: IMarketInfo): void {
        this._markets.set(symbol.toUpperCase(), marketInfo);
        this._lastMarketUpdate = Date.now();
    }

    /**
     * Get market information for a symbol
     */
    public getMarket(symbol: string): IMarketInfo | undefined {
        return this._markets.get(symbol.toUpperCase());
    }

    /**
     * Check if symbol is supported
     */
    public supportsSymbol(symbol: string): boolean {
        const market = this.getMarket(symbol);
        return market !== undefined && market.isActive;
    }

    /**
     * Get all supported symbols
     */
    public getSupportedSymbols(): string[] {
        return Array.from(this._markets.keys()).filter(symbol => {
            const market = this._markets.get(symbol);
            return market?.isActive;
        });
    }

    /**
     * Get exchange health score (0-100)
     */
    public getHealthScore(): number {
        if (!this._isInitialized) return 0;

        let score = 100;

        // Deduct for connection issues
        if (!this._status.isConnected) score -= 50;

        // Deduct for high error rate
        const totalRequests = this._status.successCount + this._status.errorCount;
        if (totalRequests > 0) {
            const errorRate = this._status.errorCount / totalRequests;
            score -= errorRate * 30; // Up to 30 points for errors
        }

        // Deduct for high latency
        if (this._status.latency > 1000) score -= 20;
        else if (this._status.latency > 500) score -= 10;

        // Deduct for rate limit issues
        if (this.isApproachingRateLimit(0.2)) score -= 15;

        // Deduct for recent errors
        const timeSinceLastError = Date.now() - this._lastErrorTime;
        if (timeSinceLastError < 60000) score -= 10; // Recent error in last minute

        return Math.max(0, Math.round(score));
    }

    /**
     * Check if exchange is healthy for trading
     */
    public isHealthy(): boolean {
        return this.getHealthScore() >= 70;
    }

    /**
     * Get uptime percentage
     */
    public getUptimePercentage(): number {
        if (!this._isInitialized) return 0;

        const totalTime = Date.now() - this._createdAt.getTime();
        const downtime = this._connectionAttempts * 30000; // Assume 30s downtime per failed attempt

        const uptime = Math.max(0, totalTime - downtime);
        return Math.min(100, (uptime / totalTime) * 100);
    }

    /**
     * Reset error counters (for maintenance/recovery)
     */
    public resetErrorCounters(): void {
        this._status.errorCount = 0;
        this._connectionAttempts = 0;
        this._lastErrorTime = 0;
    }

    /**
     * Check if markets data is stale
     */
    public hasStaleMarketData(maxAgeMinutes: number = 60): boolean {
        if (this._markets.size === 0) return true;

        const now = Date.now();
        const ageMinutes = (now - this._lastMarketUpdate) / (1000 * 60);

        return ageMinutes > maxAgeMinutes;
    }

    /**
     * Get exchange display name
     */
    public getDisplayName(): string {
        return `${this._type.charAt(0).toUpperCase() + this._type.slice(1)}${this._config.sandbox ? ' (Sandbox)' : ''}`;
    }

    /**
     * Convert to plain object for serialization
     */
    public toPlainObject(): {
        type: ExchangeType;
        config: Omit<IExchangeConfig, 'apiKey' | 'secretKey'>; // Exclude sensitive data
        capabilities: IExchangeCapabilities;
        status: IExchangeStatus;
        isInitialized: boolean;
        createdAt: Date;
        marketCount: number;
        healthScore: number;
        uptimePercentage: number;
        supportedSymbolsCount: number;
        displayName: string;
    } {
        // Create config without sensitive information
        const { apiKey, secretKey, ...safeConfig } = this._config;

        return {
            type: this.type,
            config: safeConfig,
            capabilities: this.capabilities,
            status: this.status,
            isInitialized: this.isInitialized,
            createdAt: this.createdAt,
            marketCount: this._markets.size,
            healthScore: this.getHealthScore(),
            uptimePercentage: this.getUptimePercentage(),
            supportedSymbolsCount: this.getSupportedSymbols().length,
            displayName: this.getDisplayName()
        };
    }

    // Private methods

    private initializeStatus(): IExchangeStatus {
        return {
            isConnected: false,
            lastPing: 0,
            latency: 0,
            errorCount: 0,
            successCount: 0,
            rateLimitRemaining: this._capabilities.rateLimits.maxWeight,
            nextResetTime: Date.now() + 60000 // 1 minute from now
        };
    }

    private validateConfig(): void {
        if (!this._config.name || this._config.name.trim().length === 0) {
            throw new DomainError('Exchange name cannot be empty');
        }

        if (!this._config.apiKey || this._config.apiKey.trim().length === 0) {
            throw new DomainError('API key cannot be empty');
        }

        if (!this._config.secretKey || this._config.secretKey.trim().length === 0) {
            throw new DomainError('Secret key cannot be empty');
        }

        if (this._config.timeout < 1000 || this._config.timeout > 60000) {
            throw new DomainError('Timeout must be between 1000ms and 60000ms');
        }

        if (this._config.retryCount < 0 || this._config.retryCount > 10) {
            throw new DomainError('Retry count must be between 0 and 10');
        }
    }

    private validateCapabilities(): void {
        if (this._capabilities.supportedTimeframes.length === 0) {
            throw new DomainError('Exchange must support at least one timeframe');
        }

        if (this._capabilities.maxCandleHistory < 50) {
            throw new DomainError('Exchange must support at least 50 candles of history');
        }

        if (this._capabilities.rateLimits.requestsPerSecond <= 0) {
            throw new DomainError('Rate limit requests per second must be positive');
        }

        if (this._capabilities.minOrderSize <= 0) {
            throw new DomainError('Minimum order size must be positive');
        }

        if (this._capabilities.maxOrderSize <= this._capabilities.minOrderSize) {
            throw new DomainError('Maximum order size must be greater than minimum order size');
        }

        if (this._capabilities.tradingFees.maker < 0 || this._capabilities.tradingFees.taker < 0) {
            throw new DomainError('Trading fees cannot be negative');
        }
    }
}
