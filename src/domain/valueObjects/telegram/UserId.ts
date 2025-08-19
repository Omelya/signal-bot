export class UserId {
    constructor(private readonly value: number) {
        if (value <= 0) {
            throw new Error('User ID must be positive');
        }
    }

    getValue(): number { return this.value; }
}
