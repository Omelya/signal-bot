import { BaseExchangeAdapter } from './BaseExchangeAdapter';
import { Exchange } from '../../../domain/entities/Exchange';
import {
    NetworkError,
    ExternalApiError,
    RateLimitError,
    AuthenticationError,
    TimeFrame,
    IExchangeApiConfig,
    ILogger,
    ICandle,
    ITicker,
    IAccountBalance,
    IMarketInfo,
} from '../../../shared';
import {
    bybit as Bybit,
    AuthenticationError as CcxtAuthenticationError,
    NetworkError as CcxtNetworkError,
    ExchangeError as CcxtExchangeError,
    RateLimitExceeded as CcxtRateLimitExceeded,
} from 'ccxt';

export class BybitAdapter extends BaseExchangeAdapter {
    private bybitClient!: Bybit;

    constructor(
        exchange: Exchange,
        config: IExchangeApiConfig,
        logger: ILogger
    ) {
        super(exchange, config, logger);
    }

    protected createApiClient(): Bybit {
        this.bybitClient = new Bybit({
            apiKey: this.config.apiKey,
            secret: this.config.secretKey,
            sandbox: this.config.sandbox,
            timeout: this.config.timeout,
            enableRateLimit: this.config.enableRateLimit,
            options: {
                defaultType: 'linear', // Use linear perpetual contracts by default
                recvWindow: 5000,
            },
            headers: {
                'User-Agent': 'UniversalSignalBot/2.0'
            }
        });

        return this.bybitClient;
    }

    protected async executeApiCall(endpoint: string, params: any): Promise<any> {
        const startTime = Date.now();

        try {
            let result;

            switch (endpoint) {
                case 'ping':
                    result = await this.bybitClient.publicGetV5MarketTime();
                    break;

                case 'candles':
                    result = await this.bybitClient.fetchOHLCV(
                        params.symbol,
                        params.interval,
                        undefined,
                        params.limit
                    );
                    break;

                case 'ticker':
                    result = await this.bybitClient.fetchTicker(params.symbol);
                    break;

                case 'markets':
                    result = await this.bybitClient.loadMarkets();
                    break;

                case 'balance':
                    result = await this.bybitClient.fetchBalance();
                    break;

                default:
                    throw new Error(`Unknown endpoint: ${endpoint}`);
            }

            const duration = Date.now() - startTime;
            this.logApiCall(endpoint, params, duration);

            // Update rate limit info from headers
            this.updateRateLimitFromHeaders(this.bybitClient.last_response_headers);

            return result;

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`Bybit API call failed for ${endpoint}`, {
                error: error.message,
                duration: `${duration}ms`,
                params
            });
            throw error;
        }
    }

    protected handleApiError(error: any): Error {
        // Handle CCXT errors
        if (error instanceof CcxtNetworkError) {
            return new NetworkError(`Bybit network error: ${error.message}`);
        }

        if (error instanceof CcxtAuthenticationError) {
            return new AuthenticationError(`Bybit authentication error: ${error.message}`, 'bybit');
        }

        if (error instanceof CcxtRateLimitExceeded) {
            return new RateLimitError(`Bybit rate limit exceeded: ${error.message}`);
        }

        if (error instanceof CcxtExchangeError) {
            return new ExternalApiError(`Bybit API error: ${error.message}`, 'bybit');
        }

        // Handle raw Bybit API errors
        if (error.response) {
            const data = error.response.data || error.response;

            if (data.retCode === 10004 || data.retCode === 10005) {
                return new AuthenticationError(`Bybit authentication failed: ${data.retMsg}`, 'bybit');
            }

            if (data.retCode === 10006) {
                return new RateLimitError(`Bybit rate limit: ${data.retMsg}`);
            }

            return new ExternalApiError(
                `Bybit API error [${data.retCode}]: ${data.retMsg}`,
                'bybit',
                error.response.status,
                data
            );
        }

        return new ExternalApiError(`Bybit unknown error: ${error.message}`, 'bybit');
    }

    protected transformCandles(data: any[]): ICandle[] {
        return data.map(candle => ({
            timestamp: candle[0], // CCXT normalizes timestamps
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    }

    protected transformTicker(data: any): ITicker {
        return {
            symbol: data.symbol,
            bid: parseFloat(data.bid),
            ask: parseFloat(data.ask),
            last: parseFloat(data.last),
            volume: parseFloat(data.baseVolume),
            change: parseFloat(data.change),
            percentage: parseFloat(data.percentage),
            timestamp: data.timestamp || Date.now()
        };
    }

    protected transformMarkets(data: any): IMarketInfo[] {
        return Object.values(data).map((market: any) => ({
            symbol: market.symbol,
            baseAsset: market.base,
            quoteAsset: market.quote,
            minOrderSize: market.limits?.amount?.min || 0.00001,
            maxOrderSize: market.limits?.amount?.max || 1000000,
            priceStep: market.precision?.price || 0.01,
            quantityStep: market.precision?.amount || 0.00001,
            isActive: market.active,
            volume24h: 0 // Will be updated separately if needed
        }));
    }

    protected transformBalance(data: any): IAccountBalance {
        const free: Record<string, number> = {};
        const used: Record<string, number> = {};
        const total: Record<string, number> = {};

        for (const [currency, balance] of Object.entries(data)) {
            const bal = balance as any;
            free[currency] = parseFloat(bal.free) || 0;
            used[currency] = parseFloat(bal.used) || 0;
            total[currency] = parseFloat(bal.total) || 0;
        }

        return { free, used, total };
    }

    protected normalizeSymbol(symbol: string): string {
        // Bybit through CCXT uses the original format (e.g., 'BTC/USDT')
        return symbol;
    }

    protected normalizeTimeframe(timeframe: TimeFrame): string {
        const timeframeMap: Record<TimeFrame, string> = {
            [TimeFrame.ONE_MINUTE]: '1m',
            [TimeFrame.FIVE_MINUTES]: '5m',
            [TimeFrame.FIFTEEN_MINUTES]: '15m',
            [TimeFrame.THIRTY_MINUTES]: '30m',
            [TimeFrame.ONE_HOUR]: '1h',
            [TimeFrame.TWO_HOURS]: '2h',
            [TimeFrame.FOUR_HOURS]: '4h',
            [TimeFrame.SIX_HOURS]: '6h',
            [TimeFrame.EIGHT_HOURS]: '8h',
            [TimeFrame.TWELVE_HOURS]: '12h',
            [TimeFrame.ONE_DAY]: '1d',
            [TimeFrame.THREE_DAYS]: '3d',
            [TimeFrame.ONE_WEEK]: '1w',
            [TimeFrame.ONE_MONTH]: '1M'
        };

        return timeframeMap[timeframe] || timeframe;
    }

    private updateRateLimitFromHeaders(headers: any): void {
        if (!headers) return;

        // Bybit rate limit headers
        const remaining = headers['x-bapi-limit-remaining'];
        const resetTime = headers['x-bapi-limit-reset-timestamp'];

        if (remaining) {
            const remainingNum = parseInt(remaining);
            const resetTimeNum = resetTime ? parseInt(resetTime) : Date.now() + 60000;

            this.updateRateLimit(remainingNum, resetTimeNum);
        }
    }

    // Bybit-specific methods
    async getInstrumentInfo(symbol: string): Promise<any> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.bybitClient.publicGetV5MarketInstrumentsInfo({
                category: 'linear',
                symbol: this.normalizeSymbol(symbol)
            });

            return response.result?.list?.[0];
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    async getOpenInterest(symbol: string): Promise<number> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.bybitClient.publicGetV5MarketOpenInterest({
                category: 'linear',
                symbol: this.normalizeSymbol(symbol),
                intervalTime: '5min',
                limit: 1
            });

            const data = response.result?.list?.[0];
            return data ? parseFloat(data.openInterest) : 0;
        } catch (error) {
            this.logger.warn(`Failed to get open interest for ${symbol}:`, error);
            return 0;
        }
    }

    async getFundingRate(symbol: string): Promise<{
        fundingRate: number;
        nextFundingTime: number;
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.bybitClient.publicGetV5MarketFundingHistory({
                category: 'linear',
                symbol: this.normalizeSymbol(symbol),
                limit: 1
            });

            const data = response.result?.list?.[0];
            return {
                fundingRate: data ? parseFloat(data.fundingRate) : 0,
                nextFundingTime: data ? parseInt(data.fundingRateTimestamp) + 28800000 : 0 // +8 hours
            };
        } catch (error) {
            this.logger.warn(`Failed to get funding rate for ${symbol}:`, error);
            return { fundingRate: 0, nextFundingTime: 0 };
        }
    }

    async getOrderBook(symbol: string, limit: number = 25): Promise<{
        bids: [number, number][];
        asks: [number, number][];
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const orderbook = await this.bybitClient.fetchOrderBook(
                this.normalizeSymbol(symbol),
                limit
            );

            return {
                bids: orderbook.bids.map(bid => [bid[0], bid[1]]) as [number, number][],
                asks: orderbook.asks.map(ask => [ask[0], ask[1]]) as [number, number][],
            };
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    async getRecentTrades(symbol: string, limit: number = 50): Promise<{
        id: string;
        timestamp: number;
        price: number;
        amount: number;
        side: 'buy' | 'sell';
    }[]> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const trades = await this.bybitClient.fetchTrades(
                this.normalizeSymbol(symbol),
                undefined,
                limit
            );

            return trades.map(trade => ({
                id: trade.id as string,
                timestamp: trade.timestamp as number,
                price: trade.price,
                amount: trade.amount as number,
                side: trade.side as 'buy' | 'sell'
            }));
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    // Health check specific to Bybit
    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Array<{ name: string; status: boolean; message?: string }>;
    }> {
        const checks = [];

        try {
            // Test basic connectivity
            const pingTime = await this.ping();
            checks.push({
                name: 'connectivity',
                status: pingTime < 2000,
                message: `Ping: ${pingTime}ms`
            });
        } catch (error: any) {
            checks.push({
                name: 'connectivity',
                status: false,
                message: error.message
            });
        }

        try {
            // Test market data access
            await this.bybitClient.fetchTicker('BTC/USDT');
            checks.push({
                name: 'market_data',
                status: true,
                message: 'Market data accessible'
            });
        } catch (error: any) {
            checks.push({
                name: 'market_data',
                status: false,
                message: error.message
            });
        }

        try {
            // Test account access (if API keys allow)
            if (this.config.apiKey && this.config.secretKey) {
                await this.getBalance();
                checks.push({
                    name: 'account_access',
                    status: true,
                    message: 'Account accessible'
                });
            }
        } catch (error: any) {
            checks.push({
                name: 'account_access',
                status: false,
                message: error.message
            });
        }

        const healthyChecks = checks.filter(check => check.status).length;
        const totalChecks = checks.length;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (healthyChecks === totalChecks) {
            status = 'healthy';
        } else if (healthyChecks > 0) {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }

        return { status, checks };
    }

    // Get Bybit-specific configuration
    getBybitConfig(): {
        testnet: boolean;
        defaultType: string;
        rateLimitRemaining: number;
        nextResetTime: number;
    } {
        return {
            testnet: this.config.sandbox,
            defaultType: this.bybitClient.options?.defaultType || 'linear',
            rateLimitRemaining: this._rateLimitRemaining,
            nextResetTime: this._nextResetTime
        };
    }
}
