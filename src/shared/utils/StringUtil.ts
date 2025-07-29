export class StringUtil {
    /**
     * Convert string to kebab-case
     */
    static toKebabCase(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
    }

    /**
     * Convert string to camelCase
     */
    static toCamelCase(str: string): string {
        return str
            .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
            .replace(/^[A-Z]/, c => c.toLowerCase());
    }

    /**
     * Convert string to PascalCase
     */
    static toPascalCase(str: string): string {
        const camelCase = this.toCamelCase(str);
        return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    }

    /**
     * Convert string to snake_case
     */
    static toSnakeCase(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[-\s]+/g, '_')
            .toLowerCase();
    }

    /**
     * Capitalize first letter
     */
    static capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Capitalize each word
     */
    static titleCase(str: string): string {
        return str
            .toLowerCase()
            .split(/[\s-_]+/)
            .map(word => this.capitalize(word))
            .join(' ');
    }

    /**
     * Truncate string with ellipsis
     */
    static truncate(str: string, maxLength: number, suffix: string = '...'): string {
        if (str.length <= maxLength) {
            return str;
        }
        return str.slice(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Truncate string to word boundary
     */
    static truncateWords(str: string, maxLength: number, suffix: string = '...'): string {
        if (str.length <= maxLength) {
            return str;
        }

        const truncated = str.slice(0, maxLength - suffix.length);
        const lastSpaceIndex = truncated.lastIndexOf(' ');

        if (lastSpaceIndex > 0) {
            return truncated.slice(0, lastSpaceIndex) + suffix;
        }

        return truncated + suffix;
    }

    /**
     * Pad string with specified character
     */
    static pad(str: string, length: number, char: string = ' ', direction: 'left' | 'right' | 'both' = 'right'): string {
        if (str.length >= length) {
            return str;
        }

        const padding = char.repeat(length - str.length);

        switch (direction) {
            case 'left':
                return padding + str;
            case 'both':
                const leftPad = Math.floor(padding.length / 2);
                const rightPad = padding.length - leftPad;
                return char.repeat(leftPad) + str + char.repeat(rightPad);
            case 'right':
            default:
                return str + padding;
        }
    }

    /**
     * Remove all whitespace
     */
    static removeWhitespace(str: string): string {
        return str.replace(/\s+/g, '');
    }

    /**
     * Normalize whitespace (replace multiple spaces with single space)
     */
    static normalizeWhitespace(str: string): string {
        return str.replace(/\s+/g, ' ').trim();
    }

    /**
     * Remove accents and diacritics
     */
    static removeAccents(str: string): string {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Generate random string
     */
    static random(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Generate random alphanumeric string
     */
    static randomAlphanumeric(length: number): string {
        return this.random(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    }

    /**
     * Generate random numeric string
     */
    static randomNumeric(length: number): string {
        return this.random(length, '0123456789');
    }

    /**
     * Generate random alphabetic string
     */
    static randomAlphabetic(length: number): string {
        return this.random(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
    }

    /**
     * Check if string is empty or whitespace only
     */
    static isBlank(str: string | null | undefined): boolean {
        return !str || str.trim().length === 0;
    }

    /**
     * Check if string is not empty and not whitespace only
     */
    static isNotBlank(str: string | null | undefined): str is string {
        return !this.isBlank(str);
    }

    /**
     * Count occurrences of substring
     */
    static count(str: string, substring: string): number {
        if (substring.length === 0) return 0;

        let count = 0;
        let position = 0;

        while ((position = str.indexOf(substring, position)) !== -1) {
            count++;
            position += substring.length;
        }

        return count;
    }

    /**
     * Replace all occurrences
     */
    static replaceAll(str: string, search: string, replace: string): string {
        return str.split(search).join(replace);
    }

    /**
     * Escape HTML characters
     */
    static escapeHtml(str: string): string {
        const htmlEscapes: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        return str.replace(/[&<>"'/]/g, char => htmlEscapes[char] as string);
    }

    /**
     * Unescape HTML characters
     */
    static unescapeHtml(str: string): string {
        const htmlUnescapes: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#x27;': "'",
            '&#x2F;': '/'
        };

        return str.replace(/&(?:amp|lt|gt|quot|#x27|#x2F);/g, entity => htmlUnescapes[entity] as string);
    }

    /**
     * Escape regex special characters
     */
    static escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Split string into chunks
     */
    static chunk(str: string, size: number): string[] {
        if (size <= 0) throw new Error('Chunk size must be positive');

        const chunks: string[] = [];
        for (let i = 0; i < str.length; i += size) {
            chunks.push(str.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Reverse string
     */
    static reverse(str: string): string {
        return str.split('').reverse().join('');
    }

    /**
     * Check if string is palindrome
     */
    static isPalindrome(str: string, caseSensitive: boolean = false): boolean {
        const normalized = caseSensitive ? str : str.toLowerCase();
        return normalized === this.reverse(normalized);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    static levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = Array(str2.length + 1).fill(null).map(() =>
            Array(str1.length + 1).fill(0)
        );

        for (let i = 0; i <= str2.length; i++) {
            matrix[i]![0] = i;
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0]![j] = j;
        }

        // Fill the matrix
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i]![j] = matrix[i - 1]![j - 1]!;
                } else {
                    matrix[i]![j] = Math.min(
                        matrix[i - 1]![j - 1]! + 1, // substitution
                        matrix[i]![j - 1]! + 1,     // insertion
                        matrix[i - 1]![j]! + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length]![str1.length]!;
    }

    /**
     * Calculate string similarity (0-1 based on Levenshtein distance)
     */
    static similarity(str1: string, str2: string): number {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;

        const distance = this.levenshteinDistance(str1, str2);
        return (maxLength - distance) / maxLength;
    }

    /**
     * Find most similar string from array
     */
    static findMostSimilar(target: string, candidates: string[]): { string: string; similarity: number } | null {
        if (candidates.length === 0) return null;

        let bestMatch = candidates[0] as string;
        let bestSimilarity = this.similarity(target, bestMatch);

        for (let i = 1; i < candidates.length; i++) {
            const similarity = this.similarity(target, candidates[i] as string);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = candidates[i] as string;
            }
        }

        return { string: bestMatch, similarity: bestSimilarity };
    }

    /**
     * Extract words from string
     */
    static extractWords(str: string): string[] {
        return str.match(/\b\w+\b/g) || [];
    }

    /**
     * Count words in string
     */
    static wordCount(str: string): number {
        return this.extractWords(str).length;
    }

    /**
     * Get initials from string
     */
    static getInitials(str: string, maxInitials: number = 2): string {
        const words = this.extractWords(str);
        return words
            .slice(0, maxInitials)
            .map(word => word.charAt(0).toUpperCase())
            .join('');
    }

    /**
     * Mask string (for sensitive data)
     */
    static mask(str: string, maskChar: string = '*', visibleStart: number = 0, visibleEnd: number = 0): string {
        if (str.length <= visibleStart + visibleEnd) {
            return str;
        }

        const start = str.slice(0, visibleStart);
        const end = str.slice(-visibleEnd);
        const middle = maskChar.repeat(str.length - visibleStart - visibleEnd);

        return start + middle + end;
    }

    /**
     * Extract numbers from string
     */
    static extractNumbers(str: string): number[] {
        const matches = str.match(/-?\d+\.?\d*/g);
        return matches ? matches.map(Number) : [];
    }

    /**
     * Format bytes to human readable string
     */
    static formatBytes(bytes: number, decimals: number = 2): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    }

    /**
     * Format duration in milliseconds to human readable string
     */
    static formatDuration(ms: number): string {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0) parts.push(`${seconds}s`);

        return parts.length > 0 ? parts.join(' ') : '0s';
    }

    /**
     * Generate slug from string
     */
    static slug(str: string, separator: string = '-'): string {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/[\s_-]+/g, separator) // Replace spaces and underscores with separator
            .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');
    }
}