class TechnicalIndicators {
    static calculateEMA(data, period) {
        if (data.length < period) return [];

        const multiplier = 2 / (period + 1);
        let ema = [data[0]];

        for (let i = 1; i < data.length; i++) {
            ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
        }
        return ema;
    }

    static calculateRSI(data, period = 14) {
        if (data.length < period + 1) return [];

        let gains = [];
        let losses = [];

        for (let i = 1; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

        const rsi = [];
        for (let i = period; i < data.length; i++) {
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));

            avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;
        }

        return rsi;
    }

    static calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const emaFast = this.calculateEMA(data, fastPeriod);
        const emaSlow = this.calculateEMA(data, slowPeriod);

        const macdLine = emaFast.map((val, i) => val - emaSlow[i]);
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        const histogram = macdLine.map((val, i) => val - (signalLine[i] || 0));

        return { macdLine, signalLine, histogram };
    }

    static calculateBollingerBands(data, period = 20, standardDeviation = 2) {
        if (data.length < period) return { upper: [], middle: [], lower: [] };

        const sma = [];
        const upper = [];
        const lower = [];

        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b) / period;
            const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
            const stdDev = Math.sqrt(variance);

            sma.push(mean);
            upper.push(mean + (standardDeviation * stdDev));
            lower.push(mean - (standardDeviation * stdDev));
        }

        return { upper, middle: sma, lower };
    }
}

module.exports = TechnicalIndicators;
