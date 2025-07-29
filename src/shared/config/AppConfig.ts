import {
    IApiConfig,
    IAppConfig,
    IBotConfig,
    IMonitoringConfig, IRedisConfig,
    IRiskConfig, ITelegramConfig,
    ITradingConfig, IWebhookConfig,
    TimeFrame,
} from '../types';
import {ConfigurationError} from '../errors/InfrastructureErrors'

export class AppConfig implements IAppConfig {
    constructor(
        public readonly environment: 'development' | 'production' | 'test',
        public readonly debug: boolean,
        public readonly logLevel: 'error' | 'warn' | 'info' | 'debug',
        public readonly logFile: string,
        public readonly logMaxSize: string,
        public readonly logMaxFiles: number,
        public readonly bot: IBotConfig,
        public readonly trading: ITradingConfig,
        public readonly risk: IRiskConfig,
        public readonly monitoring: IMonitoringConfig,
        public readonly api: IApiConfig,
        public readonly telegram: ITelegramConfig,
        public readonly webhook: IWebhookConfig,
        public readonly redis: IRedisConfig,
        public readonly dataPath: string
    ) {
        this.validate();
    }

    /**
     * Create AppConfig from environment variables
     */
    static fromEnvironment(): AppConfig {
        const environment = (process.env.NODE_ENV as any) || 'development';
        const debug = process.env.DEBUG === 'true';
        const logLevel = (process.env.LOG_LEVEL as any) || 'info';
        const logFile = process.env.LOG_FILE || 'logs/bot.log';
        const logMaxSize = process.env.LOG_MAX_SIZE || '10mb';
        const logMaxFiles = parseInt(process.env.LOG_MAX_FILES || '5');
        const dataPath = process.env.DATA_PATH || './data';

        const bot: IBotConfig = {
            mode: (process.env.BOT_MODE as any) || 'single',
            activeExchange: process.env.ACTIVE_EXCHANGE || 'bybit',
            updateInterval: parseInt(process.env.UPDATE_INTERVAL || '30000'),
            maxConcurrentPairs: parseInt(process.env.MAX_CONCURRENT_PAIRS || '5'),
            healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
            maxErrorRate: parseFloat(process.env.MAX_ERROR_RATE || '0.1'),
            enableBacktesting: process.env.ENABLE_BACKTESTING === 'true',
            performanceTracking: process.env.PERFORMANCE_TRACKING === 'true',
            saveSignalsToFile: process.env.SAVE_SIGNALS_TO_FILE === 'true'
        };

        const trading: ITradingConfig = {
            mode: (process.env.TRADING_MODE as any) || 'intraday',
            pair: process.env.TRADING_PAIR,
            timeframes: {
                scalping: (process.env.SCALPING_TIMEFRAME as TimeFrame) || TimeFrame.FIVE_MINUTES,
                intraday: (process.env.INTRADAY_TIMEFRAME as TimeFrame) || TimeFrame.FIFTEEN_MINUTES,
                swing: (process.env.SWING_TIMEFRAME as TimeFrame) || TimeFrame.ONE_HOUR,
                position: (process.env.POSITION_TIMEFRAME as TimeFrame) || TimeFrame.FOUR_HOURS
            },
            updateIntervals: {
                scalping: parseInt(process.env.SCALPING_UPDATE_INTERVAL || '15000'),
                intraday: parseInt(process.env.INTRADAY_UPDATE_INTERVAL || '30000'),
                swing: parseInt(process.env.SWING_UPDATE_INTERVAL || '60000'),
                position: parseInt(process.env.POSITION_UPDATE_INTERVAL || '300000')
            },
            signalCooldowns: {
                scalping: parseInt(process.env.SCALPING_SIGNAL_COOLDOWN || '300000'),
                intraday: parseInt(process.env.INTRADAY_SIGNAL_COOLDOWN || '600000'),
                swing: parseInt(process.env.SWING_SIGNAL_COOLDOWN || '1800000'),
                position: parseInt(process.env.POSITION_SIGNAL_COOLDOWN || '3600000')
            }
        };

        const risk: IRiskConfig = {
            maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '2.0'),
            defaultStopLoss: parseFloat(process.env.DEFAULT_STOP_LOSS || '0.02'),
            minConfidenceScore: parseInt(process.env.MIN_CONFIDENCE_SCORE || '6'),
            maxSimultaneousSignals: parseInt(process.env.MAX_SIMULTANEOUS_SIGNALS || '5'),
            emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || '0.05'),
            maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '10.0'),
            positionSizingMethod: (process.env.POSITION_SIZING_METHOD as any) || 'percentage'
        };

        const monitoring: IMonitoringConfig = {
            healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
            maxErrorRate: parseFloat(process.env.MAX_ERROR_RATE || '0.1'),
            alertWebhookUrl: process.env.ALERT_WEBHOOK_URL!,
            enableMetrics: process.env.ENABLE_METRICS === 'true',
            metricsPort: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : 0,
            enableTracing: process.env.ENABLE_TRACING === 'true'
        };

        const api: IApiConfig = {
            enable: process.env.API_ENABLE === 'true',
            port: parseInt(process.env.API_PORT || '3000'),
            host: process.env.API_HOST || 'localhost',
            cors: {
                enabled: process.env.API_CORS_ENABLED !== 'false',
                origins: (process.env.API_CORS_ORIGINS || '*').split(',')
            },
            rateLimit: {
                enabled: process.env.API_RATE_LIMIT_ENABLED !== 'false',
                max: parseInt(process.env.API_RATE_LIMIT_MAX || '100'),
                windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000')
            },
            auth: {
                enabled: process.env.API_AUTH_ENABLED === 'true',
                secret: process.env.API_AUTH_SECRET!,
                tokenExpiry: parseInt(process.env.API_TOKEN_EXPIRY || '3600')
            }
        };

        const telegram: ITelegramConfig = {
            enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN),
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || '',
            enableNotifications: process.env.TELEGRAM_ENABLE_NOTIFICATIONS !== 'false',
            enableCommands: process.env.TELEGRAM_ENABLE_COMMANDS !== 'false',
            adminChatIds: (process.env.TELEGRAM_ADMIN_CHAT_IDS || '').split(',').filter(Boolean),
            rateLimitPerMinute: parseInt(process.env.TELEGRAM_RATE_LIMIT_PER_MINUTE || '20')
        };

        const webhook: IWebhookConfig = {
            enabled: process.env.WEBHOOK_ENABLED === 'true',
            urls: (process.env.WEBHOOK_URLS || '').split(',').filter(Boolean),
            timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000'),
            retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3'),
            headers: AppConfig.parseHeaders(process.env.WEBHOOK_HEADERS),
            authentication: {
                type: (process.env.WEBHOOK_AUTH_TYPE as any) || 'none',
                credentials: AppConfig.parseCredentials(process.env.WEBHOOK_AUTH_CREDENTIALS)!
            }
        };

        const redis: IRedisConfig = {
            enabled: process.env.REDIS_ENABLED === 'true',
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            password: process.env.REDIS_PASSWORD!,
            database: parseInt(process.env.REDIS_DATABASE || '0'),
            keyPrefix: process.env.REDIS_KEY_PREFIX || 'signal_bot:',
            connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '5000'),
            commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
            retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3'),
            enableCluster: process.env.REDIS_ENABLE_CLUSTER === 'true'
        };

        return new AppConfig(
            environment,
            debug,
            logLevel,
            logFile,
            logMaxSize,
            logMaxFiles,
            bot,
            trading,
            risk,
            monitoring,
            api,
            telegram,
            webhook,
            redis,
            dataPath
        );
    }

    /**
     * Get current trading configuration based on trading mode
     */
    getCurrentTradingConfig(): {
        timeframe: TimeFrame;
        updateInterval: number;
        signalCooldown: number;
    } {
        const mode = this.trading.mode;
        return {
            timeframe: this.trading.timeframes[mode],
            updateInterval: this.trading.updateIntervals[mode],
            signalCooldown: this.trading.signalCooldowns[mode]
        };
    }

    /**
     * Check if running in development mode
     */
    isDevelopment(): boolean {
        return this.environment === 'development';
    }

    /**
     * Check if running in production mode
     */
    isProduction(): boolean {
        return this.environment === 'production';
    }

    /**
     * Check if running in test mode
     */
    isTest(): boolean {
        return this.environment === 'test';
    }

    /**
     * Get effective log level based on environment
     */
    getEffectiveLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
        if (this.isProduction()) {
            return this.logLevel === 'debug' ? 'info' : this.logLevel;
        }
        return this.logLevel;
    }

    /**
     * Convert to plain object
     */
    toPlainObject(): Record<string, any> {
        return {
            environment: this.environment,
            debug: this.debug,
            logLevel: this.logLevel,
            logFile: this.logFile,
            logMaxSize: this.logMaxSize,
            logMaxFiles: this.logMaxFiles,
            bot: this.bot,
            trading: this.trading,
            risk: this.risk,
            monitoring: this.monitoring,
            api: this.api,
            telegram: {
                ...this.telegram,
                botToken: this.telegram.botToken ? '[REDACTED]' : ''
            },
            webhook: this.webhook,
            redis: {
                ...this.redis,
                password: this.redis.password ? '[REDACTED]' : undefined
            },
            dataPath: this.dataPath
        };
    }

    private static parseHeaders(headersString?: string): Record<string, string> {
        if (!headersString) return {};

        try {
            return JSON.parse(headersString);
        } catch {
            return {};
        }
    }

    private static parseCredentials(credentialsString?: string): Record<string, string> | undefined {
        if (!credentialsString) return undefined;

        try {
            return JSON.parse(credentialsString);
        } catch {
            return undefined;
        }
    }

    private validate(): void {
        // Validate environment
        if (!['development', 'production', 'test'].includes(this.environment)) {
            throw new ConfigurationError('Invalid environment value');
        }

        // Validate log level
        if (!['error', 'warn', 'info', 'debug'].includes(this.logLevel)) {
            throw new ConfigurationError('Invalid log level');
        }

        // Validate bot configuration
        if (!['single', 'multi', 'auto'].includes(this.bot.mode)) {
            throw new ConfigurationError('Invalid bot mode');
        }

        if (this.bot.updateInterval < 1000) {
            throw new ConfigurationError('Update interval must be at least 1000ms');
        }

        if (this.bot.maxConcurrentPairs < 1 || this.bot.maxConcurrentPairs > 50) {
            throw new ConfigurationError('Max concurrent pairs must be between 1 and 50');
        }

        // Validate trading configuration
        if (!['scalping', 'intraday', 'swing', 'position'].includes(this.trading.mode)) {
            throw new ConfigurationError('Invalid trading mode');
        }

        // Validate risk configuration
        if (this.risk.maxRiskPerTrade <= 0 || this.risk.maxRiskPerTrade > 100) {
            throw new ConfigurationError('Max risk per trade must be between 0 and 100');
        }

        if (this.risk.defaultStopLoss <= 0 || this.risk.defaultStopLoss >= 1) {
            throw new ConfigurationError('Default stop loss must be between 0 and 1');
        }

        if (this.risk.minConfidenceScore < 1 || this.risk.minConfidenceScore > 10) {
            throw new ConfigurationError('Min confidence score must be between 1 and 10');
        }

        // Validate API configuration
        if (this.api.enable) {
            if (this.api.port < 1 || this.api.port > 65535) {
                throw new ConfigurationError('API port must be between 1 and 65535');
            }
        }

        // Validate Telegram configuration
        if (this.telegram.enabled) {
            if (!this.telegram.botToken) {
                throw new ConfigurationError('Telegram bot token is required when Telegram is enabled');
            }

            if (!this.telegram.chatId) {
                throw new ConfigurationError('Telegram chat ID is required when Telegram is enabled');
            }
        }

        // Validate webhook configuration
        if (this.webhook.enabled && this.webhook.urls.length === 0) {
            throw new ConfigurationError('At least one webhook URL is required when webhooks are enabled');
        }

        // Validate Redis configuration
        if (this.redis.enabled && !this.redis.url) {
            throw new ConfigurationError('Redis URL is required when Redis is enabled');
        }
    }
}
