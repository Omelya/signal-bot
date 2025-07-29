export class DateUtil {
    /**
     * Get timestamp in milliseconds
     */
    static now(): number {
        return Date.now();
    }

    /**
     * Convert minutes to milliseconds
     */
    static minutesToMs(minutes: number): number {
        return minutes * 60 * 1000;
    }

    /**
     * Convert hours to milliseconds
     */
    static hoursToMs(hours: number): number {
        return hours * 60 * 60 * 1000;
    }

    /**
     * Convert days to milliseconds
     */
    static daysToMs(days: number): number {
        return days * 24 * 60 * 60 * 1000;
    }

    /**
     * Check if date is within last N minutes
     */
    static isWithinMinutes(date: Date, minutes: number): boolean {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        return diffMs <= DateUtil.minutesToMs(minutes);
    }

    /**
     * Format date for display
     */
    static formatForDisplay(date: Date): string {
        return date.toLocaleString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Get age in minutes
     */
    static getAgeInMinutes(date: Date): number {
        const now = new Date();
        return Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    }

    /**
     * Get start of day
     */
    static startOfDay(date: Date = new Date()): Date {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    /**
     * Get end of day
     */
    static endOfDay(date: Date = new Date()): Date {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end;
    }
}
