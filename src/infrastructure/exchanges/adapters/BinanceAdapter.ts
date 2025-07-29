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
    binance as Binance,
    AuthenticationError as CcxtAuthenticationError,
    NetworkError as CcxtNetworkError,
    ExchangeError as CcxtExchangeError,
    RateLimitExceeded as CcxtRateLimitExceeded,
} from 'ccxt';

export class BinanceAdapter extends BaseExchangeAdapter {
    private binanceClient!: Binance;

    constructor(
        exchange: Exchange,
        config: IExchangeApiConfig,
        logger: ILogger
    ) {
        super(exchange, config, logger);
    }

    protected createApiClient(): Binance {
        this.binanceClient = new Binance({
            apiKey: this.config.apiKey,
            secret: this.config.secretKey,
            sandbox: this.config.sandbox,
            timeout: this.config.timeout,
            enableRateLimit: this.config.enableRateLimit,
            options: {
                defaultType: 'future', // Use futures by default
                recvWindow: 5000,
            },
            headers: {
                'User-Agent': 'UniversalSignalBot/2.0'
            }
        });

        return this.binanceClient;
    }

    protected async executeApiCall(endpoint: string, params: any): Promise<any> {
        const startTime = Date.now();

        try {
            let result;

            switch (endpoint) {
                case 'ping':
                    result = await this.binanceClient.publicGetPing();
                    break;

                case 'candles':
                    result = await this.binanceClient.fetchOHLCV(
                        params.symbol,
                        params.interval,
                        undefined,
                        params.limit
                    );
                    break;

                case 'ticker':
                    result = await this.binanceClient.fetchTicker(params.symbol);
                    break;

                case 'markets':
                    result = await this.binanceClient.loadMarkets();
                    break;

                case 'balance':
                    result = await this.binanceClient.fetchBalance();
                    break;

                default:
                    throw new Error(`Unknown endpoint: ${endpoint}`);
            }

            const duration = Date.now() - startTime;
            this.logApiCall(endpoint, params, duration);

            // Update rate limit info from headers
            this.updateRateLimitFromHeaders(this.binanceClient.last_response_headers);

            return result;

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`Binance API call failed for ${endpoint}`, {
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
            return new NetworkError(`Binance network error: ${error.message}`);
        }

        if (error instanceof CcxtAuthenticationError) {
            return new AuthenticationError(`Binance authentication error: ${error.message}`, 'binance');
        }

        if (error instanceof CcxtRateLimitExceeded) {
            return new RateLimitError(`Binance rate limit exceeded: ${error.message}`);
        }

        if (error instanceof CcxtExchangeError) {
            return new ExternalApiError(`Binance API error: ${error.message}`, 'binance');
        }

        // Handle raw Binance API errors
        if (error.response) {
            const data = error.response.data || error.response;

            if (data.code === -2014 || data.code === -1022) {
                return new AuthenticationError(`Binance authentication failed: ${data.msg}`, 'binance');
            }

            if (data.code === -1003) {
                return new RateLimitError(`Binance rate limit: ${data.msg}`);
            }

            return new ExternalApiError(
                `Binance API error [${data.code}]: ${data.msg}`,
                'binance',
                error.response.status,
                data
            );
        }

        return new ExternalApiError(`Binance unknown error: ${error.message}`, 'binance');
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
            maxOrderSize: market.limits?.amount?.max || 9000000,
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

        return {free, used, total};
    }

    protected normalizeSymbol(symbol: string): string {
        // Binance through CCXT uses the original format (e.g., 'BTC/USDT')
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

        // Binance rate limit headers
        const remaining = headers['x-mbx-used-weight-1m'];
        const orderCountRemaining = headers['x-mbx-order-count-1m'];

        if (remaining) {
            const usedWeight = parseInt(remaining);
            const remainingWeight = 1200 - usedWeight; // Binance limit is 1200/minute
            const resetTime = Date.now() + 60000; // Reset every minute

            this.updateRateLimit(remainingWeight, resetTime);
        }
    }

    // Binance-specific methods
    async get24hrStats(symbol: string): Promise<{
        symbol: string;
        priceChange: number;
        priceChangePercent: number;
        weightedAvgPrice: number;
        volume: number;
        quoteVolume: number;
        openPrice: number;
        highPrice: number;
        lowPrice: number;
        lastPrice: number;
        count: number;
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.binanceClient.publicGetTicker24hr({
                symbol: this.normalizeSymbol(symbol).replace('/', '')
            });

            return {
                symbol: response.symbol,
                priceChange: parseFloat(response.priceChange),
                priceChangePercent: parseFloat(response.priceChangePercent),
                weightedAvgPrice: parseFloat(response.weightedAvgPrice),
                volume: parseFloat(response.volume),
                quoteVolume: parseFloat(response.quoteVolume),
                openPrice: parseFloat(response.openPrice),
                highPrice: parseFloat(response.highPrice),
                lowPrice: parseFloat(response.lowPrice),
                lastPrice: parseFloat(response.lastPrice),
                count: parseInt(response.count)
            };
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    async getFundingRate(symbol: string): Promise<{
        fundingRate: number;
        fundingTime: number;
        nextFundingTime: number;
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.binanceClient.fapiPublicGetPremiumIndex({
                symbol: this.normalizeSymbol(symbol).replace('/', '')
            });

            return {
                fundingRate: parseFloat(response.lastFundingRate),
                fundingTime: parseInt(response.fundingTime),
                nextFundingTime: parseInt(response.nextFundingTime)
            };
        } catch (error) {
            this.logger.warn(`Failed to get funding rate for ${symbol}:`, error);
            return {fundingRate: 0, fundingTime: 0, nextFundingTime: 0};
        }
    }

    async getOpenInterest(symbol: string): Promise<{
        openInterest: number;
        notionalValue: number;
        timestamp: number;
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.binanceClient.fapiPublicGetOpenInterest({
                symbol: this.normalizeSymbol(symbol).replace('/', '')
            });

            return {
                openInterest: parseFloat(response.openInterest),
                notionalValue: parseFloat(response.sumOpenInterestValue),
                timestamp: parseInt(response.time)
            };
        } catch (error) {
            this.logger.warn(`Failed to get open interest for ${symbol}:`, error);
            return {openInterest: 0, notionalValue: 0, timestamp: 0};
        }
    }

    async getLongShortRatio(symbol: string, period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '5m'): Promise<{
        symbol: string;
        longShortRatio: number;
        longAccount: number;
        shortAccount: number;
        timestamp: number;
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const response = await this.binanceClient.fapiDataGetGlobalLongShortAccountRatio({
                symbol: this.normalizeSymbol(symbol).replace('/', ''),
                period,
                limit: 1
            });

            const data = response[0];
            return {
                symbol: data.symbol,
                longShortRatio: parseFloat(data.longShortRatio),
                longAccount: parseFloat(data.longAccount),
                shortAccount: parseFloat(data.shortAccount),
                timestamp: parseInt(data.timestamp)
            };
        } catch (error) {
            this.logger.warn(`Failed to get long/short ratio for ${symbol}:`, error);
            return {symbol, longShortRatio: 1, longAccount: 0.5, shortAccount: 0.5, timestamp: Date.now()};
        }
    }

    async getOrderBook(symbol: string, limit: number = 100): Promise<{
        bids: [number, number][];
        asks: [number, number][];
        lastUpdateId: number;
    }> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);

            const orderbook = await this.binanceClient.fetchOrderBook(
                this.normalizeSymbol(symbol),
                limit
            );

            return {
                bids: orderbook.bids.map(bid => [bid[0], bid[1]]) as [number, number][],
                asks: orderbook.asks.map(ask => [ask[0], ask[1]]) as [number, number][],
                lastUpdateId: orderbook.nonce || 0
            };
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    async getKlines(
        symbol: string,
        interval: TimeFrame,
        startTime?: number,
        endTime?: number,
        limit: number = 500
    ): Promise<ICandle[]> {
        try {
            this.validateConnection();
            this.validateSymbol(symbol);
            this.validateTimeframe(interval);

            const params: Record<string, any> = {
                symbol: this.normalizeSymbol(symbol).replace('/', ''),
                interval: this.normalizeTimeframe(interval),
                limit: Math.min(limit, 1500)
            };

            if (startTime) params['startTime'] = startTime;
            if (endTime) params['endTime'] = endTime;

            const response = await this.binanceClient.fapiPublicGetKlines(params);

            return response.map((kline: any[]) => ({
                timestamp: parseInt(kline[0]),
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5])
            }));
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    async getServerTime(): Promise<number> {
        try {
            const response = await this.binanceClient.publicGetTime();
            return parseInt(response.serverTime);
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    async getExchangeInfo(): Promise<any> {
        try {
            const response = await this.binanceClient.fapiPublicGetExchangeInfo();
            return response;
        } catch (error) {
            throw this.handleApiError(error);
        }
    }

    // Health check specific to Binance
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
            // Test server time sync
            const serverTime = await this.getServerTime();
            const timeDiff = Math.abs(Date.now() - serverTime);
            checks.push({
                name: 'time_sync',
                status: timeDiff < 5000, // Within 5 seconds
                message: `Time diff: ${timeDiff}ms`
            });
        } catch (error: any) {
            checks.push({
                name: 'time_sync',
                status: false,
                message: error.message
            });
        }

        try {
            // Test market data access
            await this.binanceClient.fetchTicker('BTC/USDT');
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

        return {status, checks};
    }

    // Get Binance-specific configuration
    getBinanceConfig(): {
        testnet: boolean;
        defaultType: string;
        rateLimitRemaining: number;
        nextResetTime: number;
        serverTimeOffset: number;
    } {
        return {
            testnet: this.config.sandbox,
            defaultType: this.binanceClient.options?.defaultType || 'future',
            rateLimitRemaining: this._rateLimitRemaining,
            nextResetTime: this._nextResetTime,
            serverTimeOffset: this.binanceClient.options?.adjustForTimeDifference || 0
        };
    }
}