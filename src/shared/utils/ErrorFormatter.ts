export class ErrorFormatter {
    /**
     * Format error with context
     */
    static format(code: string, message: string, context?: Record<string, any>): string {
        if (!context || Object.keys(context).length === 0) {
            return `[${code}] ${message}`;
        }

        const contextStr = Object.entries(context)
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(', ');

        return `[${code}] ${message} (${contextStr})`;
    }

    /**
     * Format validation error
     */
    static formatValidation(field: string, message: string, value?: any): string {
        const baseMessage = `Validation error for '${field}': ${message}`;
        return value !== undefined ? `${baseMessage} (received: ${JSON.stringify(value)})` : baseMessage;
    }

    /**
     * Format API error
     */
    static formatApiError(api: string, status: number, message: string): string {
        return `${api} API error [${status}]: ${message}`;
    }

    /**
     * Format timeout error
     */
    static formatTimeout(operation: string, timeoutMs: number): string {
        return `Operation '${operation}' timed out after ${timeoutMs}ms`;
    }

    /**
     * Format rate limit error
     */
    static formatRateLimit(service: string, limit: number, resetTime: number): string {
        const resetDate = new Date(resetTime);
        return `${service} rate limit exceeded (${limit} requests), resets at ${resetDate.toISOString()}`;
    }

    /**
     * Get user-friendly error message
     */
    static getUserFriendlyMessage(error: Error): string {
        // Map technical errors to user-friendly messages
        const errorMap: Record<string, string> = {
            'NETWORK_ERROR': 'Connection problem. Please check your internet connection.',
            'AUTHENTICATION_ERROR': 'Login failed. Please check your credentials.',
            'RATE_LIMIT_ERROR': 'Too many requests. Please wait a moment and try again.',
            'VALIDATION_ERROR': 'Invalid input. Please check your data and try again.',
            'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable. Please try again later.',
            'TIMEOUT_ERROR': 'Request timed out. Please try again.',
            'CONFIGURATION_ERROR': 'Configuration problem. Please check your settings.',
            'EXCHANGE_API_ERROR': 'Exchange connection problem. Please try again later.'
        };

        // Extract error code from error message if present
        const codeMatch = error.message.match(/^\[([^\]]+)\]/);
        const errorCode = (codeMatch ? codeMatch[1] : error.name) as string;

        return errorMap[errorCode] || 'An unexpected error occurred. Please try again.';
    }
}
