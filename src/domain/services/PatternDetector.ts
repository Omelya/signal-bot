import {MarketData} from "../entities/MarketData";
import {ICandle} from "../../shared";

export type PatternDetectors = {
    patterns: string[];
    bullishSignals: string[];
    bearishSignals: string[];
}

export class PatternDetector {
    private bullishSignals: string[] = [];

    private bearishSignals: string[] = [];

    private patterns: string[] = [];

    public constructor(private marketData: MarketData) {
    }

    public detectCandlestickPatterns(): PatternDetector {
        const candles = this.marketData.candles;

        if (candles.length < 3) return this;

        const latest = candles[candles.length - 1] as ICandle;
        const previous = candles[candles.length - 2] as ICandle;
        const beforePrevious = candles[candles.length - 3] as ICandle;

        // Doji pattern
        const bodySize = Math.abs(latest.close - latest.open);
        const range = latest.high - latest.low;
        if (bodySize < range * 0.1) {
            this.patterns.push('Doji');
        }

        // Hammer pattern
        const lowerWick = Math.min(latest.open, latest.close) - latest.low;
        const upperWick = latest.high - Math.max(latest.open, latest.close);

        if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
            this.patterns.push('Hammer');
            this.bullishSignals.push('Hammer candlestick pattern');
        }

        // Engulfing patterns
        const currentBullish = latest.close > latest.open;
        const previousBearish = previous.close < previous.open;

        if (
            currentBullish
            && previousBearish
            && latest.open < previous.close
            && latest.close > previous.open
        ) {
            this.patterns.push('Bullish Engulfing');
            this.bullishSignals.push('Bullish engulfing pattern');
        }

        if (
            !currentBullish
            && !previousBearish
            && latest.open > previous.close
            && latest.close < previous.open
        ) {
            this.patterns.push('Bearish Engulfing');
            this.bearishSignals.push('Bearish engulfing pattern');
        }

        return this;
    }

    public detectPriceActionPatterns(): PatternDetector {
        const priceAction = this.marketData.getPriceAction();

        // Higher highs and higher lows
        if (this.marketData.isMakingHigherHighs(5)) {
            this.patterns.push('Higher Highs');
            this.bullishSignals.push('Making higher highs');
        }

        // Lower highs and lower lows
        if (this.marketData.isMakingLowerLows(5)) {
            this.patterns.push('Lower Lows');
            this.bearishSignals.push('Making lower lows');
        }

        // Price action patterns
        if (priceAction.isHammer) {
            this.patterns.push('Hammer Price Action');
            this.bullishSignals.push('Hammer price action');
        }

        if (priceAction.isEngulfing) {
            this.patterns.push('Engulfing Price Action');

            if (priceAction.isBullish) {
                this.bullishSignals.push('Bullish engulfing price action');
            } else {
                this.bearishSignals.push('Bearish engulfing price action');
            }
        }

        return this;
    }

    public detectTrendPatterns(): PatternDetector {
        const statistics = this.marketData.getStatistics();

        if (statistics.priceChangePercent > 5) {
            this.patterns.push('Strong Uptrend');
            this.bullishSignals.push('Strong upward price movement');
        }

        if (statistics.priceChangePercent < -5) {
            this.patterns.push('Strong Downtrend');
            this.bearishSignals.push('Strong downward price movement');
        }

        if (statistics.volatility > 0.05) {
            this.patterns.push('High Volatility');

            if (statistics.priceChangePercent > 0) {
                this.bullishSignals.push('High volatility upward breakout');
            } else {
                this.bearishSignals.push('High volatility downward breakdown');
            }
        }

        return this;
    }

    public result(): {
        patterns: string[];
        bullishSignals: string[];
        bearishSignals: string[];
    } {
        const patterns = this.patterns
        const bullishSignals = this.bullishSignals
        const bearishSignals = this.bearishSignals

        return {patterns, bullishSignals, bearishSignals};
    }
}
