export interface IIdGenerator {
    generate(): string;
    generateNumeric(): number;
    generateShort(): string;
    isValid(id: string): boolean;
}
