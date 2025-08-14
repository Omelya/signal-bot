import {ExchangeType, IExchangeApiConfig, IExchangeConfigs} from '../types';
import { ConfigurationError } from '../errors/InfrastructureErrors';
import {IAppConfig} from "../types";

export class ExchangeConfigs implements IExchangeConfigs {
    constructor(
        public bybit?: IExchangeApiConfig,
        public binance?: IExchangeApiConfig,
        public okx?: IExchangeApiConfig,
        public coinbase?: IExchangeApiConfig
    ) {
        this.validate();
    }

    /**
     * Create ExchangeConfigs from environment variables
     */
    static fromEnvironment(): ExchangeConfigs {
        const configs: Partial<IExchangeConfigs> = {};

        // Bybit configuration
        if (process.env.BYBIT_API_KEY && process.env.BYBIT_SECRET) {
            configs.bybit = {
                apiKey: process.env.BYBIT_API_KEY,
                secretKey: process.env.BYBIT_SECRET,
                sandbox: process.env.BYBIT_SANDBOX === 'true',
                enabled: true,
                timeout: parseInt(process.env.BYBIT_TIMEOUT || '30000'),
                retryCount: parseInt(process.env.BYBIT_RETRY_COUNT || '3'),
                enableRateLimit: process.env.BYBIT_ENABLE_RATE_LIMIT !== 'false',
                baseUrl: process.env.BYBIT_BASE_URL,
                testnet: process.env.BYBIT_TESTNET === 'true'
            } as IExchangeApiConfig;
        }

        // Binance configuration
        if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
            configs.binance = {
                apiKey: process.env.BINANCE_API_KEY,
                secretKey: process.env.BINANCE_SECRET,
                sandbox: process.env.BINANCE_SANDBOX === 'true',
                enabled: true,
                timeout: parseInt(process.env.BINANCE_TIMEOUT || '30000'),
                retryCount: parseInt(process.env.BINANCE_RETRY_COUNT || '3'),
                enableRateLimit: process.env.BINANCE_ENABLE_RATE_LIMIT !== 'false',
                baseUrl: process.env.BINANCE_BASE_URL,
                testnet: process.env.BINANCE_TESTNET === 'true'
            } as IExchangeApiConfig;
        }

        // OKX configuration
        if (process.env.OKX_API_KEY && process.env.OKX_SECRET && process.env.OKX_PASSPHRASE) {
            configs.okx = {
                apiKey: process.env.OKX_API_KEY,
                secretKey: process.env.OKX_SECRET,
                passphrase: process.env.OKX_PASSPHRASE,
                sandbox: process.env.OKX_SANDBOX === 'true',
                enabled: true,
                timeout: parseInt(process.env.OKX_TIMEOUT || '30000'),
                retryCount: parseInt(process.env.OKX_RETRY_COUNT || '3'),
                enableRateLimit: process.env.OKX_ENABLE_RATE_LIMIT !== 'false',
                baseUrl: process.env.OKX_BASE_URL,
                testnet: process.env.OKX_TESTNET === 'true'
            } as IExchangeApiConfig;
        }

        // Coinbase configuration
        if (process.env.COINBASE_API_KEY && process.env.COINBASE_SECRET) {
            configs.coinbase = {
                apiKey: process.env.COINBASE_API_KEY,
                secretKey: process.env.COINBASE_SECRET,
                sandbox: process.env.COINBASE_SANDBOX === 'true',
                enabled: true,
                timeout: parseInt(process.env.COINBASE_TIMEOUT || '30000'),
                retryCount: parseInt(process.env.COINBASE_RETRY_COUNT || '3'),
                enableRateLimit: process.env.COINBASE_ENABLE_RATE_LIMIT !== 'false',
                baseUrl: process.env.COINBASE_BASE_URL,
                testnet: process.env.COINBASE_TESTNET === 'true'
            } as IExchangeApiConfig;
        }

        return new ExchangeConfigs(
            configs.bybit,
            configs.binance,
            configs.okx,
            configs.coinbase
        );
    }

    /**
     * Create ExchangeConfigs from AppConfig
     */
    static fromAppConfig(appConfig: IAppConfig): ExchangeConfigs {
        // For now, delegate to fromEnvironment
        // In the future, we might extend AppConfig to include exchange configs
        return ExchangeConfigs.fromEnvironment();
    }

    /**
     * Get configuration for a specific exchange
     */
    getExchangeConfig(exchange: ExchangeType): IExchangeApiConfig | undefined {
        switch (exchange) {
            case ExchangeType.BYBIT:
                return this.bybit;
            case ExchangeType.BINANCE:
                return this.binance;
            case ExchangeType.OKX:
                return this.okx;
            default:
                return undefined;
        }
    }

    /**
     * Check if an exchange is configured
     */
    hasExchangeConfig(exchange: ExchangeType): boolean {
        return this.getExchangeConfig(exchange) !== undefined;
    }

    /**
     * Get all configured exchanges
     */
    getConfiguredExchanges(): ExchangeType[] {
        const exchanges: ExchangeType[] = [];

        if (this.bybit?.enabled) exchanges.push(ExchangeType.BYBIT);
        if (this.binance?.enabled) exchanges.push(ExchangeType.BINANCE);
        if (this.okx?.enabled) exchanges.push(ExchangeType.OKX);

        return exchanges;
    }

    /**
     * Get enabled exchanges only
     */
    getEnabledExchanges(): ExchangeType[] {
        return this.getConfiguredExchanges().filter(exchange => {
            const config = this.getExchangeConfig(exchange);
            return config?.enabled === true;
        });
    }

    /**
     * Get sandbox/testnet exchanges
     */
    getSandboxExchanges(): ExchangeType[] {
        return this.getConfiguredExchanges().filter(exchange => {
            const config = this.getExchangeConfig(exchange);
            return config?.sandbox === true || config?.testnet === true;
        });
    }

    /**
     * Get production exchanges
     */
    getProductionExchanges(): ExchangeType[] {
        return this.getConfiguredExchanges().filter(exchange => {
            const config = this.getExchangeConfig(exchange);
            return config?.sandbox !== true && config?.testnet !== true;
        });
    }

    /**
     * Check if any exchange is configured
     */
    hasAnyExchange(): boolean {
        return this.getConfiguredExchanges().length > 0;
    }

    /**
     * Check if exchange is in sandbox/test mode
     */
    isExchangeInSandbox(exchange: ExchangeType): boolean {
        const config = this.getExchangeConfig(exchange);
        return config?.sandbox === true || config?.testnet === true;
    }

    /**
     * Get exchange configuration summary
     */
    getSummary(): {
        total: number;
        enabled: number;
        sandbox: number;
        production: number;
        exchanges: {
            exchange: ExchangeType;
            enabled: boolean;
            sandbox: boolean;
            hasCredentials: boolean;
        }[];
    } {
        const allExchanges = Object.values(ExchangeType);
        const exchanges = allExchanges.map(exchange => {
            const config = this.getExchangeConfig(exchange);
            return {
                exchange,
                enabled: config?.enabled === true,
                sandbox: config?.sandbox === true || config?.testnet === true,
                hasCredentials: Boolean(config?.apiKey && config?.secretKey)
            };
        });

        return {
            total: this.getConfiguredExchanges().length,
            enabled: this.getEnabledExchanges().length,
            sandbox: this.getSandboxExchanges().length,
            production: this.getProductionExchanges().length,
            exchanges
        };
    }

    /**
     * Convert to plain object (with sensitive data redacted)
     */
    toPlainObject(): Record<string, any> {
        const redactConfig = (config?: IExchangeApiConfig) => {
            if (!config) return undefined;

            return {
                ...config,
                apiKey: config.apiKey ? '[REDACTED]' : '',
                secretKey: config.secretKey ? '[REDACTED]' : '',
                passphrase: config.passphrase ? '[REDACTED]' : undefined
            };
        };

        return {
            bybit: redactConfig(this.bybit),
            binance: redactConfig(this.binance),
            okx: redactConfig(this.okx),
            coinbase: redactConfig(this.coinbase)
        };
    }

    /**
     * Create a test configuration
     */
    static createTestConfig(): ExchangeConfigs {
        return new ExchangeConfigs(
            {
                apiKey: 'test_bybit_api_key',
                secretKey: 'test_bybit_secret',
                sandbox: true,
                enabled: true,
                timeout: 5000,
                retryCount: 2,
                enableRateLimit: true
            },
            {
                apiKey: 'test_binance_api_key',
                secretKey: 'test_binance_secret',
                sandbox: true,
                enabled: true,
                timeout: 5000,
                retryCount: 2,
                enableRateLimit: true
            }
        );
    }

    /**
     * Validate configurations
     */
    private validate(): void {
        // Check if at least one exchange is configured
        if (!this.hasAnyExchange()) {
            throw new ConfigurationError('At least one exchange must be configured');
        }

        // Validate each configured exchange
        const configs = [
            { name: 'Bybit', config: this.bybit },
            { name: 'Binance', config: this.binance },
            { name: 'OKX', config: this.okx },
            { name: 'Coinbase', config: this.coinbase }
        ];

        for (const { name, config } of configs) {
            if (config) {
                this.validateExchangeConfig(name, config);
            }
        }
    }

    /**
     * Validate individual exchange configuration
     */
    private validateExchangeConfig(name: string, config: IExchangeApiConfig): void {
        if (!config.apiKey || config.apiKey.trim().length === 0) {
            throw new ConfigurationError(`${name} API key cannot be empty`);
        }

        if (!config.secretKey || config.secretKey.trim().length === 0) {
            throw new ConfigurationError(`${name} secret key cannot be empty`);
        }

        // Special validation for OKX
        if (name === 'OKX' && (!config.passphrase || config.passphrase.trim().length === 0)) {
            throw new ConfigurationError('OKX passphrase is required');
        }

        if (config.timeout < 1000 || config.timeout > 60000) {
            throw new ConfigurationError(`${name} timeout must be between 1000ms and 60000ms`);
        }

        if (config.retryCount < 0 || config.retryCount > 10) {
            throw new ConfigurationError(`${name} retry count must be between 0 and 10`);
        }

        // Validate API key format (basic checks)
        if (config.apiKey.length < 10) {
            console.warn(`${name} API key seems too short, please verify`);
        }

        if (config.secretKey.length < 10) {
            console.warn(`${name} secret key seems too short, please verify`);
        }
    }
}
