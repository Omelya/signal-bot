import {PairCategory} from "../types/Pair.types";

export const TRADING_CONSTANTS = {
    // Signal constraints
    MAX_TAKE_PROFIT_LEVELS: 5,
    MIN_CONFIDENCE_SCORE: 1,
    MAX_CONFIDENCE_SCORE: 10,

    // Risk management
    MAX_RISK_PER_TRADE: 10, // 10% of account
    MIN_RISK_REWARD_RATIO: 1,
    DEFAULT_STOP_LOSS: 0.02, // 2%

    // Strategy parameters
    MIN_CANDLES_FOR_ANALYSIS: 50,
    MAX_CANDLES_HISTORY: 1000,
    DEFAULT_RSI_PERIOD: 14,
    DEFAULT_RSI_OVERSOLD: 30,
    DEFAULT_RSI_OVERBOUGHT: 70,

    // Exchange limits
    MAX_RETRIES: 3,
    REQUEST_TIMEOUT: 30000, // 30 seconds
    MIN_ORDER_SIZE: 0.00001,

    // Time intervals
    SIGNAL_COOLDOWN_DEFAULT: 5 * 60 * 1000, // 5 minutes
    MARKET_DATA_REFRESH: 30 * 1000, // 30 seconds
    HEALTH_CHECK_INTERVAL: 60 * 1000, // 1 minute

    // Performance thresholds
    MIN_SUCCESS_RATE: 40, // 40%
    EXCELLENT_SUCCESS_RATE: 70, // 70%
    MIN_HEALTH_SCORE: 70,

    // Pair categories risk multipliers
    RISK_MULTIPLIERS: {
        [PairCategory.CRYPTO_MAJOR]: 1.0,
        [PairCategory.CRYPTO_ALT]: 1.2,
        [PairCategory.DEFI]: 1.5,
        [PairCategory.MEME]: 2.0,
        [PairCategory.STABLECOIN]: 0.5,
        [PairCategory.TRADITIONAL]: 0.8
    },

    // Volume thresholds by category
    MIN_VOLUME_THRESHOLDS: {
        [PairCategory.CRYPTO_MAJOR]: 100_000_000, // $100M
        [PairCategory.CRYPTO_ALT]: 50_000_000,    // $50M
        [PairCategory.DEFI]: 10_000_000,          // $10M
        [PairCategory.MEME]: 5_000_000,           // $5M
        [PairCategory.STABLECOIN]: 200_000_000,   // $200M
        [PairCategory.TRADITIONAL]: 50_000_000    // $50M
    }
} as const;
