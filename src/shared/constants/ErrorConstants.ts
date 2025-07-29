export const ERROR_CODES = {
    // Domain Errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DOMAIN_ERROR: 'DOMAIN_ERROR',
    SIGNAL_GENERATION_ERROR: 'SIGNAL_GENERATION_ERROR',
    MARKET_DATA_ERROR: 'MARKET_DATA_ERROR',
    NOTIFICATION_ERROR: 'NOTIFICATION_ERROR',
    EXCHANGE_NOT_INITIALIZED: 'EXCHANGE_NOT_INITIALIZED',
    EXCHANGE_API_ERROR: 'EXCHANGE_API_ERROR',
    UNSUPPORTED_EXCHANGE: 'UNSUPPORTED_EXCHANGE',
    BOT_ALREADY_RUNNING: 'BOT_ALREADY_RUNNING',
    SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',

    // Infrastructure Errors
    DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
    FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
    SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
    CACHE_ERROR: 'CACHE_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
    MESSAGE_QUEUE_ERROR: 'MESSAGE_QUEUE_ERROR',
    HEALTH_CHECK_ERROR: 'HEALTH_CHECK_ERROR',
    NOTIFICATION_DELIVERY_ERROR: 'NOTIFICATION_DELIVERY_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN'
} as const;

export const ERROR_MESSAGES = {
    // General
    UNKNOWN_ERROR: 'An unknown error occurred',
    INTERNAL_ERROR: 'Internal server error',
    INVALID_INPUT: 'Invalid input provided',
    MISSING_REQUIRED_FIELD: 'Required field is missing',

    // Configuration
    INVALID_CONFIG: 'Invalid configuration',
    MISSING_ENV_VAR: 'Required environment variable is missing',
    INVALID_ENV_VAR: 'Environment variable has invalid value',

    // Exchange
    EXCHANGE_NOT_CONFIGURED: 'Exchange is not properly configured',
    EXCHANGE_CONNECTION_FAILED: 'Failed to connect to exchange',
    EXCHANGE_API_LIMIT_EXCEEDED: 'Exchange API rate limit exceeded',
    EXCHANGE_INSUFFICIENT_BALANCE: 'Insufficient balance on exchange',
    EXCHANGE_MARKET_NOT_FOUND: 'Market not found on exchange',
    EXCHANGE_ORDER_FAILED: 'Failed to place order on exchange',

    // Market Data
    MARKET_DATA_UNAVAILABLE: 'Market data is unavailable',
    MARKET_DATA_STALE: 'Market data is stale',
    MARKET_DATA_INVALID: 'Market data is invalid',
    INSUFFICIENT_CANDLES: 'Insufficient candles for analysis',

    // Signal Generation
    SIGNAL_GENERATION_FAILED: 'Failed to generate signal',
    SIGNAL_VALIDATION_FAILED: 'Signal validation failed',
    SIGNAL_CONFIDENCE_TOO_LOW: 'Signal confidence is too low',
    SIGNAL_COOLDOWN_ACTIVE: 'Signal cooldown is still active',

    // Trading
    TRADING_PAIR_NOT_SUPPORTED: 'Trading pair is not supported',
    TRADING_PAIR_INACTIVE: 'Trading pair is inactive',
    INVALID_ORDER_SIZE: 'Invalid order size',
    INVALID_PRICE_RANGE: 'Price is outside valid range',
    STOP_LOSS_INVALID: 'Stop loss value is invalid',
    TAKE_PROFIT_INVALID: 'Take profit value is invalid',

    // Notifications
    NOTIFICATION_SEND_FAILED: 'Failed to send notification',
    TELEGRAM_TOKEN_INVALID: 'Telegram bot token is invalid',
    TELEGRAM_CHAT_NOT_FOUND: 'Telegram chat not found',
    WEBHOOK_DELIVERY_FAILED: 'Webhook delivery failed',

    // Authentication & Authorization
    INVALID_CREDENTIALS: 'Invalid credentials provided',
    TOKEN_EXPIRED: 'Authentication token has expired',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this operation',
    API_KEY_INVALID: 'API key is invalid',

    // Rate Limiting
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    TOO_MANY_REQUESTS: 'Too many requests, please slow down',

    // Network & Connectivity
    NETWORK_UNAVAILABLE: 'Network is unavailable',
    CONNECTION_TIMEOUT: 'Connection timed out',
    CONNECTION_REFUSED: 'Connection was refused',
    DNS_RESOLUTION_FAILED: 'DNS resolution failed',

    // Data & Storage
    DATABASE_CONNECTION_LOST: 'Database connection lost',
    DATA_NOT_FOUND: 'Requested data not found',
    DATA_CORRUPTION: 'Data corruption detected',
    STORAGE_FULL: 'Storage capacity exceeded',

    // Bot Operations
    BOT_NOT_INITIALIZED: 'Bot is not initialized',
    BOT_ALREADY_STARTED: 'Bot is already started',
    BOT_NOT_RUNNING: 'Bot is not running',
    BOT_EMERGENCY_STOP: 'Bot emergency stop activated',

    // Risk Management
    RISK_LIMIT_EXCEEDED: 'Risk limit exceeded',
    POSITION_SIZE_TOO_LARGE: 'Position size is too large',
    MAX_POSITIONS_REACHED: 'Maximum number of positions reached',
    DAILY_LOSS_LIMIT_REACHED: 'Daily loss limit reached'
} as const;

export const SUCCESS_MESSAGES = {
    // General
    OPERATION_SUCCESSFUL: 'Operation completed successfully',
    DATA_SAVED: 'Data saved successfully',
    DATA_UPDATED: 'Data updated successfully',
    DATA_DELETED: 'Data deleted successfully',

    // Bot Operations
    BOT_STARTED: 'Bot started successfully',
    BOT_STOPPED: 'Bot stopped successfully',
    BOT_CONFIGURED: 'Bot configured successfully',

    // Exchange
    EXCHANGE_CONNECTED: 'Successfully connected to exchange',
    EXCHANGE_DISCONNECTED: 'Successfully disconnected from exchange',

    // Signals
    SIGNAL_GENERATED: 'Signal generated successfully',
    SIGNAL_SENT: 'Signal sent successfully',
    SIGNAL_EXECUTED: 'Signal executed successfully',

    // Notifications
    NOTIFICATION_SENT: 'Notification sent successfully',
    TELEGRAM_MESSAGE_SENT: 'Telegram message sent successfully',
    WEBHOOK_DELIVERED: 'Webhook delivered successfully',

    // Configuration
    CONFIG_LOADED: 'Configuration loaded successfully',
    CONFIG_VALIDATED: 'Configuration validated successfully',
    CONFIG_SAVED: 'Configuration saved successfully'
} as const;

export const WARNING_MESSAGES = {
    // Performance
    HIGH_LATENCY_DETECTED: 'High latency detected',
    MEMORY_USAGE_HIGH: 'Memory usage is high',
    CPU_USAGE_HIGH: 'CPU usage is high',

    // Market Data
    MARKET_DATA_DELAYED: 'Market data is delayed',
    LOW_VOLUME_WARNING: 'Trading volume is unusually low',
    HIGH_VOLATILITY_WARNING: 'Market volatility is unusually high',

    // Exchange
    EXCHANGE_MAINTENANCE: 'Exchange is under maintenance',
    EXCHANGE_DEGRADED: 'Exchange performance is degraded',
    API_LIMIT_APPROACHING: 'Approaching API rate limit',

    // Signals
    LOW_SIGNAL_CONFIDENCE: 'Signal confidence is low',
    CONFLICTING_SIGNALS: 'Conflicting signals detected',
    SIGNAL_FREQUENCY_HIGH: 'Signal generation frequency is high',

    // Risk
    RISK_EXPOSURE_HIGH: 'Risk exposure is high',
    DRAWDOWN_WARNING: 'Drawdown threshold approaching',
    CORRELATION_HIGH: 'High correlation between positions detected',

    // Configuration
    USING_DEFAULT_CONFIG: 'Using default configuration values',
    CONFIG_DEPRECATED: 'Configuration option is deprecated',
    SANDBOX_MODE_ACTIVE: 'Running in sandbox/test mode'
} as const;

export const INFO_MESSAGES = {
    // Startup
    APPLICATION_STARTING: 'Application is starting up',
    APPLICATION_READY: 'Application is ready',
    APPLICATION_SHUTTING_DOWN: 'Application is shutting down',

    // Exchange
    EXCHANGE_INITIALIZING: 'Initializing exchange connection',
    EXCHANGE_READY: 'Exchange is ready for trading',
    MARKET_DATA_SYNCING: 'Syncing market data',

    // Trading
    MONITORING_MARKETS: 'Monitoring markets for opportunities',
    SIGNAL_ANALYSIS_STARTED: 'Signal analysis started',
    POSITION_OPENED: 'Position opened',
    POSITION_CLOSED: 'Position closed',

    // Maintenance
    HEALTH_CHECK_PASSED: 'Health check passed',
    CLEANUP_STARTED: 'Cleanup process started',
    BACKUP_CREATED: 'Backup created successfully',

    // Configuration
    CONFIG_RELOADED: 'Configuration reloaded',
    NEW_STRATEGY_LOADED: 'New trading strategy loaded',
    PAIR_ADDED: 'Trading pair added',
    PAIR_REMOVED: 'Trading pair removed'
} as const;
