import { ExchangeType, TimeFrame } from '../../shared';
import { DomainError } from '../../shared';
import {ICandle, IMarketDataCreateParams, IMarketStatistics, IPriceAction} from '../../shared';

export class MarketData {
    private _statistics?: IMarketStatistics;
    private _priceAction?: IPriceAction;

    private constructor(
        private readonly _symbol: string,
        private readonly _timeframe: TimeFrame,
        private readonly _candles: readonly ICandle[],
        private readonly _exchange: ExchangeType,
        private readonly _timestamp: number = Date.now()
    ) {
        this.validateCandles();
    }

    /**
     * Factory method to create new MarketData
     */
    static create(params: IMarketDataCreateParams): MarketData {
        return new MarketData(
            params.symbol.toUpperCase(),
            params.timeframe,
            params.candles,
            params.exchange,
            params.timestamp
        );
    }

    /**
     * Factory method to create from OHLCV array
     */
    static fromOHLCV(
        symbol: string,
        timeframe: TimeFrame,
        ohlcvData: number[][],
        exchange: ExchangeType
    ): MarketData {
        const candles: ICandle[] = ohlcvData.map(candle => ({
            timestamp: candle[0] ?? 0,
            open: candle[1] ?? 0,
            high: candle[2] ?? 0,
            low: candle[3] ?? 0,
            close: candle[4] ?? 0,
            volume: candle[5] ?? 0,
        }));

        return new MarketData(symbol.toUpperCase(), timeframe, candles, exchange);
    }

    // Getters
    get symbol(): string { return this._symbol; }
    get timeframe(): TimeFrame { return this._timeframe; }
    get candles(): readonly ICandle[] { return this._candles; }
    get exchange(): ExchangeType { return this._exchange; }
    get timestamp(): number { return this._timestamp; }

    /**
     * Get the latest candle
     */
    get latestCandle(): ICandle {
        if (this._candles.length === 0) {
            throw new DomainError('No candles available');
        }

        return this._candles[this._candles.length - 1] as ICandle;
    }

    /**
     * Get the current price (latest close)
     */
    get currentPrice(): number {
        return this.latestCandle.close;
    }

    /**
     * Get candles count
     */
    get candleCount(): number {
        return this._candles.length;
    }

    // Business Methods

    /**
     * Get candles for a specific period (last N candles)
     */
    public getCandles(count?: number): readonly ICandle[] {
        if (count === undefined) {
            return this._candles;
        }

        if (count <= 0) {
            throw new DomainError('Count must be positive');
        }

        if (count >= this._candles.length) {
            return this._candles;
        }

        return this._candles.slice(-count);
    }

    /**
     * Get closes array for technical analysis
     */
    public getCloses(count?: number): number[] {
        const candles = this.getCandles(count);
        return candles.map(candle => candle.close);
    }

    /**
     * Get highs array for technical analysis
     */
    public getHighs(count?: number): number[] {
        const candles = this.getCandles(count);
        return candles.map(candle => candle.high);
    }

    /**
     * Get lows array for technical analysis
     */
    public getLows(count?: number): number[] {
        const candles = this.getCandles(count);
        return candles.map(candle => candle.low);
    }

    /**
     * Get volumes array for technical analysis
     */
    public getVolumes(count?: number): number[] {
        const candles = this.getCandles(count);
        return candles.map(candle => candle.volume);
    }

    /**
     * Get market statistics (cached after first calculation)
     */
    public getStatistics(): IMarketStatistics {
        if (!this._statistics) {
            this._statistics = this.calculateStatistics();
        }
        return this._statistics;
    }

    /**
     * Get price action analysis for the latest candle
     */
    public getPriceAction(): IPriceAction {
        if (!this._priceAction) {
            this._priceAction = this.analyzePriceAction();
        }
        return this._priceAction;
    }

    /**
     * Check if market data is recent (not older than specified minutes)
     */
    public isRecent(maxAgeMinutes: number = 5): boolean {
        const now = Date.now();
        const ageMinutes = (now - this._timestamp) / (1000 * 60);
        return ageMinutes <= maxAgeMinutes;
    }

    /**
     * Check if we have sufficient data for analysis
     */
    public hasSufficientData(minimumCandles: number = 50): boolean {
        return this._candles.length >= minimumCandles;
    }

    /**
     * Get candle at specific index (negative index counts from end)
     */
    public getCandleAt(index: number): ICandle {
        if (index < 0) {
            index = this._candles.length + index;
        }

        if (index < 0 || index >= this._candles.length) {
            throw new DomainError('Candle index out of bounds');
        }

        return this._candles[index] as ICandle;
    }

    /**
     * Find the highest price in the dataset
     */
    public getHighestPrice(period?: number): { price: number; timestamp: number } {
        const candles = this.getCandles(period);
        let highest = candles[0] as ICandle;

        for (const candle of candles) {
            if (candle.high > highest.high) {
                highest = candle;
            }
        }

        return { price: highest.high, timestamp: highest.timestamp };
    }

    /**
     * Find the lowest price in the dataset
     */
    public getLowestPrice(period?: number): { price: number; timestamp: number } {
        const candles = this.getCandles(period);
        let lowest = candles[0] as ICandle;

        for (const candle of candles) {
            if (candle.low < lowest.low) {
                lowest = candle;
            }
        }

        return { price: lowest.low, timestamp: lowest.timestamp };
    }

    /**
     * Get price change from N periods ago
     */
    public getPriceChange(periods: number = 1): { absolute: number; percentage: number } {
        if (periods >= this._candles.length) {
            throw new DomainError('Not enough candles for the requested period');
        }

        const candle = this._candles[this._candles.length - 1 - periods] as ICandle;

        const currentPrice = this.currentPrice;
        const previousPrice = candle.close;

        const absolute = currentPrice - previousPrice;
        const percentage = (absolute / previousPrice) * 100;

        return { absolute, percentage };
    }

    /**
     * Check if price is making higher highs
     */
    public isMakingHigherHighs(periods: number = 5): boolean {
        if (periods >= this._candles.length) {
            return false;
        }

        const recentCandles = this.getCandles(periods);

        for (let i = 1; i < recentCandles.length; i++) {
            const currentCandles = recentCandles[i] as ICandle;
            const previousCandles = recentCandles[i - 1] as ICandle;

            if (currentCandles.high <= previousCandles.high) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if price is making lower lows
     */
    public isMakingLowerLows(periods: number = 5): boolean {
        if (periods >= this._candles.length) {
            return false;
        }

        const recentCandles = this.getCandles(periods);

        for (let i = 1; i < recentCandles.length; i++) {
            const currentCandles = recentCandles[i] as ICandle;
            const previousCandles = recentCandles[i - 1] as ICandle;

            if (currentCandles.low >= previousCandles.low) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get average volume over specified periods
     */
    public getAverageVolume(periods: number = 20): number {
        const volumes = this.getVolumes(periods);
        const sum = volumes.reduce((acc, vol) => acc + vol, 0);
        return sum / volumes.length;
    }

    /**
     * Check if current volume is above average
     */
    public isVolumeAboveAverage(multiplier: number = 1.5, periods: number = 20): boolean {
        const avgVolume = this.getAverageVolume(periods);
        const currentVolume = this.latestCandle.volume;
        return currentVolume >= (avgVolume * multiplier);
    }

    /**
     * Get data age in minutes
     */
    public getAgeInMinutes(): number {
        const now = Date.now();
        return Math.floor((now - this._timestamp) / (1000 * 60));
    }

    /**
     * Convert to plain object for serialization
     */
    public toPlainObject(): {
        symbol: string;
        timeframe: TimeFrame;
        exchange: ExchangeType;
        timestamp: number;
        candleCount: number;
        currentPrice: number;
        ageMinutes: number;
        statistics: IMarketStatistics;
        priceAction: IPriceAction;
        isRecent: boolean;
        hasSufficientData: boolean;
    } {
        return {
            symbol: this.symbol,
            timeframe: this.timeframe,
            exchange: this.exchange,
            timestamp: this.timestamp,
            candleCount: this.candleCount,
            currentPrice: this.currentPrice,
            ageMinutes: this.getAgeInMinutes(),
            statistics: this.getStatistics(),
            priceAction: this.getPriceAction(),
            isRecent: this.isRecent(),
            hasSufficientData: this.hasSufficientData()
        };
    }

    // Private calculation methods

    private calculateStatistics(): IMarketStatistics {
        if (this._candles.length === 0) {
            throw new DomainError('Cannot calculate statistics with no candles');
        }

        const volumes = this.getVolumes();
        const closes = this.getCloses();
        const highs = this.getHighs();
        const lows = this.getLows();

        // Average volume
        const averageVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;

        // Total volume
        const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);

        const candle = this._candles[0] as ICandle;

        // Price statistics
        const firstPrice = candle.close;
        const lastPrice = this.currentPrice;
        const priceChange = lastPrice - firstPrice;
        const priceChangePercent = (priceChange / firstPrice) * 100;

        // Highest and lowest prices
        const highestPrice = Math.max(...highs);
        const lowestPrice = Math.min(...lows);

        // Average price
        const averagePrice = closes.reduce((sum, close) => sum + close, 0) / closes.length;

        // Volatility (standard deviation of price changes)
        const priceChanges = [];
        for (let i = 1; i < closes.length; i++) {
            const currentNumber = closes[i] as number;
            const previousNumber = closes[i - 1] as number;

            priceChanges.push((currentNumber - previousNumber) / previousNumber);
        }

        const meanChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
        const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - meanChange, 2), 0) / priceChanges.length;
        const volatility = Math.sqrt(variance) * 100; // Convert to percentage

        return {
            averageVolume,
            volatility,
            priceChange,
            priceChangePercent,
            highestPrice,
            lowestPrice,
            totalVolume,
            averagePrice
        };
    }

    private analyzePriceAction(): IPriceAction {
        const latestCandle = this.latestCandle;
        const { open, high, low, close } = latestCandle;

        // Basic candle properties
        const isBullish = close > open;
        const isBearish = close < open;
        const bodySize = Math.abs(close - open);

        // Wick analysis
        const upperWick = isBullish ? high - close : high - open;
        const lowerWick = isBullish ? open - low : close - low;
        const wickSize = upperWick + lowerWick;

        // Pattern recognition
        const bodyRange = high - low;
        const isSmallBody = bodySize < (bodyRange * 0.3);

        // Doji: Very small body relative to the range
        const isDoji = bodySize < (bodyRange * 0.1);

        // Hammer: Small body, long lower wick, small upper wick
        const isHammer = isSmallBody &&
            lowerWick > (bodySize * 2) &&
            upperWick < (bodySize * 0.5);

        // Engulfing pattern (need previous candle)
        let isEngulfing = false;
        if (this._candles.length >= 2) {
            const previousCandle = this._candles[this._candles.length - 2] as ICandle;
            const prevIsBullish = previousCandle.close > previousCandle.open;

            if (isBullish && !prevIsBullish) {
                // Bullish engulfing
                isEngulfing = open < previousCandle.close && close > previousCandle.open;
            } else if (isBearish && prevIsBullish) {
                // Bearish engulfing
                isEngulfing = open > previousCandle.close && close < previousCandle.open;
            }
        }

        return {
            isBullish,
            isBearish,
            bodySize,
            wickSize,
            upperWick,
            lowerWick,
            isHammer,
            isDoji,
            isEngulfing
        };
    }

    private validateCandles(): void {
        if (this._candles.length === 0) {
            throw new DomainError('MarketData must contain at least one candle');
        }

        // Validate each candle
        for (let i = 0; i < this._candles.length; i++) {
            const candle = this._candles[i] as ICandle;

            if (candle.high < candle.low) {
                throw new DomainError(`Invalid candle at index ${i}: high cannot be less than low`);
            }

            if (candle.open < 0 || candle.close < 0 || candle.high < 0 || candle.low < 0) {
                throw new DomainError(`Invalid candle at index ${i}: prices cannot be negative`);
            }

            if (candle.volume < 0) {
                throw new DomainError(`Invalid candle at index ${i}: volume cannot be negative`);
            }

            if (candle.open > candle.high || candle.open < candle.low) {
                throw new DomainError(`Invalid candle at index ${i}: open price out of high-low range`);
            }

            if (candle.close > candle.high || candle.close < candle.low) {
                throw new DomainError(`Invalid candle at index ${i}: close price out of high-low range`);
            }
        }

        // Validate chronological order
        for (let i = 1; i < this._candles.length; i++) {
            const currentCandles = this._candles[i] as ICandle;
            const previousCandles = this._candles[i - 1] as ICandle;

            if (currentCandles.timestamp <= previousCandles.timestamp) {
                throw new DomainError(`Candles must be in chronological order. Issue at index ${i}`);
            }
        }
    }
}
