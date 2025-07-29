export enum ExchangeType {
    BYBIT = 'bybit',
    BINANCE = 'binance',
    OKX = 'okx',
}

export enum TimeFrame {
    ONE_MINUTE = '1m',
    FIVE_MINUTES = '5m',
    FIFTEEN_MINUTES = '15m',
    THIRTY_MINUTES = '30m',
    ONE_HOUR = '1h',
    TWO_HOURS = '2h',
    FOUR_HOURS = '4h',
    SIX_HOURS = '6h',
    EIGHT_HOURS = '8h',
    TWELVE_HOURS = '12h',
    ONE_DAY = '1d',
    THREE_DAYS = '3d',
    ONE_WEEK = '1w',
    ONE_MONTH = '1M'
}

export interface IExchangeConfig {
    readonly name: string;
    readonly apiKey: string;
    readonly secretKey: string;
    readonly sandbox: boolean;
    readonly enableRateLimit: boolean;
    readonly timeout: number;
    readonly retryCount: number;
    readonly baseUrl?: string;
    readonly testnet?: boolean;
}

export interface IExchangeCapabilities {
    readonly supportedTimeframes: readonly TimeFrame[];
    readonly maxCandleHistory: number;
    readonly rateLimits: IExchangeRateLimits;
    readonly supportedOrderTypes: readonly string[];
    readonly supportsFutures: boolean;
    readonly supportsMargin: boolean;
    readonly supportsSpot: boolean;
    readonly minOrderSize: number;
    readonly maxOrderSize: number;
    readonly tradingFees: IExchangeFees;
}

export interface IExchangeRateLimits {
    readonly requestsPerSecond: number;
    readonly requestsPerMinute: number;
    readonly requestsPerHour: number;
    readonly weightPerRequest: number;
    readonly maxWeight: number;
}

export interface IExchangeFees {
    readonly maker: number;
    readonly taker: number;
    readonly withdrawal: Record<string, number>;
}

export interface IExchangeStatus {
    readonly isConnected: boolean;
    readonly lastPing: number;
    readonly latency: number;
    errorCount: number;
    successCount: number;
    readonly rateLimitRemaining: number;
    readonly nextResetTime: number;
}


export interface IExchangeCreateParams {
    type: ExchangeType;
    config: IExchangeConfig;
    capabilities: IExchangeCapabilities;
}

export interface IExchangeApiConfig {
    apiKey: string;
    secretKey: string;
    passphrase?: string; // For OKX
    sandbox: boolean;
    enabled: boolean;
    timeout: number;
    retryCount: number;
    enableRateLimit: boolean;
    baseUrl?: string;
    testnet?: boolean;
}

export interface IExchangeConfigs {
    bybit?: IExchangeApiConfig|undefined;
    binance?: IExchangeApiConfig|undefined;
    okx?: IExchangeApiConfig|undefined;
    coinbase?: IExchangeApiConfig|undefined;
}
