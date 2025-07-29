module.exports = {
    exchange: {
        name: 'bybit',
        sandbox: false,
        enableRateLimit: true,
        apiKey: process.env.BYBIT_API_KEY,
        secretKey: process.env.BYBIT_SECRET,
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
    },

    timeframes: {
        // Оберіть ОДИН з варіантів:
        scalping: {
            primary: process.env.SCALPING_TIMEFRAME,        // Основний аналіз
            dataPoints: 200,      // Більше даних для точності
            updateInterval: process.env.SCALPING_UPDATE_INTERVAL, // 15 секунд
            signalCooldown: process.env.SCALPING_SIGNAL_COOLDOWN, // 5 хвилин
            expectedSignals: '8-15 на день'
        },

        intraday: {
            primary: process.env.INTRADAY_TIMEFRAME,       // Основний аналіз
            dataPoints: 100,      // 25 годин історії
            updateInterval: process.env.INTRADAY_UPDATE_INTERVAL, // 30 секунд
            signalCooldown: process.env.INTRADAY_SIGNAL_COOLDOWN, // 10 хвилин
            expectedSignals: '3-8 на день'
        },

        swing: {
            primary: '1h',        // Основний аналіз
            dataPoints: 168,      // Тиждень історії
            updateInterval: 300000, // 5 хвилин
            signalCooldown: 60 * 60 * 1000, // 1 година
            expectedSignals: '1-3 на день'
        },

        position: {
            primary: '4h',        // Основний аналіз
            dataPoints: 180,      // Місяць історії
            updateInterval: 900000, // 15 хвилин
            signalCooldown: 4 * 60 * 60 * 1000, // 4 години
            expectedSignals: '2-5 на тиждень'
        }
    },

    activeProfile: process.env.TRADING_MODE,
    mode: process.env.BOT_MODE,

    tradingPairs: {
        crypto: [
            'BTC/USDT',   // Біткоїн - король крипто
            'ETH/USDT',   // Ефіріум - найліквідніший альткоїн
            'SOL/USDT',   // Солана - високоволатильна
            'BNB/USDT',   // Binance Coin
            'ADA/USDT',   // Cardano
            'DOT/USDT',   // Polkadot
            'AVAX/USDT',  // Avalanche
            'MATIC/USDT'  // Polygon
        ],

        defi: [
            'UNI/USDT',   // Uniswap
            'LINK/USDT',  // Chainlink
            'AAVE/USDT',  // Aave
            'COMP/USDT',  // Compound
            'SUSHI/USDT', // SushiSwap
            'CRV/USDT'    // Curve
        ],

        meme: [
            'DOGE/USDT',  // Dogecoin
            'SHIB/USDT',  // Shiba Inu
            'PEPE/USDT',  // Pepe
            'FLOKI/USDT'  // Floki
        ],

        traditional: [
            'GOLD/USDT',  // Золото
            'SILVER/USDT', // Срібло
            'OIL/USDT'    // Нафта
        ]
    },

    activePair: 'SOL/USDT',

    strategies: {
        '1m': {
            ema: { short: 3, medium: 7, long: 14 },
            rsi: { period: 9, oversold: 25, overbought: 75 },
            volume: { threshold: 2.0 },
            risk: { stopLoss: 0.008, takeProfits: [0.005, 0.01, 0.015] }
        },
        '5m': {
            ema: { short: 5, medium: 12, long: 21 },
            rsi: { period: 12, oversold: 30, overbought: 70 },
            volume: { threshold: 1.8 },
            risk: { stopLoss: 0.012, takeProfits: [0.008, 0.015, 0.025] }
        },
        '15m': {
            ema: { short: 7, medium: 14, long: 21 },
            rsi: { period: 14, oversold: 30, overbought: 70 },
            volume: { threshold: 1.5 },
            risk: { stopLoss: 0.015, takeProfits: [0.01, 0.02, 0.035] }
        },
        '1h': {
            ema: { short: 9, medium: 21, long: 50 },
            rsi: { period: 14, oversold: 35, overbought: 65 },
            volume: { threshold: 1.3 },
            risk: { stopLoss: 0.025, takeProfits: [0.015, 0.03, 0.05] }
        },
        '4h': {
            ema: { short: 12, medium: 26, long: 50 },
            rsi: { period: 14, oversold: 40, overbought: 60 },
            volume: { threshold: 1.2 },
            risk: { stopLoss: 0.035, takeProfits: [0.025, 0.05, 0.08] }
        }
    },

    getCurrentConfig() {
        const profile = this.timeframes[this.activeProfile];
        const strategy = this.strategies[profile.primary];

        return {
            exchange: this.exchange,
            pair: this.activePair,
            watchesPairs: this.tradingPairs,
            tradingMode: this.activeProfile,
            mode: this.mode,
            timeframe: profile.primary,
            updateInterval: profile.updateInterval,
            signalCooldown: profile.signalCooldown,
            dataPoints: profile.dataPoints,
            strategy: strategy,
            expectedSignals: profile.expectedSignals
        };
    }
};
