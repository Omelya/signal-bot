export class UniqueId {
    private constructor(private readonly _value: string) {
        this.validate();
    }

    static generate(): UniqueId {
        // Generate UUID v4
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        return new UniqueId(uuid);
    }

    static fromString(value: string): UniqueId {
        return new UniqueId(value);
    }

    get value(): string {
        return this._value;
    }

    public equals(other: UniqueId): boolean {
        return this._value === other._value;
    }

    public toString(): string {
        return this._value;
    }

    private validate(): void {
        if (!this._value || this._value.trim().length === 0) {
            throw new Error('UniqueId value cannot be empty');
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(this._value)) {
            throw new Error('Invalid UUID format');
        }
    }
}
