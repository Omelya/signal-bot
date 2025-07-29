export const EVENT_TYPES = {
    // Signal events
    SIGNAL_GENERATED: 'signal.generated',
    SIGNAL_SENT: 'signal.sent',
    SIGNAL_EXECUTED: 'signal.executed',
    SIGNAL_FAILED: 'signal.failed',
    SIGNAL_CANCELLED: 'signal.cancelled',

    // Market data events
    MARKET_DATA_UPDATED: 'market_data.updated',
    MARKET_DATA_ERROR: 'market_data.error',
    MARKET_ANALYSIS_COMPLETED: 'market_analysis.completed',
    MARKET_CONDITION_CHANGED: 'market_condition.changed',

    // Exchange events
    EXCHANGE_CONNECTED: 'exchange.connected',
    EXCHANGE_DISCONNECTED: 'exchange.disconnected',
    EXCHANGE_ERROR: 'exchange.error',
    EXCHANGE_RATE_LIMITED: 'exchange.rate_limited',
    EXCHANGE_MAINTENANCE: 'exchange.maintenance',

    // Trading pair events
    PAIR_ADDED: 'pair.added',
    PAIR_REMOVED: 'pair.removed',
    PAIR_ACTIVATED: 'pair.activated',
    PAIR_DEACTIVATED: 'pair.deactivated',
    PAIR_UPDATED: 'pair.updated',

    // Strategy events
    STRATEGY_LOADED: 'strategy.loaded',
    STRATEGY_UPDATED: 'strategy.updated',
    STRATEGY_OPTIMIZED: 'strategy.optimized',
    STRATEGY_BACKTEST_COMPLETED: 'strategy.backtest_completed',

    // Bot lifecycle events
    BOT_STARTING: 'bot.starting',
    BOT_STARTED: 'bot.started',
    BOT_STOPPING: 'bot.stopping',
    BOT_STOPPED: 'bot.stopped',
    BOT_ERROR: 'bot.error',
    BOT_HEALTH_CHECK: 'bot.health_check',

    // Configuration events
    CONFIG_LOADED: 'config.loaded',
    CONFIG_UPDATED: 'config.updated',
    CONFIG_VALIDATED: 'config.validated',
    CONFIG_ERROR: 'config.error',

    // Notification events
    NOTIFICATION_SENT: 'notification.sent',
    NOTIFICATION_FAILED: 'notification.failed',
    NOTIFICATION_DELIVERED: 'notification.delivered',

    // Risk management events
    RISK_LIMIT_EXCEEDED: 'risk.limit_exceeded',
    EMERGENCY_STOP_TRIGGERED: 'risk.emergency_stop',
    DRAWDOWN_WARNING: 'risk.drawdown_warning',
    POSITION_SIZE_WARNING: 'risk.position_size_warning',

    // Performance events
    PERFORMANCE_METRIC_UPDATED: 'performance.metric_updated',
    HIGH_LATENCY_DETECTED: 'performance.high_latency',
    MEMORY_WARNING: 'performance.memory_warning',
    CPU_WARNING: 'performance.cpu_warning',

    // System events
    SYSTEM_STARTUP: 'system.startup',
    SYSTEM_SHUTDOWN: 'system.shutdown',
    SYSTEM_ERROR: 'system.error',
    SYSTEM_HEALTH_CHECK: 'system.health_check',
    SYSTEM_MAINTENANCE: 'system.maintenance'
} as const;
