import { DIContainer } from './DIContainer';
import { ConfigurationError } from '../errors/InfrastructureErrors';
import {ExchangeConfigs} from "../config/ExchangeConfigs";
import {AppConfig} from "../config/AppConfig";

export class ServiceProvider {
    /**
     * Configure all services in the DI container
     */
    static configureServices(container: DIContainer): void {
        // Configuration services
        this.configureConfiguration(container);

        // Infrastructure services
        this.configureInfrastructure(container);

        // Domain services
        this.configureDomain(container);

        // Application services
        this.configureApplication(container);

        // Interface services
        this.configureInterfaces(container);

        // Validate container configuration
        const validation = container.validate();
        if (!validation.valid) {
            throw new ConfigurationError(
                `DI Container validation failed: ${validation.errors.join(', ')}`
            );
        }
    }

    /**
     * Configure configuration services
     */
    private static configureConfiguration(container: DIContainer): void {
        // App configuration
        container.register('appConfig', () => {
            const AppConfig = require('../config/AppConfig').AppConfig;
            return AppConfig.fromEnvironment();
        });

        // Exchange configurations
        container.register('exchangeConfigs', (c) => {
            const ExchangeConfigs = require('../config/ExchangeConfigs').ExchangeConfigs;
            const appConfig = c.get('appConfig');
            return ExchangeConfigs.fromAppConfig(appConfig);
        }, { dependencies: ['appConfig'] });
    }

    /**
     * Configure infrastructure services
     */
    private static configureInfrastructure(container: DIContainer): void {
        // Logger is registered externally in main.ts

        // Exchange adapters
        container.register('bybitAdapter', (c) => {
            const BybitAdapter = require('../../infrastructure/exchanges/adapters/BybitAdapter').BybitAdapter;
            const configs = c.get('exchangeConfigs') as ExchangeConfigs;
            const logger = c.get('logger');
            return new BybitAdapter(configs.bybit, logger);
        }, { dependencies: ['exchangeConfigs', 'logger'] });

        container.register('binanceAdapter', (c) => {
            const BinanceAdapter = require('../../infrastructure/exchanges/adapters/BinanceAdapter').BinanceAdapter;
            const configs = c.get('exchangeConfigs') as ExchangeConfigs;
            const logger = c.get('logger');
            return new BinanceAdapter(configs.binance, logger);
        }, { dependencies: ['exchangeConfigs', 'logger'] });

        // Exchange factory
        container.register('exchangeFactory', (c) => {
            const ExchangeFactory = require('../../infrastructure/exchanges/factories/ExchangeFactory').ExchangeFactory;
            return new ExchangeFactory(c);
        });

        // Repositories
        container.register('signalRepository', (c) => {
            const appConfig = c.get('appConfig') as AppConfig;
            const logger = c.get('logger');

            if (appConfig.redis.enabled) {
                const RedisSignalRepository = require('../../infrastructure/persistence/RedisSignalRepository').RedisSignalRepository;
                return new RedisSignalRepository(appConfig.redis, logger);
            } else {
                const InMemorySignalRepository = require('../../infrastructure/persistence/InMemorySignalRepository').InMemorySignalRepository;
                return new InMemorySignalRepository(logger);
            }
        }, { dependencies: ['appConfig', 'logger'] });

        container.register('pairRepository', (c) => {
            const FilePairRepository = require('../../infrastructure/persistence/FilePairRepository').FilePairRepository;
            const appConfig = c.get('appConfig') as AppConfig;
            const logger = c.get('logger');
            return new FilePairRepository(appConfig.dataPath, logger);
        }, { dependencies: ['appConfig', 'logger'] });

        container.register('exchangeRepository', (c) => {
            const InMemoryExchangeRepository = require('../../infrastructure/persistence/InMemoryExchangeRepository').InMemoryExchangeRepository;
            const logger = c.get('logger');
            return new InMemoryExchangeRepository(logger);
        }, { dependencies: ['logger'] });

        // Technical indicators service
        container.register('technicalIndicatorsService', (c) => {
            const TechnicalIndicatorsService = require('../../infrastructure/external/TechnicalIndicatorsService').TechnicalIndicatorsService;
            const logger = c.get('logger');
            return new TechnicalIndicatorsService(logger);
        }, { dependencies: ['logger'] });

        // Notification services
        container.register('telegramService', (c) => {
            const TelegramService = require('../../infrastructure/notifications/TelegramService').TelegramService;
            const appConfig = c.get('appConfig') as AppConfig;
            const logger = c.get('logger');
            return new TelegramService(appConfig.telegram, logger);
        }, { dependencies: ['appConfig', 'logger'] });

        container.register('webhookService', (c) => {
            const WebhookService = require('../../infrastructure/notifications/WebhookService').WebhookService;
            const appConfig = c.get('appConfig') as AppConfig;
            const logger = c.get('logger');
            return new WebhookService(appConfig.webhook, logger);
        }, { dependencies: ['appConfig', 'logger'] });
    }

    /**
     * Configure domain services
     */
    private static configureDomain(container: DIContainer): void {
        // Market analyzer
        container.register('marketAnalyzer', (c) => {
            const MarketAnalyzer = require('../../domain/services/MarketAnalyzer').MarketAnalyzer;
            const technicalIndicators = c.get('technicalIndicatorsService');
            const logger = c.get('logger');
            return new MarketAnalyzer(technicalIndicators, logger);
        }, { dependencies: ['technicalIndicatorsService', 'logger'] });

        // Signal generator
        container.register('signalGenerator', (c) => {
            const SignalGenerator = require('../../domain/services/SignalGenerator').SignalGenerator;
            const marketAnalyzer = c.get('marketAnalyzer');
            const signalRepository = c.get('signalRepository');
            const logger = c.get('logger');
            return new SignalGenerator(marketAnalyzer, signalRepository, logger);
        }, { dependencies: ['marketAnalyzer', 'logger'] });

        // Simple signal generator
        container.register('simpleSignalGenerator', (c) => {
            const SimpleSignalGenerator = require('../../domain/services/SimpleSignalGenerator').SimpleSignalGenerator;
            const marketAnalyzer = c.get('marketAnalyzer');
            const logger = c.get('logger');
            return new SimpleSignalGenerator(marketAnalyzer, logger);
        }, { dependencies: ['marketAnalyzer', 'logger'] });

        // Notification service
        container.register('notificationService', (c) => {
            const NotificationService = require('../../domain/services/NotificationService').NotificationService;
            const telegramService = c.get('telegramService');
            const webhookService = c.get('webhookService');
            const logger = c.get('logger');
            return new NotificationService([telegramService, webhookService], logger);
        }, { dependencies: ['telegramService', 'webhookService', 'logger'] });
    }

    /**
     * Configure application services
     */
    private static configureApplication(container: DIContainer): void {
        // Event bus
        container.register('eventBus', (c) => {
            const EventBus = require('../../application/services/EventBus').EventBus;
            const logger = c.get('logger');
            return new EventBus(logger);
        }, { dependencies: ['logger'] });

        // Configuration service
        container.register('configurationService', (c) => {
            const ConfigurationService = require('../../application/services/ConfigurationService').ConfigurationService;
            const appConfig = c.get('appConfig');
            const exchangeConfigs = c.get('exchangeConfigs');
            const logger = c.get('logger');
            const pairRepository = c.get('pairRepository');
            return new ConfigurationService(appConfig, exchangeConfigs, logger, pairRepository);
        }, { dependencies: ['appConfig', 'exchangeConfigs', 'logger'] });

        // Use cases
        container.register('generateSignalUseCase', (c) => {
            const GenerateSignalUseCase = require('../../application/usecases/GenerateSignalUseCase').GenerateSignalUseCase;
            const signalGenerator = c.get('signalGenerator');
            const signalRepository = c.get('signalRepository');
            const notificationService = c.get('notificationService');
            const eventBus = c.get('eventBus');
            const logger = c.get('logger');
            return new GenerateSignalUseCase(
                signalGenerator,
                signalRepository,
                notificationService,
                eventBus,
                logger
            );
        }, {
            dependencies: [
                'signalGenerator',
                'signalRepository',
                'notificationService',
                'eventBus',
                'logger'
            ]
        });

        container.register('monitorMarketUseCase', (c) => {
            const MonitorMarketUseCase = require('../../application/usecases/MonitorMarketUseCase').MonitorMarketUseCase;
            const exchangeFactory = c.get('exchangeFactory');
            const exchangeRepository = c.get('exchangeRepository');
            const pairRepository = c.get('pairRepository');
            const generateSignalUseCase = c.get('generateSignalUseCase');
            const eventBus = c.get('eventBus');
            const logger = c.get('logger');
            return new MonitorMarketUseCase(
                exchangeFactory,
                exchangeRepository,
                pairRepository,
                generateSignalUseCase,
                eventBus,
                logger
            );
        }, {
            dependencies: [
                'exchangeRepository',
                'pairRepository',
                'generateSignalUseCase',
                'eventBus',
                'logger'
            ]
        });

        container.register('manageExchangesUseCase', (c) => {
            const ManageExchangesUseCase = require('../../application/usecases/ManageExchangesUseCase').ManageExchangesUseCase;
            const exchangeFactory = c.get('exchangeFactory');
            const exchangeRepository = c.get('exchangeRepository');
            const eventBus = c.get('eventBus');
            const logger = c.get('logger');
            return new ManageExchangesUseCase(
                exchangeFactory,
                exchangeRepository,
                eventBus,
                logger
            );
        }, {
            dependencies: [
                'exchangeFactory',
                'exchangeRepository',
                'eventBus',
                'logger'
            ]
        });

        container.register('configureBotUseCase', (c) => {
            const ConfigureBotUseCase = require('../../application/usecases/ConfigureBotUseCase').ConfigureBotUseCase;
            const configurationService = c.get('configurationService');
            const pairRepository = c.get('pairRepository');
            const eventBus = c.get('eventBus');
            const logger = c.get('logger');
            return new ConfigureBotUseCase(
                configurationService,
                pairRepository,
                eventBus,
                logger
            );
        }, {
            dependencies: [
                'configurationService',
                'pairRepository',
                'eventBus',
                'logger'
            ]
        });

        // Bot orchestrator
        container.register('botOrchestrator', (c) => {
            const BotOrchestrator = require('../../application/services/BotOrchestrator').BotOrchestrator;
            const monitorMarketUseCase = c.get('monitorMarketUseCase');
            const manageExchangesUseCase = c.get('manageExchangesUseCase');
            const configureBotUseCase = c.get('configureBotUseCase');
            const eventBus = c.get('eventBus');
            const logger = c.get('logger');
            return new BotOrchestrator(
                monitorMarketUseCase,
                manageExchangesUseCase,
                configureBotUseCase,
                eventBus,
                logger
            );
        }, {
            dependencies: [
                'monitorMarketUseCase',
                'manageExchangesUseCase',
                'configureBotUseCase',
                'eventBus',
                'logger'
            ]
        });

        // Handlers
        container.register('signalHandler', (c) => {
            const SignalHandler = require('../../application/handlers/SignalHandler').SignalHandler;
            const notificationService = c.get('notificationService');
            const signalRepository = c.get('signalRepository');
            const logger = c.get('logger');
            return new SignalHandler(notificationService, signalRepository, logger);
        }, { dependencies: ['notificationService', 'signalRepository', 'logger'] });

        container.register('marketDataHandler', (c) => {
            const MarketDataHandler = require('../../application/handlers/MarketDataHandler').MarketDataHandler;
            const generateSignalUseCase = c.get('generateSignalUseCase');
            const logger = c.get('logger');
            return new MarketDataHandler(generateSignalUseCase, logger);
        }, { dependencies: ['generateSignalUseCase', 'logger'] });
    }

    /**
     * Configure interface services
     */
    private static configureInterfaces(container: DIContainer): void {
        // CLI controller
        container.register('cliController', (c) => {
            const CliController = require('../../interfaces/cli/CliController').CliController;
            const botOrchestrator = c.get('botOrchestrator');
            const configurationService = c.get('configurationService');
            const logger = c.get('logger');
            return new CliController(botOrchestrator, configurationService, logger);
        }, { dependencies: ['botOrchestrator', 'configurationService', 'logger'] });

        // API controller (if enabled)
        container.register('restApiController', (c) => {
            const RestApiController = require('../../interfaces/api/RestApiController').RestApiController;
            const botOrchestrator = c.get('botOrchestrator');
            const signalRepository = c.get('signalRepository');
            const logger = c.get('logger');
            return new RestApiController(botOrchestrator, signalRepository, logger);
        }, { dependencies: ['botOrchestrator', 'signalRepository', 'logger'] });

        // WebSocket controller (if enabled)
        container.register('webSocketController', (c) => {
            const WebSocketController = require('../../interfaces/api/WebSocketController').WebSocketController;
            const eventBus = c.get('eventBus');
            const logger = c.get('logger');
            return new WebSocketController(eventBus, logger);
        }, { dependencies: ['eventBus', 'logger'] });
    }

    /**
     * Configure services for testing environment
     */
    static configureTestServices(container: DIContainer): void {
        // Override certain services with test implementations

        // Use in-memory repositories for testing
        container.register('signalRepository', (c) => {
            const InMemorySignalRepository = require('../../infrastructure/persistence/InMemorySignalRepository').InMemorySignalRepository;
            const logger = c.get('logger');
            return new InMemorySignalRepository(logger);
        }, { dependencies: ['logger'] });

        // Configure the rest normally
        this.configureServices(container);
    }

    /**
     * Create a preconfigured container
     */
    static createContainer(): DIContainer {
        const container = new DIContainer();
        this.configureServices(container);
        return container;
    }

    /**
     * Create a container for testing
     */
    static createTestContainer(): DIContainer {
        const container = new DIContainer();
        this.configureTestServices(container);
        return container;
    }
}
