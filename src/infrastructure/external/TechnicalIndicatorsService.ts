import {
    ExternalApiError,
    ILogger,
    ITechnicalIndicatorValues,
    ICandle,
    IEmaValues,
    IMacdValues,
    IBollingerBands,
} from '../../shared';

export interface ITechnicalIndicatorsService {
    calculateEMA(prices: number[], periods: { short: number; medium: number; long: number }): IEmaValues;
    calculateRSI(prices: number[], period: number): number;
    calculateMACD(prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): IMacdValues;
    calculateBollingerBands(prices: number[], period: number, stdDev: number): IBollingerBands;
    calculateStochastic(candles: ICandle[], kPeriod: number, dPeriod: number): { k: number; d: number };
    calculateATR(candles: ICandle[], period: number): number;
    calculateADX(candles: ICandle[], period: number): number;
    calculateVolumeProfile(volumes: number[], period: number): { sma: number; ratio: number };
    calculateAll(candles: readonly ICandle[], settings: any): ITechnicalIndicatorValues;
}

export class TechnicalIndicatorsService implements ITechnicalIndicatorsService {
    constructor(private readonly logger: ILogger) {}

    calculateEMA(prices: number[], periods: { short: number; medium: number; long: number }): IEmaValues {
        try {
            return {
                short: this.ema(prices, periods.short),
                medium: this.ema(prices, periods.medium),
                long: this.ema(prices, periods.long)
            };
        } catch (error) {
            this.logger.error('Failed to calculate EMA:', error);
            throw new ExternalApiError('EMA calculation failed', 'technical-indicators');
        }
    }

    calculateRSI(prices: number[], period: number = 14): number {
        try {
            if (prices.length < period + 1) {
                throw new Error(`Not enough data points for RSI calculation. Need ${period + 1}, got ${prices.length}`);
            }

            const gains: number[] = [];
            const losses: number[] = [];

            // Calculate gains and losses
            for (let i = 1; i < prices.length; i++) {
                const change = (prices[i] as number) - (prices[i - 1] as number);

                gains.push(change > 0 ? change : 0);
                losses.push(change < 0 ? Math.abs(change) : 0);
            }

            // Calculate initial averages
            let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
            let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

            // Calculate smoothed averages for remaining data
            for (let i = period; i < gains.length; i++) {
                avgGain = (avgGain * (period - 1) + (gains[i] as number)) / period;
                avgLoss = (avgLoss * (period - 1) + (losses[i] as number)) / period;
            }

            if (avgLoss === 0) return 100;

            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        } catch (error) {
            this.logger.error('Failed to calculate RSI:', error);
            throw new ExternalApiError('RSI calculation failed', 'technical-indicators');
        }
    }

    calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): IMacdValues {
        try {
            const emaFast = this.ema(prices, fastPeriod);
            const emaSlow = this.ema(prices, slowPeriod);
            const macdLine = emaFast - emaSlow;

            // Calculate signal line (EMA of MACD line)
            const macdHistory = this.calculateMACDHistory(prices, fastPeriod, slowPeriod);
            const signalLine = this.ema(macdHistory, signalPeriod);

            const histogram = macdLine - signalLine;

            return {
                line: macdLine,
                signal: signalLine,
                histogram: histogram
            };
        } catch (error) {
            this.logger.error('Failed to calculate MACD:', error);
            throw new ExternalApiError('MACD calculation failed', 'technical-indicators');
        }
    }

    calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): IBollingerBands {
        try {
            if (prices.length < period) {
                throw new Error(`Not enough data points for Bollinger Bands. Need ${period}, got ${prices.length}`);
            }

            const sma = this.sma(prices, period);
            const standardDeviation = this.standardDeviation(prices.slice(-period));

            return {
                upper: sma + (standardDeviation * stdDev),
                middle: sma,
                lower: sma - (standardDeviation * stdDev)
            };
        } catch (error) {
            this.logger.error('Failed to calculate Bollinger Bands:', error);
            throw new ExternalApiError('Bollinger Bands calculation failed', 'technical-indicators');
        }
    }

    calculateStochastic(candles: ICandle[], kPeriod: number = 14, dPeriod: number = 3): { k: number; d: number } {
        try {
            if (candles.length < kPeriod) {
                throw new Error(`Not enough candles for Stochastic calculation. Need ${kPeriod}, got ${candles.length}`);
            }

            const recentCandles = candles.slice(-kPeriod);
            const currentClose = (candles[candles.length - 1] as ICandle).close;
            const lowestLow = Math.min(...recentCandles.map(c => c.low));
            const highestHigh = Math.max(...recentCandles.map(c => c.high));

            const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

            // Calculate D (SMA of K values)
            const kValues = this.calculateStochasticHistory(candles, kPeriod);
            const d = this.sma(kValues.slice(-dPeriod), dPeriod);

            return { k, d };
        } catch (error) {
            this.logger.error('Failed to calculate Stochastic:', error);
            throw new ExternalApiError('Stochastic calculation failed', 'technical-indicators');
        }
    }

    calculateATR(candles: ICandle[], period: number = 14): number {
        try {
            if (candles.length < period + 1) {
                throw new Error(`Not enough candles for ATR calculation. Need ${period + 1}, got ${candles.length}`);
            }

            const trueRanges: number[] = [];

            for (let i = 1; i < candles.length; i++) {
                const current = candles[i] as ICandle;
                const previous = candles[i - 1] as ICandle;

                const tr1 = current.high - current.low;
                const tr2 = Math.abs(current.high - previous.close);
                const tr3 = Math.abs(current.low - previous.close);

                trueRanges.push(Math.max(tr1, tr2, tr3));
            }

            return this.sma(trueRanges.slice(-period), period);
        } catch (error) {
            this.logger.error('Failed to calculate ATR:', error);
            throw new ExternalApiError('ATR calculation failed', 'technical-indicators');
        }
    }

    calculateADX(candles: ICandle[], period: number = 14): number {
        try {
            if (candles.length < period * 2) {
                throw new Error(`Not enough candles for ADX calculation. Need ${period * 2}, got ${candles.length}`);
            }

            const dmPlus: number[] = [];
            const dmMinus: number[] = [];
            const trueRanges: number[] = [];

            // Calculate DM+ and DM- and TR
            for (let i = 1; i < candles.length; i++) {
                const current = candles[i] as ICandle;
                const previous = candles[i - 1] as ICandle;

                const highDiff = current.high - previous.high;
                const lowDiff = previous.low - current.low;

                dmPlus.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
                dmMinus.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

                const tr1 = current.high - current.low;
                const tr2 = Math.abs(current.high - previous.close);
                const tr3 = Math.abs(current.low - previous.close);
                trueRanges.push(Math.max(tr1, tr2, tr3));
            }

            // Calculate smoothed values
            const smoothedDMPlus = this.wilderSmoothing(dmPlus, period);
            const smoothedDMMinus = this.wilderSmoothing(dmMinus, period);
            const smoothedTR = this.wilderSmoothing(trueRanges, period);

            // Calculate DI+ and DI-
            const diPlus = (smoothedDMPlus / smoothedTR) * 100;
            const diMinus = (smoothedDMMinus / smoothedTR) * 100;

            // ADX is typically the smoothed DX
            return  Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
        } catch (error) {
            this.logger.error('Failed to calculate ADX:', error);
            throw new ExternalApiError('ADX calculation failed', 'technical-indicators');
        }
    }

    calculateVolumeProfile(volumes: number[], period: number = 20): { sma: number; ratio: number } {
        try {
            if (volumes.length === 0) {
                return { sma: 0, ratio: 1 };
            }

            const sma = this.sma(volumes, Math.min(period, volumes.length));
            const currentVolume = volumes[volumes.length - 1] as number;
            const ratio = sma > 0 ? currentVolume / sma : 1;

            return { sma, ratio };
        } catch (error) {
            this.logger.error('Failed to calculate Volume Profile:', error);
            throw new ExternalApiError('Volume Profile calculation failed', 'technical-indicators');
        }
    }

    calculateAll(candles: ICandle[], settings: {
        ema: { short: number; medium: number; long: number };
        rsi: { period: number };
        macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
        bollingerBands: { period: number; standardDeviation: number };
        stochastic?: { kPeriod: number; dPeriod: number };
        atr?: { period: number };
        adx?: { period: number };
        volume?: { period: number };
    }): ITechnicalIndicatorValues {
        try {
            const closes = candles.map(c => c.close);
            const volumes = candles.map(c => c.volume);

            const ema = this.calculateEMA(closes, settings.ema);
            const rsi = this.calculateRSI(closes, settings.rsi.period);
            const macd = this.calculateMACD(closes, settings.macd.fastPeriod, settings.macd.slowPeriod, settings.macd.signalPeriod);
            const bollingerBands = this.calculateBollingerBands(closes, settings.bollingerBands.period, settings.bollingerBands.standardDeviation);

            const stochastic = settings.stochastic
                ? this.calculateStochastic(candles, settings.stochastic.kPeriod, settings.stochastic.dPeriod)
                : { k: 50, d: 50 };

            const atr = settings.atr
                ? this.calculateATR(candles, settings.atr.period)
                : 0;

            const adx = settings.adx
                ? this.calculateADX(candles, settings.adx.period)
                : 25;

            const volumeProfile = settings.volume
                ? this.calculateVolumeProfile(volumes, settings.volume.period)
                : { sma: 0, ratio: 1 };

            return {
                rsi,
                ema,
                macd,
                bollingerBands,
                stochastic,
                atr,
                adx,
                volumeProfile
            };
        } catch (error) {
            this.logger.error('Failed to calculate all indicators:', error);
            throw new ExternalApiError('Technical indicators calculation failed', 'technical-indicators');
        }
    }

    // Private helper methods
    private ema(prices: number[], period: number): number {
        if (prices.length === 0) return 0;
        if (prices.length < period) return prices[prices.length - 1] as number;

        const multiplier = 2 / (period + 1);
        let ema = prices[0] as number;

        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] as number * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    private sma(prices: number[], period: number): number {
        if (prices.length === 0) return 0;
        const relevantPrices = prices.slice(-period);
        return relevantPrices.reduce((sum, price) => sum + price, 0) / relevantPrices.length;
    }

    private standardDeviation(prices: number[]): number {
        if (prices.length === 0) return 0;

        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
        const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;

        return Math.sqrt(variance);
    }

    private calculateMACDHistory(prices: number[], fastPeriod: number, slowPeriod: number): number[] {
        const macdHistory: number[] = [];
        const minLength = Math.max(fastPeriod, slowPeriod);

        for (let i = minLength; i <= prices.length; i++) {
            const subset = prices.slice(0, i);
            const emaFast = this.ema(subset, fastPeriod);
            const emaSlow = this.ema(subset, slowPeriod);
            macdHistory.push(emaFast - emaSlow);
        }

        return macdHistory;
    }

    private calculateStochasticHistory(candles: ICandle[], kPeriod: number): number[] {
        const kValues: number[] = [];

        for (let i = kPeriod - 1; i < candles.length; i++) {
            const periodCandles = candles.slice(i - kPeriod + 1, i + 1);
            const currentClose = (candles[i] as ICandle).close;
            const lowestLow = Math.min(...periodCandles.map(c => c.low));
            const highestHigh = Math.max(...periodCandles.map(c => c.high));

            const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
            kValues.push(k);
        }

        return kValues;
    }

    private wilderSmoothing(values: number[], period: number): number {
        if (values.length < period) return 0;

        let sum = values.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothed = sum / period;

        for (let i = period; i < values.length; i++) {
            smoothed = (smoothed * (period - 1) + (values[i] as number)) / period;
        }

        return smoothed;
    }
}
