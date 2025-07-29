export class MathUtil {
    /**
     * Round number to specified decimal places
     */
    static round(num: number, decimals: number = 2): number {
        return Number(Math.round(Number(num + 'e' + decimals)) + 'e-' + decimals);
    }

    /**
     * Calculate percentage change
     */
    static percentageChange(oldValue: number, newValue: number): number {
        if (oldValue === 0) return 0;
        return ((newValue - oldValue) / oldValue) * 100;
    }

    /**
     * Calculate moving average
     */
    static movingAverage(values: number[], period: number): number[] {
        if (values.length < period) return [];

        const result: number[] = [];
        for (let i = period - 1; i < values.length; i++) {
            const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
        return result;
    }

    /**
     * Calculate standard deviation
     */
    static standardDeviation(values: number[]): number {
        if (values.length === 0) return 0;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

        return Math.sqrt(variance);
    }

    /**
     * Clamp value between min and max
     */
    static clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Check if number is within range (inclusive)
     */
    static isInRange(value: number, min: number, max: number): boolean {
        return value >= min && value <= max;
    }

    /**
     * Calculate compound annual growth rate (CAGR)
     */
    static calculateCAGR(
        initialValue: number,
        finalValue: number,
        periods: number
    ): number {
        if (initialValue <= 0 || finalValue <= 0 || periods <= 0) return 0;
        return (Math.pow(finalValue / initialValue, 1 / periods) - 1) * 100;
    }

    /**
     * Calculate Sharpe ratio
     */
    static calculateSharpeRatio(
        returns: number[],
        riskFreeRate: number = 0
    ): number {
        if (returns.length === 0) return 0;

        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const excessReturn = avgReturn - riskFreeRate;
        const volatility = MathUtil.standardDeviation(returns);

        return volatility === 0 ? 0 : excessReturn / volatility;
    }

    /**
     * Calculate maximum drawdown
     */
    static calculateMaxDrawdown(equity: number[]): number {
        if (equity.length === 0) return 0;

        let maxDrawdown = 0;
        let peak = equity[0] as number;

        for (const value of equity) {
            if (value > peak) {
                peak = value;
            }

            const drawdown = (peak - value) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown * 100; // Return as percentage
    }
}
