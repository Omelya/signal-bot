declare global {
    namespace NodeJS {
        interface ProcessEnv {
            // Exchange API Configuration
            BYBIT_API_KEY: string;
            BYBIT_SECRET: string;
            BYBIT_SANDBOX: string;
            BYBIT_BASE_URL: string;

            BINANCE_API_KEY: string;
            BINANCE_SECRET: string;
            BINANCE_SANDBOX: string;
            BINANCE_BASE_URL: string;

            OKX_API_KEY: string;
            OKX_SECRET: string;
            OKX_PASSPHRASE: string;
            OKX_SANDBOX: string;
            OKX_BASE_URL: string;

            COINBASE_API_KEY: string;
            COINBASE_SECRET: string;
            COINBASE_PASSPHRASE: string;
            COINBASE_SANDBOX: string;
            COINBASE_BASE_URL: string;

            // Telegram Configuration
            TELEGRAM_BOT_TOKEN: string;
            TELEGRAM_CHAT_ID: string;

            // Bot Configuration
            BOT_MODE: 'single' | 'multi' | 'auto';
            TRADING_MODE: 'scalping' | 'intraday' | 'swing' | 'position';
            TRADING_PAIR: 'BTC/USDT';
            ACTIVE_EXCHANGE: 'bybit' | 'binance' | 'okx' | 'coinbase';
            UPDATE_INTERVAL: string;
            MAX_CONCURRENT_PAIRS: string;

            // Scalping Mode
            SCALPING_TIMEFRAME: string;
            SCALPING_UPDATE_INTERVAL: string;
            SCALPING_SIGNAL_COOLDOWN: string;

            // Intraday Mode
            INTRADAY_TIMEFRAME: string;
            INTRADAY_UPDATE_INTERVAL: string;
            INTRADAY_SIGNAL_COOLDOWN: string;

            // Database Configuration
            REDIS_URL?: string;
            REDIS_PASSWORD?: string;
            REDIS_ENABLED: string;
            REDIS_DATABASE?: string;
            REDIS_KEY_PREFIX?: string;
            REDIS_CONNECTION_TIMEOUT?: string;
            REDIS_COMMAND_TIMEOUT?: string;
            REDIS_RETRY_ATTEMPTS?: string;
            REDIS_ENABLE_CLUSTER?: string;

            // Logging Configuration
            LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
            LOG_FILE: string;
            LOG_MAX_SIZE: string;
            LOG_MAX_FILES: string;

            // API Configuration
            API_PORT: string;
            API_HOST: string;
            API_ENABLE: string;

            // Monitoring & Alerts
            HEALTH_CHECK_INTERVAL: string;
            MAX_ERROR_RATE: string;
            ALERT_WEBHOOK_URL?: string;

            // Risk Management
            MAX_RISK_PER_TRADE: string;
            DEFAULT_STOP_LOSS: string;
            MIN_CONFIDENCE_SCORE: string;

            // Performance Tracking
            ENABLE_BACKTESTING: string;
            PERFORMANCE_TRACKING: string;
            SAVE_SIGNALS_TO_FILE: string;

            // Development
            NODE_ENV: 'development' | 'production' | 'test';
            DEBUG: string;
        }
    }
}

export {};
