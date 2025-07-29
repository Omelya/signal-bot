class PairManager {
    constructor() {
        this.pairSettings = new Map();
        this.initializePairSettings();
    }

    initializePairSettings() {
        this.pairSettings.set('BTC/USDT', {
            category: 'crypto_major',
            minVolume: 100000000,    // $100M мінімальний об'єм
            volatilityMultiplier: 0.8, // Менш волатильний
            riskAdjustment: 0.9,     // Менший ризик
            signalStrength: 7,       // Потрібно 7+ підтверджень
            spreadTolerance: 0.001,  // 0.1% спред
            specialRules: {
                // BTC рухається повільніше - більші стоп-лоси
                stopLossMultiplier: 1.2,
                takeProfitMultiplier: 1.1,
                volumeWeight: 1.5 // Об'єм важливіший для BTC
            }
        });

        this.pairSettings.set('ETH/USDT', {
            category: 'crypto_major',
            minVolume: 50000000,     // $50M
            volatilityMultiplier: 1.0, // Стандартна волатильність
            riskAdjustment: 1.0,
            signalStrength: 6,
            spreadTolerance: 0.002,
            specialRules: {
                stopLossMultiplier: 1.0,
                takeProfitMultiplier: 1.0,
                volumeWeight: 1.3
            }
        });

        this.pairSettings.set('SOL/USDT', {
            category: 'crypto_alt',
            minVolume: 20000000,     // $20M
            volatilityMultiplier: 1.3, // Більш волатильна
            riskAdjustment: 1.1,     // Трохи більший ризик
            signalStrength: 5,       // Менше підтверджень
            spreadTolerance: 0.003,
            specialRules: {
                stopLossMultiplier: 0.9, // Менші стоп-лоси (швидші рухи)
                takeProfitMultiplier: 1.2, // Більші цілі
                volumeWeight: 1.8 // Об'єм дуже важливий для альткоїнів
            }
        });

        ['UNI/USDT', 'LINK/USDT', 'AAVE/USDT'].forEach(pair => {
            this.pairSettings.set(pair, {
                category: 'defi',
                minVolume: 10000000,     // $10M
                volatilityMultiplier: 1.5, // Високоволатільні
                riskAdjustment: 1.3,
                signalStrength: 4,       // Швидкі сигнали
                spreadTolerance: 0.005,
                specialRules: {
                    stopLossMultiplier: 0.8,
                    takeProfitMultiplier: 1.4,
                    volumeWeight: 2.0,
                    // Особливі умови для DeFi
                    avoidWeekends: true, // Менше об'ємів на вихідних
                    newsFilter: true     // Реагують на DeFi новини
                }
            });
        });

        ['DOGE/USDT', 'SHIB/USDT', 'PEPE/USDT'].forEach(pair => {
            this.pairSettings.set(pair, {
                category: 'meme',
                minVolume: 5000000,      // $5M
                volatilityMultiplier: 2.0, // Дуже волатільні
                riskAdjustment: 1.5,     // Високий ризик
                signalStrength: 3,       // Мінімум підтверджень
                spreadTolerance: 0.01,   // Великі спреди
                specialRules: {
                    stopLossMultiplier: 0.6, // Дуже малі стоп-лоси
                    takeProfitMultiplier: 2.0, // Великі цілі
                    volumeWeight: 3.0,
                    // Meme coin особливості
                    socialSentiment: true,    // Залежать від соцмереж
                    pumpDetection: true,      // Детекція пампів
                    maxPositionTime: 30       // Максимум 30 хвилин у позиції
                }
            });
        });
    }

    getPairSettings(symbol) {
        return this.pairSettings.get(symbol) || this.getDefaultSettings();
    }

    getDefaultSettings() {
        return {
            category: 'unknown',
            minVolume: 1000000,
            volatilityMultiplier: 1.0,
            riskAdjustment: 1.0,
            signalStrength: 5,
            spreadTolerance: 0.005,
            specialRules: {
                stopLossMultiplier: 1.0,
                takeProfitMultiplier: 1.0,
                volumeWeight: 1.0
            }
        };
    }

    adaptStrategy(baseStrategy, symbol) {
        const pairSettings = this.getPairSettings(symbol);
        const adapted = JSON.parse(JSON.stringify(baseStrategy)); // Deep copy

        adapted.risk.stopLoss *= pairSettings.specialRules.stopLossMultiplier;
        adapted.risk.takeProfits = adapted.risk.takeProfits.map(tp =>
            tp * pairSettings.specialRules.takeProfitMultiplier
        );

        adapted.volume.threshold *= pairSettings.specialRules.volumeWeight;

        if (pairSettings.volatilityMultiplier > 1.2) {
            adapted.rsi.oversold -= 5;
            adapted.rsi.overbought += 5;
        }

        return {
            strategy: adapted,
            minSignalStrength: pairSettings.signalStrength,
            category: pairSettings.category
        };
    }

    async validatePair(symbol, exchange) {
        try {
            const ticker = await exchange.fetchTicker(symbol);
            const pairSettings = this.getPairSettings(symbol);

            const checks = {
                volumeCheck: ticker.quoteVolume >= pairSettings.minVolume,
                spreadCheck: (ticker.ask - ticker.bid) / ticker.last <= pairSettings.spreadTolerance,
                priceCheck: ticker.last > 0.01, // Мінімальна ціна
                availabilityCheck: ticker.symbol === symbol
            };

            const isValid = Object.values(checks).every(check => check);

            return {
                isValid,
                checks,
                recommendation: this.getRecommendation(checks, pairSettings.category),
                settings: pairSettings
            };

        } catch (error) {
            console.error(`❌ Помилка валідації ${symbol}:`, error.message);
            return { isValid: false, error: error.message };
        }
    }

    getRecommendation(checks, category) {
        if (!checks.volumeCheck) return `⚠️ Низький об'єм для ${category}`;
        if (!checks.spreadCheck) return `⚠️ Великий спред для ${category}`;

        const recommendations = {
            'crypto_major': '✅ Відмінно для стабільної торгівлі',
            'crypto_alt': '✅ Добре для середнього ризику',
            'defi': '⚠️ Високий ризик, стежте за новинами',
            'meme': '🚨 Дуже високий ризик, малі позиції!',
            'unknown': '❓ Невідома пара, будьте обережні'
        };

        return recommendations[category] || recommendations['unknown'];
    }

    async findBestPairs(exchange, maxPairs = 5) {
        console.log('🔍 Пошук найкращих торгових пар...');

        const allPairs = [...this.pairSettings.keys()];
        const validatedPairs = [];

        for (const pair of allPairs) {
            const validation = await this.validatePair(pair, exchange);
            if (validation.isValid) {
                validatedPairs.push({
                    symbol: pair,
                    category: validation.settings.category,
                    score: this.calculatePairScore(validation)
                });
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        validatedPairs.sort((a, b) => b.score - a.score);

        return validatedPairs.slice(0, maxPairs);
    }

    calculatePairScore(validation) {
        let score = 0;

        const categoryScores = {
            'crypto_major': 10,
            'crypto_alt': 8,
            'defi': 6,
            'meme': 4,
            'unknown': 2
        };

        score += categoryScores[validation.settings.category] || 0;

        score += Object.values(validation.checks).filter(Boolean).length * 2;

        return score;
    }
}

module.exports = PairManager;
