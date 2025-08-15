import {DomainError, IAppConfig, IPairSettings, PairCategory, TimeFrame} from '../../shared';
import { ExchangeConfigs } from '../../shared';
import { ILogger } from '../../shared';
import { ExchangeType } from '../../shared';
import { ITradingPairConfig } from '../usecases/ConfigureBotUseCase';
import { ConfigurationError } from '../../shared';
import {IPairRepository} from "../../domain/repositories/IPairRepository";
import {TradingPair} from "../../domain/entities/TradingPair";
import {Strategy} from "../../domain/entities/Strategy";
import {PairSettingsTemplates} from "./PairSettingsTemplates";

export interface IValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface IExchangeTestResult {
    exchange: ExchangeType;
    success: boolean;
    latency?: number;
    error?: string;
}

export class ConfigurationService {
    private tradingPairConfigs: ITradingPairConfig[] = [];

    constructor(
        private readonly appConfig: IAppConfig,
        private readonly exchangeConfigs: ExchangeConfigs,
        private readonly logger: ILogger,
        private readonly pairRepository: IPairRepository,
    ) {
        this.loadStoredConfigurations();
    }

    /**
     * Get current application configuration
     */
    async getCurrentConfiguration(): Promise<IAppConfig> {
        return this.appConfig;
    }

    /**
     * Get exchange configurations
     */
    async getExchangeConfigurations(): Promise<ExchangeConfigs> {
        return this.exchangeConfigs;
    }

    /**
     * Validate the entire configuration
     */
    async validateConfiguration(): Promise<IValidationResult> {
        const errors: string[] = [];

        try {
            // Validate app config
            this.validateAppConfig(errors);

            // Validate exchange configs
            this.validateExchangeConfigs(errors);

            // Validate trading pairs
            this.validateTradingPairConfigs(errors);

            return {
                isValid: errors.length === 0,
                errors
            };

        } catch (error: any) {
            this.logger.error('Configuration validation error:', error);
            return {
                isValid: false,
                errors: [`Validation failed: ${error.message}`]
            };
        }
    }

    /**
     * Test exchange connections
     */
    async testExchangeConnections(): Promise<IExchangeTestResult[]> {
        const results: IExchangeTestResult[] = [];
        const configuredExchanges = this.exchangeConfigs.getConfiguredExchanges();

        this.logger.info(`Testing ${configuredExchanges.length} exchange connections...`);

        for (const exchangeType of configuredExchanges) {
            try {
                const startTime = Date.now();

                // Simulate connection test
                // In real implementation, this would use the exchange adapter
                await this.simulateExchangeTest(exchangeType);

                const latency = Date.now() - startTime;

                results.push({
                    exchange: exchangeType,
                    success: true,
                    latency
                });

                this.logger.debug(`Exchange ${exchangeType} test passed`, { latency });

            } catch (error: any) {
                results.push({
                    exchange: exchangeType,
                    success: false,
                    error: error.message
                });

                this.logger.warn(`Exchange ${exchangeType} test failed:`, error.message);
            }
        }

        return results;
    }

    /**
     * Validate a specific trading pair
     */
    async validateTradingPair(symbol: string, exchange: ExchangeType): Promise<{
        isValid: boolean;
        error?: string;
        recommendation?: string;
    }> {
        try {
            // Check if exchange is configured
            if (!this.exchangeConfigs.hasExchangeConfig(exchange)) {
                return {
                    isValid: false,
                    error: `Exchange ${exchange} is not configured`
                };
            }

            // Validate symbol format
            if (!symbol.includes('/')) {
                return {
                    isValid: false,
                    error: 'Symbol must be in format BASE/QUOTE (e.g., BTC/USDT)'
                };
            }

            const [baseAsset, quoteAsset] = symbol.split('/');
            if (!baseAsset || !quoteAsset) {
                return {
                    isValid: false,
                    error: 'Invalid symbol format'
                };
            }

            // Additional validations would go here:
            // - Check if symbol exists on exchange
            // - Validate minimum volume requirements
            // - Check trading permissions

            return {
                isValid: true,
                recommendation: 'Trading pair validation passed'
            };

        } catch (error: any) {
            this.logger.error(`Error validating trading pair ${symbol}:`, error);
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    /**
     * Get trading pair configurations
     */
    async getTradingPairConfigurations(): Promise<ITradingPairConfig[]> {
        return [...this.tradingPairConfigs];
    }

    /**
     * Add trading pair configuration
     */
    async addTradingPairConfiguration(config: ITradingPairConfig): Promise<void> {
        const exists = this.tradingPairConfigs.some(
            p => p.symbol === config.symbol && p.exchange === config.exchange
        );

        if (exists) {
            throw new ConfigurationError(`Trading pair ${config.symbol} already configured for ${config.exchange}`);
        }

        this.tradingPairConfigs.push(config);
        await this.saveConfigurations();

        this.logger.info(`Added trading pair configuration: ${config.symbol} on ${config.exchange}`);
    }

    /**
     * Remove trading pair configuration
     */
    async removeTradingPairConfiguration(symbol: string, exchange: ExchangeType): Promise<void> {
        const index = this.tradingPairConfigs.findIndex(
            p => p.symbol === symbol && p.exchange === exchange
        );

        if (index === -1) {
            throw new ConfigurationError(`Trading pair ${symbol} not found for ${exchange}`);
        }

        this.tradingPairConfigs.splice(index, 1);
        await this.saveConfigurations();

        this.logger.info(`Removed trading pair configuration: ${symbol} from ${exchange}`);
    }

    /**
     * Update trading pair configuration
     */
    async updateTradingPairConfiguration(
        symbol: string,
        exchange: ExchangeType,
        updates: Partial<ITradingPairConfig>
    ): Promise<void> {
        const config = this.tradingPairConfigs.find(
            p => p.symbol === symbol && p.exchange === exchange
        );

        if (!config) {
            throw new ConfigurationError(`Trading pair ${symbol} not found for ${exchange}`);
        }

        // Apply updates
        Object.assign(config, updates);
        await this.saveConfigurations();

        this.logger.info(`Updated trading pair configuration: ${symbol} on ${exchange}`, updates);
    }

    /**
     * Get trading pairs for CLI
     */
    async getTradingPairs(): Promise<any[]> {
        // Convert internal config to CLI-friendly format
        return this.tradingPairConfigs.map(config => ({
            symbol: config.symbol,
            exchange: config.exchange,
            category: config.category,
            isActive: config.isActive ?? true,
            // Mock additional fields for CLI display
            totalSignalsGenerated: Math.floor(Math.random() * 100),
            successfulSignals: Math.floor(Math.random() * 80),
            lastSignalTime: Date.now() - Math.random() * 86400000, // Random time in last 24h
        }));
    }

    /**
     * Add trading pair (CLI interface)
     */
    async addTradingPair(config: {
        symbol: string;
        exchange: string;
        category: string;
    }): Promise<void> {
        const pairConfig: ITradingPairConfig = {
            symbol: config.symbol,
            exchange: config.exchange as ExchangeType,
            category: config.category as any,
            isActive: true
        };

        await this.addTradingPairConfiguration(pairConfig);
    }

    /**
     * Remove trading pair (CLI interface)
     */
    async removeTradingPair(symbol: string, exchange: string): Promise<void> {
        await this.removeTradingPairConfiguration(symbol, exchange as ExchangeType);
    }

    /**
     * Activate trading pair (CLI interface)
     */
    async activateTradingPair(symbol: string, exchange: string): Promise<void> {
        await this.updateTradingPairConfiguration(
            symbol,
            exchange as ExchangeType,
            { isActive: true }
        );
    }

    /**
     * Deactivate trading pair (CLI interface)
     */
    async deactivateTradingPair(symbol: string, exchange: string): Promise<void> {
        await this.updateTradingPairConfiguration(
            symbol,
            exchange as ExchangeType,
            { isActive: false }
        );
    }

    /**
     * Get configuration summary for display
     */
    async getConfigurationSummary(): Promise<{
        environment: string;
        exchanges: { name: string; enabled: boolean; configured: boolean }[];
        tradingPairs: number;
        activePairs: number;
        riskSettings: any;
        notifications: any;
    }> {
        const exchangeSummary = Object.values(ExchangeType).map(exchange => ({
            name: exchange,
            enabled: this.exchangeConfigs.hasExchangeConfig(exchange),
            configured: this.exchangeConfigs.hasExchangeConfig(exchange)
        }));

        const activePairs = this.tradingPairConfigs.filter(p => p.isActive !== false).length;

        return {
            environment: this.appConfig.environment,
            exchanges: exchangeSummary,
            tradingPairs: this.tradingPairConfigs.length,
            activePairs,
            riskSettings: {
                maxRiskPerTrade: this.appConfig.risk.maxRiskPerTrade,
                defaultStopLoss: this.appConfig.risk.defaultStopLoss,
                minConfidenceScore: this.appConfig.risk.minConfidenceScore,
                maxSimultaneousSignals: this.appConfig.risk.maxSimultaneousSignals
            },
            notifications: {
                telegram: this.appConfig.telegram.enabled,
                webhook: this.appConfig.webhook.enabled
            }
        };
    }

    /**
     * Reset configuration to defaults
     */
    async resetToDefaults(): Promise<void> {
        this.logger.warn('Resetting configuration to defaults...');

        this.tradingPairConfigs = [];
        await this.saveConfigurations();

        this.logger.info('Configuration reset to defaults');
    }

    /**
     * Export configuration
     */
    async exportConfiguration(): Promise<{
        appConfig: any;
        exchangeConfigs: any;
        tradingPairs: ITradingPairConfig[];
        timestamp: string;
    }> {
        return {
            appConfig: this.appConfig.toPlainObject(),
            exchangeConfigs: this.exchangeConfigs.toPlainObject(),
            tradingPairs: this.tradingPairConfigs,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import configuration
     */
    async importConfiguration(config: {
        tradingPairs?: ITradingPairConfig[];
    }): Promise<void> {
        this.logger.info('Importing configuration...');

        if (config.tradingPairs) {
            // Validate imported pairs
            for (const pair of config.tradingPairs) {
                const validation = await this.validateTradingPair(pair.symbol, pair.exchange);
                if (!validation.isValid) {
                    throw new ConfigurationError(`Invalid trading pair in import: ${pair.symbol} - ${validation.error}`);
                }
            }

            this.tradingPairConfigs = config.tradingPairs;
            await this.saveConfigurations();
        }

        this.logger.info('Configuration imported successfully');
    }

    // Private methods

    private validateAppConfig(errors: string[]): void {
        // Validate environment
        if (!['development', 'production', 'test'].includes(this.appConfig.environment)) {
            errors.push('Invalid environment setting');
        }

        // Validate bot config
        if (this.appConfig.bot.updateInterval < 1000) {
            errors.push('Update interval must be at least 1000ms');
        }

        if (this.appConfig.bot.maxConcurrentPairs < 1) {
            errors.push('Max concurrent pairs must be at least 1');
        }

        // Validate risk config
        if (this.appConfig.risk.maxRiskPerTrade <= 0 || this.appConfig.risk.maxRiskPerTrade > 100) {
            errors.push('Max risk per trade must be between 0 and 100');
        }

        if (this.appConfig.risk.minConfidenceScore < 1 || this.appConfig.risk.minConfidenceScore > 10) {
            errors.push('Min confidence score must be between 1 and 10');
        }
    }

    private validateExchangeConfigs(errors: string[]): void {
        if (!this.exchangeConfigs.hasAnyExchange()) {
            errors.push('At least one exchange must be configured');
        }

        const enabledExchanges = this.exchangeConfigs.getEnabledExchanges();
        if (enabledExchanges.length === 0) {
            errors.push('At least one exchange must be enabled');
        }

        // Validate that we have API credentials for enabled exchanges
        for (const exchange of enabledExchanges) {
            const config = this.exchangeConfigs.getExchangeConfig(exchange);
            if (!config?.apiKey || !config?.secretKey) {
                errors.push(`Exchange ${exchange} is enabled but missing API credentials`);
            }
        }
    }

    private validateTradingPairConfigs(errors: string[]): void {
        if (this.tradingPairConfigs.length === 0) {
            errors.push('At least one trading pair must be configured');
        }

        const activePairs = this.tradingPairConfigs.filter(p => p.isActive !== false);
        if (activePairs.length === 0) {
            errors.push('At least one trading pair must be active');
        }

        // Check for duplicates
        const seen = new Set<string>();
        for (const pair of this.tradingPairConfigs) {
            const key = `${pair.symbol}-${pair.exchange}`;
            if (seen.has(key)) {
                errors.push(`Duplicate trading pair: ${pair.symbol} on ${pair.exchange}`);
            }
            seen.add(key);
        }

        // Validate each pair
        for (const pair of this.tradingPairConfigs) {
            if (!pair.symbol || !pair.symbol.includes('/')) {
                errors.push(`Invalid symbol format: ${pair.symbol}`);
            }

            if (!this.exchangeConfigs.hasExchangeConfig(pair.exchange)) {
                errors.push(`Trading pair ${pair.symbol} references unconfigured exchange: ${pair.exchange}`);
            }
        }
    }

    private async simulateExchangeTest(exchangeType: ExchangeType): Promise<void> {
        // Simulate network delay
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        await new Promise(resolve => setTimeout(resolve, delay));

        // Simulate occasional failures
        if (Math.random() < 0.1) { // 10% failure rate
            throw new Error(`Connection timeout to ${exchangeType}`);
        }
    }

    private async loadStoredConfigurations(): Promise<void> {
        try {
            const allPairs = await this.pairRepository.findAll();

            this.tradingPairConfigs = allPairs.map(pair => ({
                symbol: pair.symbol,
                exchange: pair.exchange,
                category: pair.category,
                isActive: pair.isActive,
                customSettings: pair.settings || {}
            }));

            this.logger.debug(`Loaded ${this.tradingPairConfigs.length} trading pair configurations from repository`);
        } catch (error: any) {
            this.logger.error(`Failed to load configurations from repository: ${error.message}`);

            this.tradingPairConfigs = [];
        }
    }

    private async saveConfigurations(): Promise<void> {
        try {
            for (const config of this.tradingPairConfigs) {
                const existingPair = await this
                    .pairRepository
                    .findBySymbolAndExchange(config.symbol, config.exchange);

                if (existingPair) {
                    existingPair.isActive = config.isActive ?? true;

                    if (config.customSettings) {
                        Object.assign(existingPair.settings, config.customSettings);
                    }

                    await this.pairRepository.update(existingPair);
                } else {
                    const tradingPair = await this.createTradingPairFromConfig(config)

                    await this.pairRepository.save(tradingPair);
                }
            }
        } catch (error: any) {
            this.logger.error(`Failed to save configurations to repository: ${error.message}`);
            throw new Error(`Failed to save configurations: ${error.message}`);
        }
    }

    private async createTradingPairFromConfig(config: ITradingPairConfig): Promise<TradingPair> {
        const [baseAsset, quoteAsset] = config.symbol.split('/');

        if (!baseAsset || !quoteAsset) {
            throw new DomainError(`Invalid symbol format: ${config.symbol}`);
        }

        const appConfig = await this.getCurrentConfiguration();
        const timeframe = appConfig.trading.timeframes[appConfig.trading.mode];
        const strategy = this.createDefaultStrategy(timeframe);

        const settings = PairSettingsTemplates.generateSettings(
            config,
            timeframe,
            appConfig,
        );

        return TradingPair.create({
            symbol: config.symbol,
            baseAsset,
            quoteAsset,
            exchange: config.exchange,
            category: config.category,
            settings,
            strategy,
        });
    }

    createDefaultStrategy(timeframe: TimeFrame): Strategy {
        this.logger.debug(`Creating default strategy for timeframe: ${timeframe}`);

        switch (timeframe) {
            case TimeFrame.ONE_MINUTE:
            case TimeFrame.FIVE_MINUTES:
                return Strategy.createScalpingStrategy();

            case TimeFrame.FIFTEEN_MINUTES:
            case TimeFrame.ONE_HOUR:
                return Strategy.createSwingStrategy();

            default:
                return Strategy.createSwingStrategy();
        }
    }
}
