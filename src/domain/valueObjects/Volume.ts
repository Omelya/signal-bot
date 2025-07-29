export class Volume {
    constructor(
        private readonly _value: number,
        private readonly _asset: string = 'USD'
    ) {
        this.validate();
    }

    static fromNumber(value: number, asset?: string): Volume {
        return new Volume(value, asset);
    }

    static zero(asset: string = 'USD'): Volume {
        return new Volume(0, asset);
    }

    get value(): number { return this._value; }
    get asset(): string { return this._asset; }

    /**
     * Format volume for display
     */
    public format(decimals: number = 0): string {
        if (this._value >= 1_000_000_000) {
            return `${(this._value / 1_000_000_000).toFixed(1)}B ${this._asset}`;
        }
        if (this._value >= 1_000_000) {
            return `${(this._value / 1_000_000).toFixed(1)}M ${this._asset}`;
        }
        if (this._value >= 1_000) {
            return `${(this._value / 1_000).toFixed(1)}K ${this._asset}`;
        }
        return `${this._value.toFixed(decimals)} ${this._asset}`;
    }

    /**
     * Check if volume is significant (above threshold)
     */
    public isSignificant(threshold: number): boolean {
        return this._value >= threshold;
    }

    /**
     * Compare with another volume
     */
    public isGreaterThan(other: Volume): boolean {
        this.ensureSameAsset(other);
        return this._value > other._value;
    }

    public isLessThan(other: Volume): boolean {
        this.ensureSameAsset(other);
        return this._value < other._value;
    }

    public equals(other: Volume): boolean {
        return this._value === other._value && this._asset === other._asset;
    }

    /**
     * Calculate ratio with another volume
     */
    public ratioTo(other: Volume): number {
        this.ensureSameAsset(other);
        if (other._value === 0) return 0;
        return this._value / other._value;
    }

    /**
     * Add volumes
     */
    public add(other: Volume): Volume {
        this.ensureSameAsset(other);
        return new Volume(this._value + other._value, this._asset);
    }

    /**
     * Subtract volumes
     */
    public subtract(other: Volume): Volume {
        this.ensureSameAsset(other);
        return new Volume(Math.max(0, this._value - other._value), this._asset);
    }

    /**
     * Multiply volume by factor
     */
    public multiply(factor: number): Volume {
        return new Volume(this._value * factor, this._asset);
    }

    /**
     * Get percentage of another volume
     */
    public percentageOf(total: Volume): number {
        this.ensureSameAsset(total);
        if (total._value === 0) return 0;
        return (this._value / total._value) * 100;
    }

    private validate(): void {
        if (this._value < 0) {
            throw new Error('Volume cannot be negative');
        }
        if (!this._asset || this._asset.trim().length === 0) {
            throw new Error('Asset cannot be empty');
        }
    }

    private ensureSameAsset(other: Volume): void {
        if (this._asset !== other._asset) {
            throw new Error(`Cannot operate on volumes with different assets: ${this._asset} vs ${other._asset}`);
        }
    }
}
