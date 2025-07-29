import { ValidationError } from '../../shared';

export class ValidationUtil {
    /**
     * Validate that a value is not null or undefined
     */
    static required<T>(value: T | null | undefined, fieldName: string): T {
        if (value === null || value === undefined) {
            throw new ValidationError(`${fieldName} is required`);
        }
        return value;
    }

    /**
     * Validate string is not empty
     */
    static notEmpty(value: string | null | undefined, fieldName: string): string {
        const required = this.required(value, fieldName);
        if (required.trim().length === 0) {
            throw new ValidationError(`${fieldName} cannot be empty`);
        }
        return required;
    }

    /**
     * Validate string length
     */
    static stringLength(
        value: string,
        fieldName: string,
        min?: number,
        max?: number
    ): string {
        if (min !== undefined && value.length < min) {
            throw new ValidationError(`${fieldName} must be at least ${min} characters long`);
        }
        if (max !== undefined && value.length > max) {
            throw new ValidationError(`${fieldName} must be at most ${max} characters long`);
        }
        return value;
    }

    /**
     * Validate number range
     */
    static numberRange(
        value: number,
        fieldName: string,
        min?: number,
        max?: number
    ): number {
        if (min !== undefined && value < min) {
            throw new ValidationError(`${fieldName} must be at least ${min}`);
        }
        if (max !== undefined && value > max) {
            throw new ValidationError(`${fieldName} must be at most ${max}`);
        }
        return value;
    }

    /**
     * Validate positive number
     */
    static positiveNumber(value: number, fieldName: string): number {
        if (value <= 0) {
            throw new ValidationError(`${fieldName} must be positive`);
        }
        return value;
    }

    /**
     * Validate non-negative number
     */
    static nonNegativeNumber(value: number, fieldName: string): number {
        if (value < 0) {
            throw new ValidationError(`${fieldName} cannot be negative`);
        }
        return value;
    }

    /**
     * Validate percentage (0-100)
     */
    static percentage(value: number, fieldName: string): number {
        return this.numberRange(value, fieldName, 0, 100);
    }

    /**
     * Validate decimal percentage (0-1)
     */
    static decimalPercentage(value: number, fieldName: string): number {
        return this.numberRange(value, fieldName, 0, 1);
    }

    /**
     * Validate array is not empty
     */
    static notEmptyArray<T>(value: T[], fieldName: string): T[] {
        if (value.length === 0) {
            throw new ValidationError(`${fieldName} cannot be empty`);
        }
        return value;
    }

    /**
     * Validate array length
     */
    static arrayLength<T>(
        value: T[],
        fieldName: string,
        min?: number,
        max?: number
    ): T[] {
        if (min !== undefined && value.length < min) {
            throw new ValidationError(`${fieldName} must have at least ${min} items`);
        }
        if (max !== undefined && value.length > max) {
            throw new ValidationError(`${fieldName} must have at most ${max} items`);
        }
        return value;
    }

    /**
     * Validate value is in allowed list
     */
    static oneOf<T>(value: T, allowedValues: T[], fieldName: string): T {
        if (!allowedValues.includes(value)) {
            throw new ValidationError(
                `${fieldName} must be one of: ${allowedValues.join(', ')}`
            );
        }
        return value;
    }

    /**
     * Validate email format
     */
    static email(value: string, fieldName: string): string {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            throw new ValidationError(`${fieldName} must be a valid email address`);
        }
        return value;
    }

    /**
     * Validate URL format
     */
    static url(value: string, fieldName: string): string {
        try {
            new URL(value);
            return value;
        } catch {
            throw new ValidationError(`${fieldName} must be a valid URL`);
        }
    }

    /**
     * Validate regex pattern
     */
    static pattern(value: string, pattern: RegExp, fieldName: string, message?: string): string {
        if (!pattern.test(value)) {
            throw new ValidationError(
                message || `${fieldName} does not match the required pattern`
            );
        }
        return value;
    }

    /**
     * Validate UUID format
     */
    static uuid(value: string, fieldName: string): string {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return this.pattern(value, uuidRegex, fieldName, `${fieldName} must be a valid UUID`);
    }

    /**
     * Validate trading pair format (e.g., BTC/USDT)
     */
    static tradingPair(value: string, fieldName: string): string {
        const pairRegex = /^[A-Z0-9]+\/[A-Z0-9]+$/;
        return this.pattern(
            value.toUpperCase(),
            pairRegex,
            fieldName,
            `${fieldName} must be in format BASE/QUOTE (e.g., BTC/USDT)`
        );
    }

    /**
     * Validate API key format (basic check)
     */
    static apiKey(value: string, fieldName: string): string {
        this.notEmpty(value, fieldName);
        if (value.length < 10) {
            throw new ValidationError(`${fieldName} seems too short for an API key`);
        }
        return value;
    }

    /**
     * Validate timestamp
     */
    static timestamp(value: number, fieldName: string): number {
        if (value <= 0 || value > Date.now() + 86400000) { // Not more than 1 day in the future
            throw new ValidationError(`${fieldName} must be a valid timestamp`);
        }
        return value;
    }

    /**
     * Validate date is not in the past
     */
    static futureDate(value: Date, fieldName: string): Date {
        if (value.getTime() <= Date.now()) {
            throw new ValidationError(`${fieldName} must be in the future`);
        }
        return value;
    }

    /**
     * Validate date is not in the future
     */
    static pastDate(value: Date, fieldName: string): Date {
        if (value.getTime() > Date.now()) {
            throw new ValidationError(`${fieldName} cannot be in the future`);
        }
        return value;
    }

    /**
     * Validate JSON string
     */
    static json(value: string, fieldName: string): string {
        try {
            JSON.parse(value);
            return value;
        } catch {
            throw new ValidationError(`${fieldName} must be valid JSON`);
        }
    }

    /**
     * Validate hex color
     */
    static hexColor(value: string, fieldName: string): string {
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return this.pattern(value, hexRegex, fieldName, `${fieldName} must be a valid hex color`);
    }

    /**
     * Validate IP address
     */
    static ipAddress(value: string, fieldName: string): string {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return this.pattern(value, ipRegex, fieldName, `${fieldName} must be a valid IP address`);
    }

    /**
     * Validate port number
     */
    static port(value: number, fieldName: string): number {
        return this.numberRange(value, fieldName, 1, 65535);
    }

    /**
     * Custom validation with predicate
     */
    static custom<T>(
        value: T,
        predicate: (value: T) => boolean,
        fieldName: string,
        message?: string
    ): T {
        if (!predicate(value)) {
            throw new ValidationError(message || `${fieldName} failed custom validation`);
        }
        return value;
    }

    /**
     * Validate all items in array
     */
    static arrayItems<T>(
        array: T[],
        validator: (item: T, index: number) => T,
        fieldName: string
    ): T[] {
        return array.map((item, index) => {
            try {
                return validator(item, index);
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw new ValidationError(`${fieldName}[${index}]: ${error.message}`);
                }
                throw error;
            }
        });
    }

    /**
     * Validate object properties
     */
    static object<T extends Record<string, any>>(
        obj: T,
        validators: { [K in keyof T]?: (value: T[K]) => T[K] },
        fieldName: string = 'object'
    ): T {
        const result: Record<string, any> = { ...obj };

        for (const [key, validator] of Object.entries(validators)) {
            if (validator && key in obj) {
                try {
                    result[key] = validator(obj[key]);
                } catch (error) {
                    if (error instanceof ValidationError) {
                        throw new ValidationError(`${fieldName}.${key}: ${error.message}`);
                    }
                    throw error;
                }
            }
        }

        return result as T;
    }

    /**
     * Conditional validation
     */
    static when<T>(
        condition: boolean,
        value: T,
        validator: (value: T) => T,
        fieldName: string
    ): T {
        if (condition) {
            return validator(value);
        }
        return value;
    }

    /**
     * Try validation and return result with error
     */
    static try<T>(
        value: T,
        validator: (value: T) => T,
        fieldName: string
    ): { success: true; value: T } | { success: false; error: ValidationError } {
        try {
            const validatedValue = validator(value);
            return { success: true, value: validatedValue };
        } catch (error) {
            if (error instanceof ValidationError) {
                return { success: false, error };
            }
            return {
                success: false,
                error: new ValidationError(`${fieldName}: ${error}`)
            };
        }
    }

    /**
     * Batch validation - validate multiple values and collect all errors
     */
    static batch<T extends Record<string, any>>(
        obj: T,
        validators: { [K in keyof T]?: (value: T[K]) => T[K] }
    ): { success: true; value: T } | { success: false; errors: ValidationError[] } {
        const errors: ValidationError[] = [];
        const result: Record<string, any> = { ...obj };

        for (const [key, validator] of Object.entries(validators)) {
            if (validator && key in obj) {
                const validationResult = this.try(obj[key], validator, key);
                if (validationResult.success) {
                    result[key] = validationResult.value;
                } else {
                    errors.push(validationResult.error);
                }
            }
        }

        if (errors.length > 0) {
            return { success: false, errors };
        }

        return { success: true, value: result as T };
    }
}
