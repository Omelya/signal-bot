export class Price {
    constructor(
        private readonly _value: number,
        private readonly _currency: string = 'USDT'
    ) {
        this.validate();
    }

    static fromNumber(value: number, currency?: string): Price {
        return new Price(value, currency);
    }

    get value(): number { return this._value; }
    get currency(): string { return this._currency; }

    public format(decimals: number = 4): string {
        return `$${this._value.toFixed(decimals)}`;
    }

    public equals(other: Price): boolean {
        return this._value === other._value && this._currency === other._currency;
    }

    public isGreaterThan(other: Price): boolean {
        this.ensureSameCurrency(other);
        return this._value > other._value;
    }

    public isLessThan(other: Price): boolean {
        this.ensureSameCurrency(other);
        return this._value < other._value;
    }

    public add(other: Price): Price {
        this.ensureSameCurrency(other);
        return new Price(this._value + other._value, this._currency);
    }

    public subtract(other: Price): Price {
        this.ensureSameCurrency(other);
        return new Price(this._value - other._value, this._currency);
    }

    public multiply(multiplier: number): Price {
        return new Price(this._value * multiplier, this._currency);
    }

    public divide(divisor: number): Price {
        if (divisor === 0) {
            throw new Error('Cannot divide by zero');
        }
        return new Price(this._value / divisor, this._currency);
    }

    private validate(): void {
        if (this._value < 0) {
            throw new Error('Price cannot be negative');
        }
        if (!this._currency || this._currency.trim().length === 0) {
            throw new Error('Currency cannot be empty');
        }
    }

    private ensureSameCurrency(other: Price): void {
        if (this._currency !== other._currency) {
            throw new Error('Cannot operate on prices with different currencies');
        }
    }
}
