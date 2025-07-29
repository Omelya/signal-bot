require('dotenv').config();
const colors = require('colors');
const ccxt = require('ccxt');
const config = require('./config');

const PairManager = require('./pairManager');
const TechnicalIndicators = require('./indicators');
const TelegramBot = require('./telegramBot');

class UniversalSignalBot {
    constructor() {
        this.config = config.getCurrentConfig();

        this.exchange = new ccxt[this.config.exchange.name](this.config.exchange);

        this.pairManager = new PairManager();
        this.telegramBot = new TelegramBot();

        // Стан бота
        this.isRunning = false;
        this.activePairs = new Map();
        this.lastSignalTimes = new Map();

        console.log('🤖 Universal Signal Bot ініціалізовано!'.green.bold);
        this.printWelcome();
    }

    printWelcome() {
        console.log('\n╔═══════════════════════════════════════╗'.cyan);
        console.log('║        🤖 UNIVERSAL SIGNAL BOT        ║'.cyan.bold);
        console.log('╠═══════════════════════════════════════╣'.cyan);
        console.log(`║ Режим: ${this.config.tradingMode.toUpperCase()}`.padEnd(40) + '║'.cyan);

        if (this.config.mode === 'single') {
            console.log(`║ Пара: ${this.config.pair}`.padEnd(40) + '║'.cyan);
            console.log(`║ Таймфрейм: ${this.config.timeframe}`.padEnd(40) + '║'.cyan);
        } else {
            console.log(`║ Пар: ${this.config.watchesPairs.length}`.padEnd(40) + '║'.cyan);
        }

        console.log('╚═══════════════════════════════════════╝'.cyan);
    }

    async initialize() {
        try {
            console.log('\n🔄 Ініціалізація...'.yellow);

            // Підключення до біржі
            await this.exchange.loadMarkets();
            console.log('✅ Підключення до біржі успішне'.green);

            // Ініціалізація активних пар
            await this.initializeActivePairs();

            // Тест Telegram
            const welcomeMsg = this.formatWelcomeMessage();
            await this.telegramBot.sendMessage(welcomeMsg);
            console.log('✅ Telegram бот активний'.green);

            return true;
        } catch (error) {
            console.error('❌ Помилка ініціалізації:'.red, error.message);
            return false;
        }
    }

    async initializeActivePairs() {
        this.activePairs.clear();
        this.lastSignalTimes.clear();

        const mode = this.config.mode;

        switch (mode) {
            case 'single':
                await this.initializeSinglePair();
                break;

            case 'multi':
                await this.initializeMultiPairs();
                break;

            case 'auto':
                await this.initializeAutoPairs();
                break;

            default:
                throw new Error(`Невідомий режим: ${mode}`);
        }

        console.log(`✅ Ініціалізовано ${this.activePairs.size} торгових пар`.green);
    }

    async initializeSinglePair() {
        const pair = this.config.pair;
        const timeframe = this.config.timeframe;

        const validation = await this.pairManager.validatePair(pair, this.exchange);

        if (!validation.isValid) {
            throw new Error(`Пара ${pair} не пройшла валідацію: ${validation.error}`);
        }

        const strategy = this.pairManager.adaptStrategy(
            this.config.strategy,
            pair,
        );

        this.activePairs.set(pair, {
            timeframe,
            strategy: strategy.strategy,
            minSignalStrength: strategy.minSignalStrength,
            category: strategy.category,
            settings: validation.settings,
        });

        this.lastSignalTimes.set(pair, 0);

        console.log(`📊 ${pair} (${timeframe}) - ${validation.recommendation}`.cyan);
    }

    async initializeMultiPairs() {
        const pairs = this.config.watchesPairs;
        const timeframe = this.config.timeframe;

        for (const pair of pairs) {
            try {
                const validation = await this.pairManager.validatePair(pair, this.exchange);
                if (validation.isValid) {
                    const strategy = this.pairManager.adaptStrategy(
                        this.config.strategy,
                        pair,
                    );

                    this.activePairs.set(pair, {
                        timeframe,
                        strategy: strategy.strategy,
                        minSignalStrength: strategy.minSignalStrength,
                        category: strategy.category,
                        settings: validation.settings
                    });

                    this.lastSignalTimes.set(pair, 0);
                    console.log(`📊 ${pair} - ${validation.recommendation}`.cyan);
                } else {
                    console.log(`⚠️ Пропускаю ${pair}: ${validation.error}`.yellow);
                }

                await this.sleep(200);
            } catch (error) {
                console.error(`❌ Помилка з ${pair}:`.red, error.message);
            }
        }
    }

    async initializeAutoPairs() {
        console.log('🔍 Автопошук найкращих пар...'.yellow);

        //TODO need fix
        const bestPairs = await this.pairManager.findBestPairs(
            this.exchange,
            this.config.watchesPairs.length,
        );

        const timeframe = this.config.timeframe;

        for (const pairInfo of bestPairs) {
            const strategy = this.pairManager.adaptStrategy(
                this.config.strategies[timeframe],
                pairInfo.symbol
            );

            this.activePairs.set(pairInfo.symbol, {
                timeframe,
                strategy: strategy.strategy,
                minSignalStrength: strategy.minSignalStrength,
                category: strategy.category,
                score: pairInfo.score
            });

            this.lastSignalTimes.set(pairInfo.symbol, 0);
            console.log(`🏆 ${pairInfo.symbol} (score: ${pairInfo.score}) - ${pairInfo.category}`.green);
        }
    }

    formatWelcomeMessage() {
        const mode = this.config.tradingMode.toUpperCase();
        const timeframe = this.config.timeframe;
        const pairCount = this.activePairs.size;

        let pairsList = '';
        for (const [pair, config] of this.activePairs) {
            pairsList += `• ${pair} (${config.category})\n`;
        }

        return `
            🤖 <b>UNIVERSAL SIGNAL BOT ЗАПУЩЕНО!</b>
            
            ⚙️ <b>КОНФІГУРАЦІЯ:</b>
            • Режим: ${mode}
            • Таймфрейм: ${timeframe}
            • Активних пар: ${pairCount}
            
            📊 <b>ВІДСТЕЖУВАНІ ПАРИ:</b>
            ${pairsList}
            ⏰ ${new Date().toLocaleString('uk-UA')}
            
            🎯 Готовий до моніторингу ринку!
        `.trim();
    }

    async getMarketData(symbol, timeframe, limit) {
        try {
            const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
            return ohlcv.map(candle => ({
                timestamp: candle[0],
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5]
            }));
        } catch (error) {
            console.error(`❌ Помилка отримання даних ${symbol}:`.red, error.message);
            return null;
        }
    }

    analyzeMarket(candles, strategy) {
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // Розрахунок індикаторів
        const ema7 = TechnicalIndicators.calculateEMA(closes, strategy.ema.short);
        const ema14 = TechnicalIndicators.calculateEMA(closes, strategy.ema.medium);
        const ema21 = TechnicalIndicators.calculateEMA(closes, strategy.ema.long);
        const rsi = TechnicalIndicators.calculateRSI(closes, strategy.rsi.period);
        const { macdLine, signalLine } = TechnicalIndicators.calculateMACD(closes);
        const bb = TechnicalIndicators.calculateBollingerBands(closes);

        // Об'єм аналіз
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;

        const current = candles[candles.length - 1];

        return {
            price: {
                current: closes[closes.length - 1],
                high: current.high,
                low: current.low,
                open: current.open,
                close: current.close
            },
            indicators: {
                ema7: ema7[ema7.length - 1],
                ema14: ema14[ema14.length - 1],
                ema21: ema21[ema21.length - 1],
                rsi: rsi[rsi.length - 1],
                macd: macdLine[macdLine.length - 1],
                macdSignal: signalLine[signalLine.length - 1],
                bbUpper: bb.upper[bb.upper.length - 1],
                bbMiddle: bb.middle[bb.middle.length - 1],
                bbLower: bb.lower[bb.lower.length - 1]
            },
            volume: {
                current: current.volume,
                average: avgVolume,
                ratio: current.volume / avgVolume
            },
            candle: {
                isBullish: current.close > current.open,
                isBearish: current.close < current.open,
                bodySize: Math.abs(current.close - current.open)
            }
        };
    }

    generateSignal(analysis, strategy, minStrength, pair) {
        const { price, indicators, volume, candle } = analysis;

        // SHORT умови
        const shortConditions = {
            priceAtResistance: Math.abs(price.current - indicators.ema7) < 2.0 &&
                price.current <= indicators.ema7,
            rsiNeutral: indicators.rsi > 35 && indicators.rsi < 65,
            macdBearish: indicators.macd < indicators.macdSignal,
            volumeConfirmation: volume.ratio > strategy.volume.threshold,
            bearishCandle: candle.isBearish,
            belowMediumTrend: price.current < indicators.ema14,
            nearBBUpper: price.current > indicators.bbMiddle
        };

        // LONG умови
        const longConditions = {
            rsiOversold: indicators.rsi < 40,
            macdBullish: indicators.macd > indicators.macdSignal,
            volumeConfirmation: volume.ratio > strategy.volume.threshold * 1.2,
            bullishCandle: candle.isBullish,
            aboveMediumTrend: price.current > indicators.ema14,
            nearBBLower: price.current < indicators.bbMiddle,
            bounceFromSupport: price.low < indicators.bbLower && price.close > indicators.bbLower
        };

        const shortScore = Object.values(shortConditions).filter(Boolean).length;
        const longScore = Object.values(longConditions).filter(Boolean).length;

        // Перевірка мінімальної сили сигналу
        if (shortScore >= minStrength) {
            return this.createSignal('SHORT', analysis, shortConditions, shortScore, strategy, pair);
        }

        if (longScore >= minStrength - 1) { // LONG трохи м'якші умови
            return this.createSignal('LONG', analysis, longConditions, longScore, strategy, pair);
        }

        return null;
    }

    createSignal(direction, analysis, conditions, score, strategy, pair) {
        const { price } = analysis;
        const isShort = direction === 'SHORT';

        const signal = {
            pair,
            direction,
            timestamp: Date.now(),
            entry: price.current,
            confidence: Math.min(score * 1.5, 10),
            reasoning: Object.keys(conditions).filter(key => conditions[key])
        };

        if (isShort) {
            signal.stopLoss = price.current * (1 + strategy.risk.stopLoss);
            signal.targets = strategy.risk.takeProfits.map(tp =>
                price.current * (1 - tp)
            );
        } else {
            signal.stopLoss = price.current * (1 - strategy.risk.stopLoss);
            signal.targets = strategy.risk.takeProfits.map(tp =>
                price.current * (1 + tp)
            );
        }

        return signal;
    }

    shouldSendSignal(pair) {
        const lastTime = this.lastSignalTimes.get(pair) || 0;
        const currentTime = Date.now();
        return currentTime - lastTime > this.config.signalCooldown;
    }

    async processSignal(signal) {
        if (!signal) return;

        const pairConfig = this.activePairs.get(signal.pair);
        console.log(`\n🔥 ${signal.direction} СИГНАЛ - ${signal.pair}!`.yellow.bold);
        console.log(`Category: ${pairConfig.category}`.magenta);
        console.log(`Entry: $${signal.entry.toFixed(4)}`.cyan);
        console.log(`Confidence: ${signal.confidence.toFixed(1)}/10`.green);

        // Відправка в Telegram
        const sent = await this.telegramBot.sendSignal(signal);
        if (sent) {
            this.lastSignalTimes.set(signal.pair, Date.now());
            console.log('✅ Сигнал відправлено в Telegram'.green);
        }
    }

    async run() {
        if (this.isRunning) {
            console.log('⚠️ Бот вже запущено!'.yellow);
            return;
        }

        const initialized = await this.initialize();
        if (!initialized) {
            console.log('❌ Не вдалося ініціалізувати бот'.red);
            return;
        }

        this.isRunning = true;
        console.log('\n🚀 Починаю моніторинг ринку...'.green.bold);
        console.log('Натисніть Ctrl+C для зупинки\n'.gray);

        let cycleCount = 0;

        while (this.isRunning) {
            try {
                for (const [pair, pairConfig] of this.activePairs) {
                    try {
                        const candles = await this.getMarketData(
                            pair,
                            pairConfig.timeframe,
                            this.config.dataPoints,
                        );

                        if (!candles || candles.length < 50) {
                            console.log(`⚠️ Недостатньо даних для ${pair}`.yellow);
                            continue;
                        }

                        // Аналіз ринку
                        const analysis = this.analyzeMarket(candles, pairConfig.strategy);

                        // Логування кожні 20 циклів
                        if (cycleCount % 20 === 0) {
                            const time = new Date().toLocaleTimeString('uk-UA');
                            console.log(
                                `⏰ ${time} | `.gray +
                                `${pair}: $${analysis.price.current.toFixed(4)} | `.yellow +
                                `RSI: ${analysis.indicators.rsi?.toFixed(1) || 'N/A'} | `.cyan +
                                `Vol: ${(analysis.volume.ratio * 100).toFixed(0)}%`.magenta
                            );
                        }

                        if (this.shouldSendSignal(pair)) {
                            const signal = this.generateSignal(
                                analysis,
                                pairConfig.strategy,
                                pairConfig.minSignalStrength,
                                pair,
                            );

                            await this.processSignal(signal);
                        }

                        await this.sleep(100);
                    } catch (pairError) {
                        console.error(`❌ Помилка з ${pair}:`.red, pairError.message);
                    }
                }

                cycleCount++;

                await this.sleep(this.config.updateInterval);
            } catch (error) {
                console.error('❌ Помилка в головному циклі:'.red, error.message);
                await this.sleep(60000); // 1 хвилина при помилці
            }
        }

        console.log('\n🛑 Бот зупинено'.red.bold);
    }

    stop() {
        this.isRunning = false;
        console.log('\n⏳ Зупинка бота...'.yellow);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Обробка сигналів системи
process.on('SIGINT', () => {
    console.log('\n\n🛑 Отримано сигнал зупинки...'.yellow);
    if (global.bot) {
        global.bot.stop();
    } else {
        process.exit(0);
    }
});

// Запуск бота
async function main() {
    console.log('🚀 Запуск Universal Signal Bot...'.blue.bold);
    console.log('═'.repeat(60).blue);

    global.bot = new UniversalSignalBot();
    await global.bot.run();
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 Фатальна помилка:'.red.bold, error);
        process.exit(1);
    });
}

module.exports = UniversalSignalBot;
