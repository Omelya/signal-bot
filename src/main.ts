import 'reflect-metadata';
import 'dotenv/config';
import { CliController } from './interfaces/cli/CliController';
import { ILogger } from './shared';
import { ServiceProvider } from './shared';
import { DIContainer } from './shared';
import { WinstonLogger } from './infrastructure/logging/WinstonLogger';
import { BotOrchestrator } from './application/services/BotOrchestrator';

/**
 * Bootstrap function to initialize the application
 */
async function bootstrap(): Promise<void> {
    // Create basic logger first
    const logger = new WinstonLogger({
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/bot.log',
        maxSize: process.env.LOG_MAX_SIZE || '10mb',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5')
    });

    try {
        logger.info('🚀 Starting Universal Signal Bot v2.0...');
        logger.info('📋 Initializing Dependency Injection Container...');

        // 1. Setup DI Container
        const container = DIContainer.initialize();

        // Register logger first
        container.registerInstance('logger', logger);

        // Configure all services
        ServiceProvider.configureServices(container);

        logger.info('✅ DI Container configured successfully');

        // 2. Setup global error handling
        setupGlobalErrorHandling(logger);

        // 3. Setup graceful shutdown
        setupGracefulShutdown(container, logger);

        // 4. Start CLI
        const cli = container.get<CliController>('cliController');
        await cli.run(process.argv);

    } catch (error) {
        logger.error('💥 Fatal error during bootstrap:', error);
        process.exit(1);
    }
}

/**
 * Setup global error handling
 */
function setupGlobalErrorHandling(logger: ILogger): void {
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
        logger.error('🚨 Unhandled Rejection:', { reason, promise });
        // In production, you might want to exit the process
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    });

    process.on('uncaughtException', (error: Error) => {
        logger.error('🚨 Uncaught Exception:', error);
        process.exit(1);
    });

    process.on('warning', (warning: Error) => {
        logger.warn('⚠️ Node.js Warning:', warning);
    });
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(container: DIContainer, logger: ILogger): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach((signal) => {
        process.on(signal, async () => {
            logger.info(`🛑 Received ${signal}, initiating graceful shutdown...`);

            try {
                // Get bot orchestrator and stop it gracefully
                const botOrchestrator = container.get<BotOrchestrator>('botOrchestrator');
                if (botOrchestrator && typeof botOrchestrator.stop === 'function') {
                    await botOrchestrator.stop();
                }

                logger.info('✅ Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('❌ Error during graceful shutdown:', error);
                process.exit(1);
            }
        });
    });
}

if (require.main === module) {
    bootstrap().catch((error) => {
        console.error('💥 Fatal startup error:', error);
        process.exit(1);
    });
}
