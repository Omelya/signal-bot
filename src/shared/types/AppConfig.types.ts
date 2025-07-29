import {TimeFrame} from "./Exchange.types";

export interface IAppConfig {
    readonly environment: 'development' | 'production' | 'test';
    readonly debug: boolean;
    readonly logLevel: 'error' | 'warn' | 'info' | 'debug';
    readonly logFile: string;
    readonly logMaxSize: string;
    readonly logMaxFiles: number;

    readonly bot: IBotConfig;
    readonly trading: ITradingConfig;
    readonly risk: IRiskConfig;
    readonly monitoring: IMonitoringConfig;
    readonly api: IApiConfig;
    readonly telegram: ITelegramConfig;
    readonly webhook: IWebhookConfig;
    readonly redis: IRedisConfig;
    readonly dataPath: string;

    toPlainObject(): Record<string, any>
}

export interface IBotConfig {
    readonly mode: 'single' | 'multi' | 'auto';
    readonly activeExchange: string;
    readonly updateInterval: number;
    readonly maxConcurrentPairs: number;
    readonly healthCheckInterval: number;
    readonly maxErrorRate: number;
    readonly enableBacktesting: boolean;
    readonly performanceTracking: boolean;
    readonly saveSignalsToFile: boolean;
}

export interface ITradingConfig {
    readonly mode: 'scalping' | 'intraday' | 'swing' | 'position';
    readonly pair?: string;
    readonly timeframes: {
        readonly scalping: TimeFrame;
        readonly intraday: TimeFrame;
        readonly swing: TimeFrame;
        readonly position: TimeFrame;
    };
    readonly updateIntervals: {
        readonly scalping: number;
        readonly intraday: number;
        readonly swing: number;
        readonly position: number;
    };
    readonly signalCooldowns: {
        readonly scalping: number;
        readonly intraday: number;
        readonly swing: number;
        readonly position: number;
    };
}

export interface IRiskConfig {
    readonly maxRiskPerTrade: number;
    readonly defaultStopLoss: number;
    readonly minConfidenceScore: number;
    readonly maxSimultaneousSignals: number;
    readonly emergencyStopLoss: number;
    readonly maxDailyLoss: number;
    readonly positionSizingMethod: 'fixed' | 'percentage' | 'kelly' | 'optimal_f';
}

export interface IMonitoringConfig {
    readonly healthCheckInterval: number;
    readonly maxErrorRate: number;
    readonly alertWebhookUrl?: string;
    readonly enableMetrics: boolean;
    readonly metricsPort?: number;
    readonly enableTracing: boolean;
}

export interface IApiConfig {
    readonly enable: boolean;
    readonly port: number;
    readonly host: string;
    readonly cors: {
        readonly enabled: boolean;
        readonly origins: string[];
    };
    readonly rateLimit: {
        readonly enabled: boolean;
        readonly max: number;
        readonly windowMs: number;
    };
    readonly auth: {
        readonly enabled: boolean;
        readonly secret?: string;
        readonly tokenExpiry: number;
    };
}

export interface ITelegramConfig {
    readonly enabled: boolean;
    readonly botToken: string;
    readonly chatId: string;
    readonly enableNotifications: boolean;
    readonly enableCommands: boolean;
    readonly adminChatIds: string[];
    readonly rateLimitPerMinute: number;
}

export interface IWebhookConfig {
    readonly enabled: boolean;
    readonly urls: string[];
    readonly timeout: number;
    readonly retryAttempts: number;
    readonly headers: Record<string, string>;
    readonly authentication: {
        readonly type: 'none' | 'basic' | 'bearer' | 'api_key';
        readonly credentials?: Record<string, string>;
    };
}

export interface IRedisConfig {
    readonly enabled: boolean;
    readonly url: string;
    readonly password?: string;
    readonly database: number;
    readonly keyPrefix: string;
    readonly connectionTimeout: number;
    readonly commandTimeout: number;
    readonly retryAttempts: number;
    readonly enableCluster: boolean;
}
