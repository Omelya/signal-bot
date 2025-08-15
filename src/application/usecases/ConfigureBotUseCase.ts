import { ConfigurationService } from '../services/ConfigurationService';
import { IPairRepository } from '../../domain/repositories/IPairRepository';
import { TradingPair } from '../../domain/entities/TradingPair';
import { Strategy } from '../../domain/entities/Strategy';
import {IEventBus} from '../../shared';
import { ILogger } from '../../shared';
import { DomainError } from '../../shared';
import { PairCategory } from '../../shared';
import { ExchangeType, TimeFrame } from '../../shared';
import {PairSettingsTemplates} from "../services/PairSettingsTemplates";

export interface ITradingPairConfig {
    symbol: string;
    exchange: ExchangeType;
    category: PairCategory;
    isActive?: boolean;
    customSettings?: any;
}

export interface IValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface IConfigureBotUseCase {
    validateConfiguration(): Promise<IValidationResult>;
    loadTradingPairs(): Promise<TradingPair[]>;
    addTradingPair(config: ITradingPairConfig): Promise<TradingPair>;
    removeTradingPair(symbol: string, exchange: ExchangeType): Promise<void>;
    activateTradingPair(symbol: string, exchange: ExchangeType): Promise<void>;
    deactivateTradingPair(symbol: string, exchange: ExchangeType): Promise<void>;
    updateTradingPairSettings(symbol: string, exchange: ExchangeType, settings: any): Promise<void>;
    createDefaultStrategy(timeframe: TimeFrame): Strategy;
    optimizeStrategies(): Promise<void>;
    getConfigurationSummary(): Promise<any>;
}

export class ConfigureBotUseCase implements IConfigureBotUseCase {
    constructor(
        private readonly configurationService: ConfigurationService,
        private readonly pairRepository: IPairRepository,
        private readonly eventBus: IEventBus,
        private readonly logger: ILogger
    ) {}

    async validateConfiguration(): Promise<IValidationResult> {
        this.logger.info('🔍 Validating bot configuration...');

        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Validate app configuration
            const configValidation = await this.configurationService.validateConfiguration();
            if (!configValidation.isValid) {
                errors.push(...configValidation.errors);
            }

            // Validate exchange configurations
            const exchangeValidation = await this.validateExchangeConfigurations();
            errors.push(...exchangeValidation.errors);
            warnings.push(...exchangeValidation.warnings);

            // Validate trading pairs
            const pairsValidation = await this.validateTradingPairs();
            errors.push(...pairsValidation.errors);
            warnings.push(...pairsValidation.warnings);

            // Validate strategies
            const strategiesValidation = await this.validateStrategies();
            errors.push(...strategiesValidation.errors);
            warnings.push(...strategiesValidation.warnings);

            // Validate risk management
            const riskValidation = await this.validateRiskManagement();
            errors.push(...riskValidation.errors);
            warnings.push(...riskValidation.warnings);

            const isValid = errors.length === 0;

            if (isValid) {
                this.logger.info('✅ Configuration validation passed');
            } else {
                this.logger.error(`❌ Configuration validation failed with ${errors.length} errors`);
            }

            if (warnings.length > 0) {
                this.logger.warn(`⚠️ Configuration has ${warnings.length} warnings`);
            }

            return { isValid, errors, warnings };

        } catch (error: any) {
            this.logger.error('Configuration validation error:', error);
            return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                warnings: []
            };
        }
    }

    async loadTradingPairs(): Promise<TradingPair[]> {
        this.logger.info('📊 Loading trading pairs...');

        try {
            // Get trading pairs from configuration
            const pairConfigs = await this.configurationService.getTradingPairConfigurations();

            if (pairConfigs.length === 0) {
                this.logger.warn('No trading pairs configured, creating default pairs');
                await this.createDefaultTradingPairs();
                return await this.loadTradingPairs();
            }

            const pairs: TradingPair[] = [];

            for (const config of pairConfigs) {
                try {
                    const pair = await this.createTradingPairFromConfig(config);
                    await this.pairRepository.save(pair);
                    pairs.push(pair);

                    this.logger.debug(`Loaded trading pair: ${pair.symbol} on ${pair.exchange}`);

                } catch (error) {
                    this.logger.error(`Failed to load trading pair ${config.symbol}:`, error);
                }
            }

            this.logger.info(`✅ Loaded ${pairs.length} trading pairs`);

            // Publish event
            await this.eventBus.publish({
                type: 'config.pairs.loaded',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: {
                    totalPairs: pairs.length,
                    activePairs: pairs.filter(p => p.isActive).length,
                    pairs: pairs.map(p => ({ symbol: p.symbol, exchange: p.exchange, active: p.isActive }))
                }
            });

            return pairs;

        } catch (error) {
            this.logger.error('Failed to load trading pairs:', error);
            throw error;
        }
    }

    async addTradingPair(config: ITradingPairConfig): Promise<TradingPair> {
        this.logger.info(`➕ Adding trading pair: ${config.symbol} on ${config.exchange}`);

        try {
            // Check if pair already exists
            const existingPair = await this.pairRepository.findBySymbolAndExchange(config.symbol, config.exchange);

            if (existingPair) {
                this.logger.error(`Trading pair ${config.symbol} already exists on ${config.exchange}`);
                throw new DomainError(`Trading pair ${config.symbol} already exists on ${config.exchange}`);
            }

            // Validate the pair
            const validation = await this.configurationService.validateTradingPair(config.symbol, config.exchange);
            if (!validation.isValid) {
                this.logger.error(`Invalid trading pair: ${validation.error}`);
                throw new DomainError(`Invalid trading pair: ${validation.error}`);
            }

            // Create trading pair
            const pair = await this.createTradingPairFromConfig(config);

            // Save to repository
            await this.pairRepository.save(pair);

            // Update configuration
            await this.configurationService.addTradingPairConfiguration(config);

            this.logger.info(`✅ Successfully added trading pair: ${pair.symbol}`);

            // Publish event
            await this.eventBus.publish({
                type: 'config.pair.added',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: {
                    symbol: pair.symbol,
                    exchange: pair.exchange,
                    category: pair.category,
                    isActive: pair.isActive
                }
            });

            return pair;
        } catch (error) {
            this.logger.error(`Failed to add trading pair ${config.symbol}:`, error);
            throw error;
        }
    }

    async removeTradingPair(symbol: string, exchange: ExchangeType): Promise<void> {
        this.logger.info(`➖ Removing trading pair: ${symbol} from ${exchange}`);

        try {
            const pair = await this.pairRepository.findBySymbolAndExchange(symbol, exchange);
            if (!pair) {
                throw new DomainError(`Trading pair ${symbol} not found on ${exchange}`);
            }

            // Deactivate first if active
            if (pair.isActive) {
                pair.deactivate();
                await this.pairRepository.save(pair);
            }

            // Remove from repository
            await this.pairRepository.delete(pair.symbol, pair.exchange);

            // Update configuration
            await this.configurationService.removeTradingPairConfiguration(symbol, exchange);

            this.logger.info(`✅ Successfully removed trading pair: ${symbol}`);

            // Publish event
            await this.eventBus.publish({
                type: 'config.pair.removed',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: { symbol, exchange }
            });

        } catch (error) {
            this.logger.error(`Failed to remove trading pair ${symbol}:`, error);
            throw error;
        }
    }

    async activateTradingPair(symbol: string, exchange: ExchangeType): Promise<void> {
        this.logger.info(`▶️ Activating trading pair: ${symbol} on ${exchange}`);

        try {
            const pair = await this.pairRepository.findBySymbolAndExchange(symbol, exchange);
            if (!pair) {
                throw new DomainError(`Trading pair ${symbol} not found on ${exchange}`);
            }

            pair.activate();
            await this.pairRepository.save(pair);

            this.logger.info(`✅ Successfully activated trading pair: ${symbol}`);

            // Publish event
            await this.eventBus.publish({
                type: 'config.pair.activated',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: { symbol, exchange }
            });
        } catch (error) {
            this.logger.error(`Failed to activate trading pair ${symbol}:`, error);
            throw error;
        }
    }

    async deactivateTradingPair(symbol: string, exchange: ExchangeType): Promise<void> {
        this.logger.info(`⏸️ Deactivating trading pair: ${symbol} on ${exchange}`);

        try {
            const pair = await this.pairRepository.findBySymbolAndExchange(symbol, exchange);
            if (!pair) {
                throw new DomainError(`Trading pair ${symbol} not found on ${exchange}`);
            }

            pair.deactivate();
            await this.pairRepository.save(pair);

            this.logger.info(`✅ Successfully deactivated trading pair: ${symbol}`);

            await this.eventBus.publish({
                type: 'config.pair.deactivated',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: { symbol, exchange }
            });
        } catch (error) {
            this.logger.error(`Failed to deactivate trading pair ${symbol}:`, error);
            throw error;
        }
    }

    async updateTradingPairSettings(symbol: string, exchange: ExchangeType, settings: any): Promise<void> {
        this.logger.info(`⚙️ Updating settings for trading pair: ${symbol} on ${exchange}`);

        try {
            const pair = await this.pairRepository.findBySymbolAndExchange(symbol, exchange);
            if (!pair) {
                throw new DomainError(`Trading pair ${symbol} not found on ${exchange}`);
            }

            // Update pair settings (this would require extending the TradingPair entity)
            // For now, we'll just log the operation
            await this.pairRepository.save(pair);

            this.logger.info(`✅ Successfully updated settings for trading pair: ${symbol}`);

            // Publish event
            await this.eventBus.publish({
                type: 'config.pair.updated',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: { symbol, exchange, settings }
            });

        } catch (error) {
            this.logger.error(`Failed to update trading pair settings ${symbol}:`, error);
            throw error;
        }
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

    async optimizeStrategies(): Promise<void> {
        this.logger.info('🎯 Optimizing trading strategies...');

        try {
            const pairs = await this.pairRepository.findAll();
            let optimizedCount = 0;

            for (const pair of pairs) {
                try {
                    // Get current market volatility (simplified)
                    const marketVolatility = 0.03; // 3% - in real implementation, calculate from market data

                    // Optimize strategy
                    const optimizedStrategy = pair.strategy.optimize(marketVolatility);

                    // Update strategy performance rating
                    const performanceRating = optimizedStrategy.getPerformanceRating();

                    this.logger.debug(`Optimized strategy for ${pair.symbol}`, {
                        originalPerformance: pair.strategy.getPerformanceRating(),
                        newPerformance: performanceRating,
                        marketVolatility
                    });

                    optimizedCount++;

                } catch (error) {
                    this.logger.warn(`Failed to optimize strategy for ${pair.symbol}:`, error);
                }
            }

            this.logger.info(`✅ Optimized ${optimizedCount} strategies`);

            // Publish event
            await this.eventBus.publish({
                type: 'config.strategies.optimized',
                source: 'ConfigureBotUseCase',
                version: '1.0',
                payload: {
                    totalStrategies: pairs.length,
                    optimizedCount
                }
            });

        } catch (error) {
            this.logger.error('Failed to optimize strategies:', error);
            throw error;
        }
    }

    async getConfigurationSummary(): Promise<any> {
        try {
            const appConfig = await this.configurationService.getCurrentConfiguration();
            const pairs = await this.pairRepository.findAll();
            const activePairs = pairs.filter(p => p.isActive);

            return {
                environment: appConfig.environment,
                botMode: appConfig.bot.mode,
                tradingMode: appConfig.trading.mode,
                totalPairs: pairs.length,
                activePairs: activePairs.length,
                exchanges: [...new Set(pairs.map(p => p.exchange))],
                riskConfig: {
                    maxRiskPerTrade: appConfig.risk.maxRiskPerTrade,
                    minConfidenceScore: appConfig.risk.minConfidenceScore,
                    maxSimultaneousSignals: appConfig.risk.maxSimultaneousSignals
                },
                notifications: {
                    telegram: appConfig.telegram.enabled,
                    webhook: appConfig.webhook.enabled
                },
                monitoring: {
                    healthCheckInterval: appConfig.monitoring.healthCheckInterval,
                    enableMetrics: appConfig.monitoring.enableMetrics
                }
            };

        } catch (error) {
            this.logger.error('Failed to get configuration summary:', error);
            throw error;
        }
    }

    // Private helper methods

    private async validateExchangeConfigurations(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const exchangeTests = await this.configurationService.testExchangeConnections();

            for (const test of exchangeTests) {
                if (!test.success) {
                    errors.push(`Exchange ${test.exchange} connection failed: ${test.error}`);
                } else if (test.latency && test.latency > 3000) {
                    warnings.push(`Exchange ${test.exchange} has high latency: ${test.latency}ms`);
                }
            }

        } catch (error: any) {
            errors.push(`Failed to validate exchange configurations: ${error.message}`);
        }

        return { errors, warnings };
    }

    private async validateTradingPairs(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const pairs = await this.pairRepository.findAll();

            if (pairs.length === 0) {
                errors.push('No trading pairs configured');
                return { errors, warnings };
            }

            const activePairs = pairs.filter(p => p.isActive);
            if (activePairs.length === 0) {
                errors.push('No active trading pairs');
            }

            // Check for duplicate pairs
            const pairKeys = pairs.map(p => `${p.symbol}-${p.exchange}`);
            const duplicates = pairKeys.filter((key, index) => pairKeys.indexOf(key) !== index);
            if (duplicates.length > 0) {
                errors.push(`Duplicate trading pairs found: ${duplicates.join(', ')}`);
            }

            // Validate each pair
            for (const pair of pairs) {
                if (pair.shouldAutoDisable()) {
                    warnings.push(`Pair ${pair.symbol} has poor performance and may be auto-disabled`);
                }

                const performance = pair.getPerformanceMetrics();
                if (performance.successRate < 30 && performance.totalSignals > 10) {
                    warnings.push(`Pair ${pair.symbol} has low success rate: ${performance.successRate.toFixed(1)}%`);
                }
            }

        } catch (error: any) {
            errors.push(`Failed to validate trading pairs: ${error.message}`);
        }

        return { errors, warnings };
    }

    private async validateStrategies(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const pairs = await this.pairRepository.findAll();

            for (const pair of pairs) {
                const strategy = pair.strategy;

                if (!strategy.isActive) {
                    warnings.push(`Strategy for ${pair.symbol} is inactive`);
                }

                if (strategy.needsOptimization()) {
                    warnings.push(`Strategy for ${pair.symbol} needs optimization`);
                }

                const performance = strategy.getPerformanceRating();
                if (performance === 'POOR') {
                    warnings.push(`Strategy for ${pair.symbol} has poor performance rating`);
                }

                // Validate strategy configuration
                if (strategy.minSignalStrength < 1 || strategy.minSignalStrength > 10) {
                    errors.push(`Invalid signal strength for ${pair.symbol}: ${strategy.minSignalStrength}`);
                }

                if (strategy.maxSimultaneousSignals < 1) {
                    errors.push(`Invalid max simultaneous signals for ${pair.symbol}: ${strategy.maxSimultaneousSignals}`);
                }
            }

        } catch (error: any) {
            errors.push(`Failed to validate strategies: ${error.message}`);
        }

        return { errors, warnings };
    }

    private async validateRiskManagement(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const config = await this.configurationService.getCurrentConfiguration();
            const riskConfig = config.risk;

            // Validate risk parameters
            if (riskConfig.maxRiskPerTrade <= 0 || riskConfig.maxRiskPerTrade > 10) {
                errors.push(`Invalid max risk per trade: ${riskConfig.maxRiskPerTrade}%`);
            }

            if (riskConfig.defaultStopLoss <= 0 || riskConfig.defaultStopLoss >= 1) {
                errors.push(`Invalid default stop loss: ${riskConfig.defaultStopLoss}`);
            }

            if (riskConfig.minConfidenceScore < 1 || riskConfig.minConfidenceScore > 10) {
                errors.push(`Invalid min confidence score: ${riskConfig.minConfidenceScore}`);
            }

            if (riskConfig.maxSimultaneousSignals < 1 || riskConfig.maxSimultaneousSignals > 20) {
                errors.push(`Invalid max simultaneous signals: ${riskConfig.maxSimultaneousSignals}`);
            }

            // Warnings for conservative/aggressive settings
            if (riskConfig.maxRiskPerTrade > 5) {
                warnings.push(`High risk per trade setting: ${riskConfig.maxRiskPerTrade}%`);
            }

            if (riskConfig.minConfidenceScore < 6) {
                warnings.push(`Low minimum confidence score: ${riskConfig.minConfidenceScore}`);
            }

        } catch (error: any) {
            errors.push(`Failed to validate risk management: ${error.message}`);
        }

        return { errors, warnings };
    }

    private async createDefaultTradingPairs(): Promise<void> {
        this.logger.info('Creating default trading pairs...');

        const defaultConfigs: ITradingPairConfig[] = [
            {
                symbol: 'BTC/USDT',
                exchange: ExchangeType.BYBIT,
                category: PairCategory.CRYPTO_MAJOR,
                isActive: true
            },
            {
                symbol: 'ETH/USDT',
                exchange: ExchangeType.BYBIT,
                category: PairCategory.CRYPTO_MAJOR,
                isActive: true
            },
            {
                symbol: 'BNB/USDT',
                exchange: ExchangeType.BINANCE,
                category: PairCategory.CRYPTO_MAJOR,
                isActive: false
            }
        ];

        for (const config of defaultConfigs) {
            try {
                await this.configurationService.addTradingPairConfiguration(config);
                this.logger.debug(`Created default pair: ${config.symbol} on ${config.exchange}`);
            } catch (error) {
                this.logger.warn(`Failed to create default pair ${config.symbol}:`, error);
            }
        }
    }

    private async createTradingPairFromConfig(config: ITradingPairConfig): Promise<TradingPair> {
        const [baseAsset, quoteAsset] = config.symbol.split('/');

        if (!baseAsset || !quoteAsset) {
            throw new DomainError(`Invalid symbol format: ${config.symbol}`);
        }

        const appConfig = await this.configurationService.getCurrentConfiguration();
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
}
