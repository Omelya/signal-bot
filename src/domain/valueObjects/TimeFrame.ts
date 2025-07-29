import { TimeFrame as TimeFrameEnum } from '../../shared';

export class TimeFrame {
    constructor(private readonly _value: TimeFrameEnum) {
        this.validate();
    }

    static fromString(value: string): TimeFrame {
        if (!Object.values(TimeFrameEnum).includes(value as TimeFrameEnum)) {
            throw new Error(`Invalid timeframe: ${value}`);
        }
        return new TimeFrame(value as TimeFrameEnum);
    }

    static oneMinute(): TimeFrame {
        return new TimeFrame(TimeFrameEnum.ONE_MINUTE);
    }

    static fiveMinutes(): TimeFrame {
        return new TimeFrame(TimeFrameEnum.FIVE_MINUTES);
    }

    static fifteenMinutes(): TimeFrame {
        return new TimeFrame(TimeFrameEnum.FIFTEEN_MINUTES);
    }

    static oneHour(): TimeFrame {
        return new TimeFrame(TimeFrameEnum.ONE_HOUR);
    }

    static fourHours(): TimeFrame {
        return new TimeFrame(TimeFrameEnum.FOUR_HOURS);
    }

    static oneDay(): TimeFrame {
        return new TimeFrame(TimeFrameEnum.ONE_DAY);
    }

    get value(): TimeFrameEnum { return this._value; }

    /**
     * Get timeframe duration in minutes
     */
    public getMinutes(): number {
        switch (this._value) {
            case TimeFrameEnum.ONE_MINUTE: return 1;
            case TimeFrameEnum.FIVE_MINUTES: return 5;
            case TimeFrameEnum.FIFTEEN_MINUTES: return 15;
            case TimeFrameEnum.THIRTY_MINUTES: return 30;
            case TimeFrameEnum.ONE_HOUR: return 60;
            case TimeFrameEnum.TWO_HOURS: return 120;
            case TimeFrameEnum.FOUR_HOURS: return 240;
            case TimeFrameEnum.SIX_HOURS: return 360;
            case TimeFrameEnum.EIGHT_HOURS: return 480;
            case TimeFrameEnum.TWELVE_HOURS: return 720;
            case TimeFrameEnum.ONE_DAY: return 1440;
            case TimeFrameEnum.THREE_DAYS: return 4320;
            case TimeFrameEnum.ONE_WEEK: return 10080;
            case TimeFrameEnum.ONE_MONTH: return 43200; // Approximate
            default: return 15; // Default to 15 minutes
        }
    }

    /**
     * Get timeframe duration in milliseconds
     */
    public getMilliseconds(): number {
        return this.getMinutes() * 60 * 1000;
    }

    /**
     * Get trading strategy type based on timeframe
     */
    public getStrategyType(): 'SCALPING' | 'INTRADAY' | 'SWING' | 'POSITION' {
        const minutes = this.getMinutes();

        if (minutes <= 5) return 'SCALPING';
        if (minutes <= 60) return 'INTRADAY';
        if (minutes <= 480) return 'SWING';
        return 'POSITION';
    }

    /**
     * Check if timeframe is suitable for scalping
     */
    public isScalping(): boolean {
        return this.getStrategyType() === 'SCALPING';
    }

    /**
     * Check if timeframe is suitable for intraday trading
     */
    public isIntraday(): boolean {
        return this.getStrategyType() === 'INTRADAY';
    }

    /**
     * Check if timeframe is suitable for swing trading
     */
    public isSwing(): boolean {
        return this.getStrategyType() === 'SWING';
    }

    /**
     * Check if timeframe is suitable for position trading
     */
    public isPosition(): boolean {
        return this.getStrategyType() === 'POSITION';
    }

    /**
     * Get recommended signal cooldown for this timeframe
     */
    public getRecommendedSignalCooldown(): number {
        const minutes = this.getMinutes();

        // Signal cooldown should be at least 2x the timeframe
        // but not less than 5 minutes for safety
        return Math.max(5 * 60 * 1000, minutes * 2 * 60 * 1000);
    }

    /**
     * Get recommended number of candles for analysis
     */
    public getRecommendedCandleCount(): number {
        const strategyType = this.getStrategyType();

        switch (strategyType) {
            case 'SCALPING': return 50;
            case 'INTRADAY': return 100;
            case 'SWING': return 200;
            case 'POSITION': return 300;
            default: return 100;
        }
    }

    /**
     * Get next higher timeframe
     */
    public getHigherTimeframe(): TimeFrame | null {
        const timeframes = Object.values(TimeFrameEnum);
        const currentIndex = timeframes.indexOf(this._value);

        if (currentIndex === -1 || currentIndex === timeframes.length - 1) {
            return null;
        }

        return new TimeFrame(timeframes[currentIndex + 1] as TimeFrameEnum);
    }

    /**
     * Get next lower timeframe
     */
    public getLowerTimeframe(): TimeFrame | null {
        const timeframes = Object.values(TimeFrameEnum);
        const currentIndex = timeframes.indexOf(this._value);

        if (currentIndex <= 0) {
            return null;
        }

        return new TimeFrame(timeframes[currentIndex - 1] as TimeFrameEnum);
    }

    /**
     * Check if this timeframe is higher than another
     */
    public isHigherThan(other: TimeFrame): boolean {
        return this.getMinutes() > other.getMinutes();
    }

    /**
     * Check if this timeframe is lower than another
     */
    public isLowerThan(other: TimeFrame): boolean {
        return this.getMinutes() < other.getMinutes();
    }

    /**
     * Get human-readable display name
     */
    public getDisplayName(): string {
        switch (this._value) {
            case TimeFrameEnum.ONE_MINUTE: return '1 Minute';
            case TimeFrameEnum.FIVE_MINUTES: return '5 Minutes';
            case TimeFrameEnum.FIFTEEN_MINUTES: return '15 Minutes';
            case TimeFrameEnum.THIRTY_MINUTES: return '30 Minutes';
            case TimeFrameEnum.ONE_HOUR: return '1 Hour';
            case TimeFrameEnum.TWO_HOURS: return '2 Hours';
            case TimeFrameEnum.FOUR_HOURS: return '4 Hours';
            case TimeFrameEnum.SIX_HOURS: return '6 Hours';
            case TimeFrameEnum.EIGHT_HOURS: return '8 Hours';
            case TimeFrameEnum.TWELVE_HOURS: return '12 Hours';
            case TimeFrameEnum.ONE_DAY: return '1 Day';
            case TimeFrameEnum.THREE_DAYS: return '3 Days';
            case TimeFrameEnum.ONE_WEEK: return '1 Week';
            case TimeFrameEnum.ONE_MONTH: return '1 Month';
            default: return this._value;
        }
    }

    /**
     * Get short display name
     */
    public getShortName(): string {
        return this._value;
    }

    /**
     * Calculate how many periods fit in a day
     */
    public getPeriodsPerDay(): number {
        return Math.floor(1440 / this.getMinutes()); // 1440 minutes in a day
    }

    /**
     * Calculate how many periods fit in a week
     */
    public getPeriodsPerWeek(): number {
        return this.getPeriodsPerDay() * 7;
    }

    /**
     * Get the timestamp for the start of the current period
     */
    public getCurrentPeriodStart(timestamp: number = Date.now()): number {
        const minutes = this.getMinutes();
        const date = new Date(timestamp);

        // Reset seconds and milliseconds
        date.setSeconds(0, 0);

        // Align to timeframe boundary
        const currentMinute = date.getMinutes();
        const alignedMinute = Math.floor(currentMinute / minutes) * minutes;
        date.setMinutes(alignedMinute);

        return date.getTime();
    }

    /**
     * Get the timestamp for the end of the current period
     */
    public getCurrentPeriodEnd(timestamp: number = Date.now()): number {
        return this.getCurrentPeriodStart(timestamp) + this.getMilliseconds();
    }

    /**
     * Check if timestamp is at the start of a period
     */
    public isAtPeriodStart(timestamp: number): boolean {
        return timestamp === this.getCurrentPeriodStart(timestamp);
    }

    /**
     * Compare with another timeframe
     */
    public equals(other: TimeFrame): boolean {
        return this._value === other._value;
    }

    /**
     * Convert to string
     */
    public toString(): string {
        return this._value;
    }

    private validate(): void {
        if (!Object.values(TimeFrameEnum).includes(this._value)) {
            throw new Error(`Invalid timeframe: ${this._value}`);
        }
    }
}
