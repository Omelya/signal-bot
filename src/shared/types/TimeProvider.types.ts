export interface ITimeProvider {
    now(): number;
    nowDate(): Date;
    format(date: Date, format?: string): string;
    parse(dateString: string, format?: string): Date;
    addDays(date: Date, days: number): Date;
    addHours(date: Date, hours: number): Date;
    addMinutes(date: Date, minutes: number): Date;
    diffInMinutes(date1: Date, date2: Date): number;
    diffInHours(date1: Date, date2: Date): number;
    diffInDays(date1: Date, date2: Date): number;
    isWeekend(date: Date): boolean;
    isBusinessDay(date: Date): boolean;
    getTimezone(): string;
}
