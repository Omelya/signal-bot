import {TechnicalIndicators} from "../../valueObjects/TechnicalIndicators";
import {MarketData} from "../../entities/MarketData";

export enum TrendEnum {
    BULLISH = 'BULLISH',
    BEARISH = 'BEARISH',
    SIDEWAYS = 'SIDEWAYS',
}

export class TrendAnalyzer {
    public analyzeTrend(indicators: TechnicalIndicators, marketData: MarketData): TrendEnum {
        const overallSignal = indicators.getOverallSignal();
        const statistics = marketData.getStatistics();

        const priceChange24h = statistics.priceChangePercent;
        const priceChange = marketData.getPriceChange(5);

        const currentPrice = marketData.currentPrice;
        const ema = indicators.values.ema;
        const priceVsMA = {
            aboveShort: currentPrice > ema.short,
            aboveMedium: currentPrice > ema.medium,
            aboveLong: currentPrice > ema.long
        };

        const macdSignal = indicators.macdSignal;
        const rsiSignal = indicators.rsiSignal;

        const isHighVolume = indicators.isVolumeAboveAverage;

        if (
            priceChange24h < -3 ||
            (priceChange.percentage < -2 && !priceVsMA.aboveShort && isHighVolume) ||
            (macdSignal === 'SELL' && rsiSignal === 'SELL' && !priceVsMA.aboveMedium)
        ) {
            return TrendEnum.BEARISH;
        }

        if (
            priceChange24h > 3 ||
            (priceChange.percentage > 2 && priceVsMA.aboveShort && isHighVolume) ||
            (macdSignal === 'BUY' && rsiSignal === 'BUY' && priceVsMA.aboveMedium)
        ) {
            return TrendEnum.BULLISH;
        }

        if (
            Math.abs(priceChange24h) < 2 &&
            Math.abs(priceChange.percentage) < 1.5 &&
            overallSignal.strength < 7
        ) {
            return TrendEnum.SIDEWAYS;
        }

        if (overallSignal.direction === 'BUY' && overallSignal.strength >= 5) {
            if ((priceVsMA.aboveShort && isHighVolume) || priceVsMA.aboveShort) {
                return TrendEnum.BULLISH;
            } else {
                return TrendEnum.SIDEWAYS;
            }
        }

        if (overallSignal.direction === 'SELL' && overallSignal.strength >= 5) {
            if ((!priceVsMA.aboveShort && isHighVolume) || !priceVsMA.aboveShort) {
                return TrendEnum.BEARISH;
            } else {
                return TrendEnum.SIDEWAYS;
            }
        }

        if (isHighVolume && Math.abs(priceChange24h) < 1) {
            if (priceVsMA.aboveMedium && priceVsMA.aboveLong) {
                return TrendEnum.BULLISH;
            } else if (!priceVsMA.aboveMedium && !priceVsMA.aboveLong) {
                return TrendEnum.BEARISH;
            }
        }

        return TrendEnum.SIDEWAYS;
    }
}
