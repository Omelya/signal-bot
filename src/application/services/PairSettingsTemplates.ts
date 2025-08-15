import {IAppConfig, IPairSettings, PairCategory, TimeFrame} from "../../shared";
import {ITradingPairConfig} from "../usecases/ConfigureBotUseCase";

export class PairSettingsTemplates {
    private static readonly CATEGORY_TEMPLATES: Record<PairCategory, Partial<IPairSettings>> = {
        [PairCategory.CRYPTO_MAJOR]: {
            minVolume: 5000000,
            volatilityMultiplier: 1.0,
            riskAdjustment: 1.0,
            spreadTolerance: 0.0005,
            specialRules: {
                stopLossMultiplier: 1.0,
                takeProfitMultiplier: 1.0,
                volumeWeight: 1.2,
                avoidWeekends: false,
                newsFilter: true,
                socialSentiment: false,
                pumpDetection: false
            }
        },

        [PairCategory.CRYPTO_ALT]: {
            minVolume: 1000000,
            volatilityMultiplier: 1.3,
            riskAdjustment: 0.8,
            spreadTolerance: 0.002,
            specialRules: {
                stopLossMultiplier: 1.2,
                takeProfitMultiplier: 1.1,
                volumeWeight: 1.0,
                avoidWeekends: false,
                newsFilter: true,
                socialSentiment: true,
                pumpDetection: true
            }
        },

        [PairCategory.DEFI]: {
            minVolume: 500000,
            volatilityMultiplier: 1.5,
            riskAdjustment: 0.7,
            spreadTolerance: 0.003,
            specialRules: {
                stopLossMultiplier: 1.3,
                takeProfitMultiplier: 1.2,
                volumeWeight: 0.9,
                avoidWeekends: false,
                newsFilter: true,
                socialSentiment: true,
                pumpDetection: true
            }
        },

        [PairCategory.MEME]: {
            minVolume: 2000000,
            volatilityMultiplier: 2.0,
            riskAdjustment: 0.5,
            spreadTolerance: 0.005,
            specialRules: {
                stopLossMultiplier: 1.5,
                takeProfitMultiplier: 1.3,
                volumeWeight: 2.0,
                avoidWeekends: false,
                newsFilter: false,
                socialSentiment: true,
                pumpDetection: true
            }
        },

        [PairCategory.STABLECOIN]: {
            minVolume: 10000000,
            volatilityMultiplier: 0.3,
            riskAdjustment: 1.5,
            spreadTolerance: 0.0001,
            specialRules: {
                stopLossMultiplier: 0.5,
                takeProfitMultiplier: 0.7,
                volumeWeight: 1.5,
                avoidWeekends: false,
                newsFilter: false,
                socialSentiment: false,
                pumpDetection: false
            }
        },

        [PairCategory.TRADITIONAL]: {
            minVolume: 1000000,
            volatilityMultiplier: 0.8,
            riskAdjustment: 1.1,
            spreadTolerance: 0.0002,
            specialRules: {
                stopLossMultiplier: 0.9,
                takeProfitMultiplier: 0.9,
                volumeWeight: 1.1,
                avoidWeekends: true,
                newsFilter: true,
                socialSentiment: false,
                pumpDetection: false
            }
        }
    }

    private static readonly TIMEFRAME_MULTIPLIERS: Record<TimeFrame, {
        dataPoints: number;
        signalCooldownMultiplier: number;
        volumeThresholdMultiplier: number;
        maxPositionTime?: number;
    }> = {
        [TimeFrame.ONE_MINUTE]: {
            dataPoints: 200,
            signalCooldownMultiplier: 0.5,
            volumeThresholdMultiplier: 2.0,
            maxPositionTime: 300
        },
        [TimeFrame.FIVE_MINUTES]: {
            dataPoints: 150,
            signalCooldownMultiplier: 0.7,
            volumeThresholdMultiplier: 1.5,
            maxPositionTime: 900
        },
        [TimeFrame.FIFTEEN_MINUTES]: {
            dataPoints: 100,
            signalCooldownMultiplier: 1.0,
            volumeThresholdMultiplier: 1.2
        },
        [TimeFrame.THIRTY_MINUTES]: {
            dataPoints: 80,
            signalCooldownMultiplier: 1.2,
            volumeThresholdMultiplier: 1.0
        },
        [TimeFrame.ONE_HOUR]: {
            dataPoints: 100,
            signalCooldownMultiplier: 1.0,
            volumeThresholdMultiplier: 0.8
        },
        [TimeFrame.TWO_HOURS]: {
            dataPoints: 80,
            signalCooldownMultiplier: 1.5,
            volumeThresholdMultiplier: 0.7
        },
        [TimeFrame.FOUR_HOURS]: {
            dataPoints: 60,
            signalCooldownMultiplier: 2.0,
            volumeThresholdMultiplier: 0.6
        },
        [TimeFrame.SIX_HOURS]: {
            dataPoints: 50,
            signalCooldownMultiplier: 2.5,
            volumeThresholdMultiplier: 0.5
        },
        [TimeFrame.EIGHT_HOURS]: {
            dataPoints: 40,
            signalCooldownMultiplier: 3.0,
            volumeThresholdMultiplier: 0.4
        },
        [TimeFrame.TWELVE_HOURS]: {
            dataPoints: 35,
            signalCooldownMultiplier: 4.0,
            volumeThresholdMultiplier: 0.4
        },
        [TimeFrame.ONE_DAY]: {
            dataPoints: 30,
            signalCooldownMultiplier: 6.0,
            volumeThresholdMultiplier: 0.3
        },
        [TimeFrame.THREE_DAYS]: {
            dataPoints: 25,
            signalCooldownMultiplier: 8.0,
            volumeThresholdMultiplier: 0.2
        },
        [TimeFrame.ONE_WEEK]: {
            dataPoints: 20,
            signalCooldownMultiplier: 10.0,
            volumeThresholdMultiplier: 0.2
        },
        [TimeFrame.ONE_MONTH]: {
            dataPoints: 15,
            signalCooldownMultiplier: 20.0,
            volumeThresholdMultiplier: 0.1
        }
    }

    /**
     * Generate settings for specific pair and configuration
     */
    static generateSettings(
        config: ITradingPairConfig,
        timeframe: TimeFrame,
        appConfig: IAppConfig
    ): IPairSettings {
        const pairCategory = this.detectPairCategory(config.symbol);
        const template = this.CATEGORY_TEMPLATES[pairCategory];
        const timeframeConfig = this.TIMEFRAME_MULTIPLIERS[timeframe];

        const baseSignalStrength = appConfig.risk.minConfidenceScore;
        const categoryAdjustment = this.getCategorySignalAdjustment(pairCategory);
        const timeframeAdjustment = this.getTimeframeSignalAdjustment(timeframe);

        const baseCooldown = appConfig.trading.signalCooldowns[appConfig.trading.mode] || 300;
        const adjustedCooldown = baseCooldown * timeframeConfig.signalCooldownMultiplier;

        return {
            minVolume: (template.minVolume || 1000000) * timeframeConfig.volumeThresholdMultiplier,
            volatilityMultiplier: template.volatilityMultiplier || 1.0,
            riskAdjustment: template.riskAdjustment || 1.0,
            signalStrength: Math.min(10, Math.max(1,
                baseSignalStrength + categoryAdjustment + timeframeAdjustment
            )),
            spreadTolerance: template.spreadTolerance || 0.001,
            signalCooldown: adjustedCooldown,
            dataPoints: timeframeConfig.dataPoints,
            timeframe,
            specialRules: {
                stopLossMultiplier: template.specialRules?.stopLossMultiplier || 1.0,
                takeProfitMultiplier: template.specialRules?.takeProfitMultiplier || 1.0,
                volumeWeight: template.specialRules?.volumeWeight || 1.0,
                avoidWeekends: template.specialRules?.avoidWeekends || false,
                newsFilter: template.specialRules?.newsFilter || false,
                socialSentiment: template.specialRules?.socialSentiment || false,
                pumpDetection: template.specialRules?.pumpDetection || false,
                maxPositionTime: timeframeConfig.maxPositionTime ?? 60
            }
        };
    }

    /**
     * Get signal strength adjustment based on category
     */
    private static getCategorySignalAdjustment(category: PairCategory): number {
        const adjustments: Record<PairCategory, number> = {
            [PairCategory.CRYPTO_MAJOR]: 0,     // Baseline
            [PairCategory.CRYPTO_ALT]: 1,       // Slightly higher confidence needed
            [PairCategory.DEFI]: 1,             // Higher confidence for DeFi
            [PairCategory.MEME]: 2,             // Much higher confidence for memes
            [PairCategory.STABLECOIN]: -1,      // Lower confidence needed
            [PairCategory.TRADITIONAL]: 0       // Baseline for traditional assets
        };
        return adjustments[category];
    }

    /**
     * Get signal strength adjustment based on timeframe
     */
    private static getTimeframeSignalAdjustment(timeframe: TimeFrame): number {
        // Shorter timeframes need higher confidence due to noise
        const shortTermFrames = [
            TimeFrame.ONE_MINUTE,
            TimeFrame.FIVE_MINUTES,
            TimeFrame.FIFTEEN_MINUTES
        ];

        const longTermFrames = [
            TimeFrame.ONE_DAY,
            TimeFrame.THREE_DAYS,
            TimeFrame.ONE_WEEK,
            TimeFrame.ONE_MONTH
        ];

        if (shortTermFrames.includes(timeframe)) {
            return 1; // Higher confidence for short-term
        } else if (longTermFrames.includes(timeframe)) {
            return -1; // Lower confidence for long-term trends
        }

        return 0; // Medium-term timeframes
    }

    /**
     * Auto-detect pair category from pair symbol
     */
    static detectPairCategory(pair: string): PairCategory {
        const symbol = pair.toUpperCase().split('/').shift();

        // Stablecoins
        const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FRAX'];
        if (stablecoins.some(coin => coin === symbol)) {
            return PairCategory.STABLECOIN;
        }

        // Meme coins
        const memeCoins = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'WOJAK'];
        if (memeCoins.some(coin => coin === symbol)) {
            return PairCategory.MEME;
        }

        // DeFi tokens
        const defiTokens = ['UNI', 'SUSHI', 'AAVE', 'COMP', 'MKR', 'SNX', 'CRV', 'YFI', 'LINK'];
        if (defiTokens.some(coin => coin === symbol)) {
            return PairCategory.DEFI;
        }

        // Major cryptos
        const majorCryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'AVAX', 'MATIC'];
        if (majorCryptos.some(coin => coin === symbol)) {
            return PairCategory.CRYPTO_MAJOR;
        }

        // Traditional assets (Forex, Stocks)
        const fiatCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
        if (fiatCurrencies.filter(coin => coin === symbol).length >= 2) {
            return PairCategory.TRADITIONAL;
        }

        // Default to crypto alt
        return PairCategory.CRYPTO_ALT;
    }
}
