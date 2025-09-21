import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');
    console.log('📊 Creating exchanges...');

    const bybitExchange = await prisma.exchange.upsert({
        where: { type: 'bybit' },
        update: {},
        create: {
            type: 'bybit',
            name: 'bybit',
            api_key: process.env.BYBIT_API_KEY as string,
            secret_key: process.env.BYBIT_SECRET as string,
            sandbox: process.env.BYBIT_SANDBOX === 'true' || false,
            timeout: parseInt(process.env.BYBIT_TIMEOUT || '30000'),
            rate_limit_remaining: 1200,
            supported_timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
            max_candle_history: 1000,
            rate_limits: {
                requestsPerSecond: 10,
                requestsPerMinute: 600,
                requestsPerHour: 36000,
                weightPerRequest: 1,
                maxWeight: 1200
            },
            supportedOrderTypes: ['market', 'limit', 'stop', 'stop_limit'],
            supports_futures: true,
            supports_margin: true,
            supports_spot: true,
            min_order_size: 0.0001,
            max_order_size: 1000000,
            trading_fees: {
                maker: 0.001,
                taker: 0.001,
                withdrawal: {
                    'BTC': 0.0005,
                    'ETH': 0.01,
                    'USDT': 1.0
                }
            }
        }
    });

    const binanceExchange = await prisma.exchange.upsert({
        where: { type: 'binance' },
        update: {},
        create: {
            type: 'binance',
            name: 'binance',
            api_key: process.env.BINANCE_API_KEY as string,
            secret_key: process.env.BINANCE_SECRET as string,
            sandbox: process.env.BINANCE_SANDBOX === 'true' || false,
            timeout: parseInt(process.env.BINANCE_TIMEOUT || '30000'),
            rate_limit_remaining: 1200,
            supported_timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
            max_candle_history: 1500,
            rate_limits: {
                requestsPerSecond: 10,
                requestsPerMinute: 1200,
                requestsPerHour: 72000,
                weightPerRequest: 1,
                maxWeight: 1200
            },
            supportedOrderTypes: ['market', 'limit', 'stop_loss', 'stop_loss_limit'],
            supports_futures: true,
            supports_margin: true,
            supports_spot: true,
            min_order_size: 0.00001,
            max_order_size: 9000000,
            trading_fees: {
                maker: 0.001,
                taker: 0.001,
                withdrawal: {
                    'BTC': 0.0005,
                    'ETH': 0.005,
                    'USDT': 1.0
                }
            }
        }
    });

    console.log(`✅ Created exchanges: ${bybitExchange.name}, ${binanceExchange.name}`);
    console.log('🎯 Creating strategies...');

    const swingStrategy = await prisma.strategy.upsert({
        where: { name: 'Swing Trading' },
        update: {},
        create: {
            name: 'Swing Trading',
            description: 'Medium-term trading strategy for 1-4 hour timeframes',
            type: 'SWING',
            timeframe: '1h',
            indicators: {
                ema: {
                    short: 9,
                    medium: 21,
                    long: 50
                },
                rsi: {
                    period: 14,
                    oversold: 35,
                    overbought: 65
                },
                macd: {
                    fastPeriod: 12,
                    slowPeriod: 26,
                    signalPeriod: 9
                },
                bollingerBands: {
                    period: 20,
                    standardDeviation: 2
                },
                volume: {
                    threshold: 1.3,
                    period: 20
                }
            },
            risk_management: {
                stopLoss: 0.025,
                takeProfits: [0.03, 0.04, 0.05],
                maxRiskPerTrade: 2,
                riskRewardRatio: 2.5
            },
            signal_conditions: {
                bullish: {
                    primary: [
                        'rsi_oversold',
                        'price_above_ema_short',
                        'macd_bullish_crossover'
                    ],
                    secondary: [
                        'volume_above_threshold',
                        'price_near_bb_lower',
                        'bullish_candle_pattern'
                    ],
                    confirmation: [
                        'trend_alignment',
                        'support_level_hold'
                    ],
                    weight: 1.0
                },
                bearish: {
                    primary: [
                        'rsi_overbought',
                        'price_below_ema_short',
                        'macd_bearish_crossover'
                    ],
                    secondary: [
                        'volume_above_threshold',
                        'price_near_bb_upper',
                        'bearish_candle_pattern'
                    ],
                    confirmation: [
                        'trend_alignment',
                        'resistance_level_reject'
                    ],
                    weight: 1.0
                }
            },
            min_signal_strength: 6,
            max_simultaneous_signals: 6,
            is_active: true
        }
    });

    console.log(`✅ Created strategy: ${swingStrategy.name}`);
    console.log('💱 Creating trading pairs...');

    const tradingPairsData = [
        {
            symbol: "ADA/USDT",
            baseAsset: "ADA",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 6000000,
                volatilityMultiplier: 1,
                riskAdjustment: 1,
                signalStrength: 7,
                spreadTolerance: 0.0005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1,
                    takeProfitMultiplier: 1,
                    volumeWeight: 1.2,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: false,
                    pumpDetection: false,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "AVAX/USDT",
            baseAsset: "AVAX",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 6000000,
                volatilityMultiplier: 1,
                riskAdjustment: 1,
                signalStrength: 7,
                spreadTolerance: 0.0005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1,
                    takeProfitMultiplier: 1,
                    volumeWeight: 1.2,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: false,
                    pumpDetection: false,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "DOGE/USDT",
            baseAsset: "DOGE",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "meme",
            settings: {
                minVolume: 2400000,
                volatilityMultiplier: 2,
                riskAdjustment: 0.5,
                signalStrength: 9,
                spreadTolerance: 0.005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.5,
                    takeProfitMultiplier: 1.3,
                    volumeWeight: 2,
                    avoidWeekends: false,
                    newsFilter: false,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "ETH/USDT",
            baseAsset: "ETH",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "crypto_major",
            settings: {
                minVolume: 6000000,
                volatilityMultiplier: 1,
                riskAdjustment: 1,
                signalStrength: 7,
                spreadTolerance: 0.0005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1,
                    takeProfitMultiplier: 1,
                    volumeWeight: 1.2,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: false,
                    pumpDetection: false,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "PEPE/USDT",
            baseAsset: "PEPE",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "meme",
            settings: {
                minVolume: 2400000,
                volatilityMultiplier: 2,
                riskAdjustment: 0.5,
                signalStrength: 9,
                spreadTolerance: 0.005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.5,
                    takeProfitMultiplier: 1.3,
                    volumeWeight: 2,
                    avoidWeekends: false,
                    newsFilter: false,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "MNT/USDT",
            baseAsset: "MNT",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "BTC/USDT",
            baseAsset: "BTC",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "crypto_major",
            settings: {
                minVolume: 6000000,
                volatilityMultiplier: 1,
                riskAdjustment: 1,
                signalStrength: 7,
                spreadTolerance: 0.0005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1,
                    takeProfitMultiplier: 1,
                    volumeWeight: 1.2,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: false,
                    pumpDetection: false,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "BNB/USDT",
            baseAsset: "BNB",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "DOT/USDT",
            baseAsset: "DOT",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "SOL/USDT",
            baseAsset: "SOL",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "SHIB/USDT",
            baseAsset: "SHIB",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "meme",
            settings: {
                minVolume: 2400000,
                volatilityMultiplier: 2,
                riskAdjustment: 0.5,
                signalStrength: 9,
                spreadTolerance: 0.005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.5,
                    takeProfitMultiplier: 1.3,
                    volumeWeight: 2,
                    avoidWeekends: false,
                    newsFilter: false,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            },
        },
        {
            symbol: "XRP/USDT",
            baseAsset: "XRP",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "crypto_major",
            settings: {
                minVolume: 6000000,
                volatilityMultiplier: 1,
                riskAdjustment: 1,
                signalStrength: 7,
                spreadTolerance: 0.0005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1,
                    takeProfitMultiplier: 1,
                    volumeWeight: 1.2,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: false,
                    pumpDetection: false,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "LTC/USDT",
            baseAsset: "LTC",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_major",
            settings: {
                minVolume: 6000000,
                volatilityMultiplier: 1,
                riskAdjustment: 1,
                signalStrength: 7,
                spreadTolerance: 0.0005,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1,
                    takeProfitMultiplier: 1,
                    volumeWeight: 1.2,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: false,
                    pumpDetection: false,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "LINK/USDT",
            baseAsset: "LINK",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "OP/USDT",
            baseAsset: "OP",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "POL/USDT",
            baseAsset: "POL",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "AAVE/USDT",
            baseAsset: "AAVE",
            quoteAsset: "USDT",
            exchange: "bybit",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
        {
            symbol: "UNI/USDT",
            baseAsset: "UNI",
            quoteAsset: "USDT",
            exchange: "binance",
            category: "crypto_alt",
            settings: {
                minVolume: 1200000,
                volatilityMultiplier: 1.3,
                riskAdjustment: 0.8,
                signalStrength: 8,
                spreadTolerance: 0.002,
                signalCooldown: 600000,
                dataPoints: 100,
                timeframe: "15m",
                specialRules: {
                    stopLossMultiplier: 1.2,
                    takeProfitMultiplier: 1.1,
                    volumeWeight: 1,
                    avoidWeekends: false,
                    newsFilter: true,
                    socialSentiment: true,
                    pumpDetection: true,
                    maxPositionTime: 60
                }
            }
        },
    ];

    for (const pairData of tradingPairsData) {
        const exchange = pairData.exchange === 'bybit'
            ? bybitExchange
            : binanceExchange;

        const tradingPair = await prisma.tradingPair.upsert({
            where: {
                symbol_exchange_id: {
                    symbol: pairData.symbol,
                    exchange_id: exchange.id
                }
            },
            update: {},
            create: {
                symbol: pairData.symbol,
                base_asset: pairData.baseAsset,
                quote_asset: pairData.quoteAsset,
                exchange_id: exchange.id,
                strategy_id: swingStrategy.id,
                category: pairData.category,
                settings: pairData.settings,
                is_active: true,
                last_signal_time: 0,
                total_signals_generated: 0,
                successful_signals: 0,
                last_validation_time: 0
            }
        });

        console.log(`✅ Created trading pair: ${tradingPair.symbol} on ${exchange.name}`);
    }

    console.log('🤖 Creating initial bot status...');

    await prisma.botStatus.upsert({
        where: { bot_id: 'signal-bot-v2' },
        update: {},
        create: {
            bot_id: 'signal-bot-v2',
            version: '2.0.0',
            status: 'STOPPED',
            health_score: 100,
            today_signals_generated: 0,
            total_signals_generated: 0,
            error_count: 0,
            active_exchanges: [],
            active_pairs: [],
            configuration: {
                botMode: process.env.BOT_MODE || 'single',
                tradingMode: process.env.TRADING_MODE || 'intraday',
                activeExchange: process.env.ACTIVE_EXCHANGE || 'bybit',
                updateInterval: parseInt(process.env.UPDATE_INTERVAL || '30000'),
                maxConcurrentPairs: parseInt(process.env.MAX_CONCURRENT_PAIRS || '5')
            }
        }
    });

    console.log('✅ Created initial bot status');

    const summary = await prisma.$transaction([
        prisma.exchange.count(),
        prisma.strategy.count(),
        prisma.tradingPair.count(),
        prisma.market.count()
    ]);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('═'.repeat(50));
    console.log(`📊 Exchanges created: ${summary[0]}`);
    console.log(`🎯 Strategies created: ${summary[1]}`);
    console.log(`💱 Trading pairs created: ${summary[2]}`);
    console.log(`🏪 Markets created: ${summary[3]}`);
    console.log('═'.repeat(50));
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
