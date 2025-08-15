import { IBotOrchestrator, IBotStatus, IBotMetrics } from '../../application/services/BotOrchestrator';
import { ConfigurationService } from '../../application/services/ConfigurationService';
import { ILogger } from '../../shared';
import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';

export class CliController {
    private program: Command;

    constructor(
        private readonly botOrchestrator: IBotOrchestrator,
        private readonly configurationService: ConfigurationService,
        private readonly logger: ILogger
    ) {
        this.program = new Command();
        this.setupCommands();
    }

    async run(argv: string[]): Promise<void> {
        try {
            await this.program.parseAsync(argv);
        } catch (error: any) {
            console.error(chalk.red('❌ CLI Error:'), error.message);
            process.exit(1);
        }
    }

    private setupCommands(): void {
        this.program
            .name('signal-bot')
            .description('Universal Signal Bot v2.0 - Cryptocurrency Trading Signal Generator')
            .version('2.0.0');

        // Start command
        this.program
            .command('start')
            .description('Start the signal bot')
            .option('-d, --daemon', 'Run as daemon (background process)')
            .option('-v, --verbose', 'Enable verbose logging')
            .action(async (options) => {
                await this.handleStartCommand(options);
            });

        // Stop command
        this.program
            .command('stop')
            .description('Stop the signal bot')
            .action(async () => {
                await this.handleStopCommand();
            });

        // Restart command
        this.program
            .command('restart')
            .description('Restart the signal bot')
            .action(async () => {
                await this.handleRestartCommand();
            });

        // Status command
        this.program
            .command('status')
            .description('Show bot status and metrics')
            .option('-j, --json', 'Output in JSON format')
            .option('-w, --watch', 'Watch mode (refresh every 5 seconds)')
            .action(async (options) => {
                await this.handleStatusCommand(options);
            });

        // Config commands
        const configCmd = this.program
            .command('config')
            .description('Configuration management');

        configCmd
            .command('show')
            .description('Show current configuration')
            .option('-j, --json', 'Output in JSON format')
            .action(async (options) => {
                await this.handleConfigShowCommand(options);
            });

        configCmd
            .command('validate')
            .description('Validate configuration')
            .action(async () => {
                await this.handleConfigValidateCommand();
            });

        configCmd
            .command('test-exchanges')
            .description('Test exchange connections')
            .action(async () => {
                await this.handleTestExchangesCommand();
            });

        // Pairs commands
        const pairsCmd = this.program
            .command('pairs')
            .description('Trading pairs management');

        pairsCmd
            .command('list')
            .description('List trading pairs')
            .option('-a, --active', 'Show only active pairs')
            .option('-e, --exchange <exchange>', 'Filter by exchange')
            .option('-j, --json', 'Output in JSON format')
            .action(async (options) => {
                await this.handlePairsListCommand(options);
            });

        pairsCmd
            .command('add')
            .description('Add a new trading pair')
            .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol (e.g., BTC/USDT)')
            .requiredOption('-e, --exchange <exchange>', 'Exchange name')
            .option('-c, --category <category>', 'Pair category', '')
            .action(async (options) => {
                await this.handlePairsAddCommand(options);
            });

        pairsCmd
            .command('remove')
            .description('Remove a trading pair')
            .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol')
            .requiredOption('-e, --exchange <exchange>', 'Exchange name')
            .action(async (options) => {
                await this.handlePairsRemoveCommand(options);
            });

        pairsCmd
            .command('activate')
            .description('Activate a trading pair')
            .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol')
            .requiredOption('-e, --exchange <exchange>', 'Exchange name')
            .action(async (options) => {
                await this.handlePairsActivateCommand(options);
            });

        pairsCmd
            .command('deactivate')
            .description('Deactivate a trading pair')
            .requiredOption('-s, --symbol <symbol>', 'Trading pair symbol')
            .requiredOption('-e, --exchange <exchange>', 'Exchange name')
            .action(async (options) => {
                await this.handlePairsDeactivateCommand(options);
            });

        // Logs command
        this.program
            .command('logs')
            .description('Show bot logs')
            .option('-f, --follow', 'Follow log output')
            .option('-n, --lines <number>', 'Number of lines to show', '50')
            .option('--level <level>', 'Log level filter', 'info')
            .action(async (options) => {
                await this.handleLogsCommand(options);
            });

        // Health command
        this.program
            .command('health')
            .description('Perform health check')
            .option('-j, --json', 'Output in JSON format')
            .action(async (options) => {
                await this.handleHealthCommand(options);
            });

        // Monitor command
        this.program
            .command('monitor')
            .description('Interactive monitoring dashboard')
            .action(async () => {
                await this.handleMonitorCommand();
            });
    }

    private async handleStartCommand(options: any): Promise<void> {
        try {
            console.log(chalk.blue('🚀 Starting Universal Signal Bot v2.0...'));

            if (options.verbose) {
                console.log(chalk.gray('Verbose logging enabled'));
            }

            await this.botOrchestrator.start();

            if (options.daemon) {
                console.log(chalk.green('✅ Bot started successfully in daemon mode'));
                // In real implementation, would detach process
            } else {
                console.log(chalk.green('✅ Bot started successfully'));

                // Show initial status
                const status = await this.botOrchestrator.getStatus();
                this.printBotStatus(status);

                // Keep process alive and show periodic updates
                this.startStatusUpdates();
            }

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to start bot:'), error.message);
            process.exit(1);
        }
    }

    private async handleStopCommand(): Promise<void> {
        try {
            console.log(chalk.yellow('🛑 Stopping bot...'));

            await this.botOrchestrator.stop();

            console.log(chalk.green('✅ Bot stopped successfully'));
            process.exit(0);

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to stop bot:'), error.message);
            process.exit(1);
        }
    }

    private async handleRestartCommand(): Promise<void> {
        try {
            console.log(chalk.yellow('🔄 Restarting bot...'));

            await this.botOrchestrator.restart();

            console.log(chalk.green('✅ Bot restarted successfully'));

            const status = await this.botOrchestrator.getStatus();
            this.printBotStatus(status);

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to restart bot:'), error.message);
            process.exit(1);
        }
    }

    private async handleStatusCommand(options: any): Promise<void> {
        try {
            if (options.watch) {
                await this.watchStatus();
                return;
            }

            const status = await this.botOrchestrator.getStatus();
            const metrics = await this.botOrchestrator.getMetrics();

            if (options.json) {
                console.log(JSON.stringify({ status, metrics }, null, 2));
            } else {
                this.printBotStatus(status);
                this.printBotMetrics(metrics);
            }

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to get status:'), error.message);
            process.exit(1);
        }
    }

    private async handleConfigShowCommand(options: any): Promise<void> {
        try {
            const config = await this.configurationService.getCurrentConfiguration();

            if (options.json) {
                console.log(JSON.stringify(config, null, 2));
            } else {
                this.printConfiguration(config);
            }

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to show configuration:'), error.message);
            process.exit(1);
        }
    }

    private async handleConfigValidateCommand(): Promise<void> {
        try {
            console.log(chalk.blue('🔍 Validating configuration...'));

            const validation = await this.configurationService.validateConfiguration();

            if (validation.isValid) {
                console.log(chalk.green('✅ Configuration is valid'));
            } else {
                console.log(chalk.red('❌ Configuration validation failed:'));
                validation.errors.forEach(error => {
                    console.log(chalk.red(`  • ${error}`));
                });
                process.exit(1);
            }

        } catch (error: any) {
            console.error(chalk.red('❌ Validation error:'), error.message);
            process.exit(1);
        }
    }

    private async handleTestExchangesCommand(): Promise<void> {
        try {
            console.log(chalk.blue('🧪 Testing exchange connections...'));

            const results = await this.configurationService.testExchangeConnections();

            const table = new Table({
                head: ['Exchange', 'Status', 'Latency', 'Error'],
                colWidths: [15, 12, 12, 40]
            });

            for (const result of results) {
                const status = result.success ? chalk.green('✅ Connected') : chalk.red('❌ Failed');
                const latency = result.latency ? `${result.latency}ms` : 'N/A';
                const error = result.error || '';

                table.push([result.exchange, status, latency, error]);
            }

            console.log(table.toString());

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to test exchanges:'), error.message);
            process.exit(1);
        }
    }

    private async handlePairsListCommand(options: any): Promise<void> {
        try {
            const pairs = await this.configurationService.getTradingPairs();

            let filteredPairs = pairs;

            if (options.active) {
                filteredPairs = pairs.filter(p => p.isActive);
            }

            if (options.exchange) {
                filteredPairs = pairs.filter(p => p.exchange === options.exchange);
            }

            if (options.json) {
                console.log(JSON.stringify(filteredPairs, null, 2));
            } else {
                this.printTradingPairs(filteredPairs);
            }

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to list pairs:'), error.message);
            process.exit(1);
        }
    }

    private async handlePairsAddCommand(options: any): Promise<void> {
        try {
            console.log(chalk.blue(`➕ Adding trading pair ${options.symbol} on ${options.exchange}...`));

            await this.configurationService.addTradingPair({
                symbol: options.symbol,
                exchange: options.exchange,
                category: options.category,
            });

            console.log(chalk.green('✅ Trading pair added successfully'));

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to add trading pair:'), error.message);
            process.exit(1);
        }
    }

    private async handlePairsRemoveCommand(options: any): Promise<void> {
        try {
            console.log(chalk.yellow(`➖ Removing trading pair ${options.symbol} from ${options.exchange}...`));

            await this.configurationService.removeTradingPair(options.symbol, options.exchange);

            console.log(chalk.green('✅ Trading pair removed successfully'));

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to remove trading pair:'), error.message);
            process.exit(1);
        }
    }

    private async handlePairsActivateCommand(options: any): Promise<void> {
        try {
            console.log(chalk.green(`▶️ Activating trading pair ${options.symbol} on ${options.exchange}...`));

            await this.configurationService.activateTradingPair(options.symbol, options.exchange);

            console.log(chalk.green('✅ Trading pair activated successfully'));

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to activate trading pair:'), error.message);
            process.exit(1);
        }
    }

    private async handlePairsDeactivateCommand(options: any): Promise<void> {
        try {
            console.log(chalk.yellow(`⏸️ Deactivating trading pair ${options.symbol} on ${options.exchange}...`));

            await this.configurationService.deactivateTradingPair(options.symbol, options.exchange);

            console.log(chalk.green('✅ Trading pair deactivated successfully'));

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to deactivate trading pair:'), error.message);
            process.exit(1);
        }
    }

    private async handleLogsCommand(options: any): Promise<void> {
        try {
            // In real implementation, would read from log files
            console.log(chalk.blue(`📋 Showing last ${options.lines} log entries...`));
            console.log(chalk.gray('Log viewing not implemented in this example'));

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to show logs:'), error.message);
            process.exit(1);
        }
    }

    private async handleHealthCommand(options: any): Promise<void> {
        try {
            console.log(chalk.blue('🏥 Performing health check...'));

            const isHealthy = await this.botOrchestrator.healthCheck();
            const status = await this.botOrchestrator.getStatus();

            const healthData = {
                overall: isHealthy,
                status: status.status,
                healthScore: status.healthScore,
                uptime: status.uptime,
                activeExchanges: status.activeExchanges.length,
                activePairs: status.activePairs.length,
                errorCount: status.errorCount
            };

            if (options.json) {
                console.log(JSON.stringify(healthData, null, 2));
            } else {
                if (isHealthy) {
                    console.log(chalk.green('✅ Bot is healthy'));
                } else {
                    console.log(chalk.red('❌ Bot has health issues'));
                }

                console.log(chalk.gray(`Health Score: ${status.healthScore}/100`));
                console.log(chalk.gray(`Status: ${status.status}`));
                console.log(chalk.gray(`Uptime: ${this.formatUptime(status.uptime)}`));
                console.log(chalk.gray(`Active Exchanges: ${status.activeExchanges.length}`));
                console.log(chalk.gray(`Active Pairs: ${status.activePairs.length}`));
                console.log(chalk.gray(`Error Count: ${status.errorCount}`));
            }

        } catch (error: any) {
            console.error(chalk.red('❌ Health check failed:'), error.message);
            process.exit(1);
        }
    }

    private async handleMonitorCommand(): Promise<void> {
        try {
            console.log(chalk.blue('📊 Starting interactive monitoring dashboard...'));
            console.log(chalk.gray('Press Ctrl+C to exit'));

            // Clear screen
            process.stdout.write('\x1Bc');

            const updateInterval = setInterval(async () => {
                try {
                    // Move cursor to top and clear screen
                    process.stdout.write('\x1B[H\x1B[2J');

                    const status = await this.botOrchestrator.getStatus();
                    const metrics = await this.botOrchestrator.getMetrics();

                    console.log(chalk.blue.bold('═══ Universal Signal Bot v2.0 - Live Monitor ═══'));
                    console.log(chalk.gray(`Last Update: ${new Date().toLocaleTimeString()}\n`));

                    this.printBotStatus(status, false);
                    this.printBotMetrics(metrics, false);

                    console.log(chalk.gray('\nPress Ctrl+C to exit monitor mode'));

                } catch (error: any) {
                    console.error(chalk.red('Monitor update error:'), error.message);
                }
            }, 5000);

            // Handle exit
            process.on('SIGINT', () => {
                clearInterval(updateInterval);
                console.log(chalk.yellow('\n\n👋 Monitoring stopped'));
                process.exit(0);
            });

        } catch (error: any) {
            console.error(chalk.red('❌ Failed to start monitoring:'), error.message);
            process.exit(1);
        }
    }

    private printBotStatus(status: IBotStatus, showHeader: boolean = true): void {
        if (showHeader) {
            console.log(chalk.blue.bold('\n📊 Bot Status:'));
        }

        const statusColor = this.getStatusColor(status.status);

        console.log(`Status: ${statusColor(status.status)}`);
        console.log(`Bot ID: ${chalk.gray(status.id)}`);
        console.log(`Version: ${chalk.cyan(status.version)}`);
        console.log(`Health Score: ${this.getHealthScoreColor(status.healthScore)}`);

        if (status.startTime) {
            console.log(`Started: ${chalk.gray(status.startTime.toLocaleString())}`);
            console.log(`Uptime: ${chalk.green(this.formatUptime(status.uptime))}`);
        }

        console.log(`Active Exchanges: ${chalk.cyan(status.activeExchanges.length)} (${status.activeExchanges.join(', ')})`);
        console.log(`Active Pairs: ${chalk.cyan(status.activePairs.length)}`);
        console.log(`Signals Today: ${chalk.green(status.todaySignalsGenerated)}`);
        console.log(`Total Signals: ${chalk.green(status.totalSignalsGenerated)}`);
        console.log(`Error Count: ${status.errorCount > 0 ? chalk.red(status.errorCount) : chalk.green(status.errorCount)}`);

        if (status.lastErrorTime) {
            console.log(`Last Error: ${chalk.red(status.lastErrorTime.toLocaleString())}`);
        }
    }

    private printBotMetrics(metrics: IBotMetrics, showHeader: boolean = true): void {
        if (showHeader) {
            console.log(chalk.blue.bold('\n📈 Performance Metrics:'));
        }

        console.log(`Signals/Hour: ${chalk.green(metrics.signalsPerHour)}`);
        console.log(`Avg Confidence: ${chalk.cyan(metrics.averageSignalConfidence.toFixed(1))}/10`);
        console.log(`Success Rate: ${chalk.green(metrics.successRate.toFixed(1))}%`);
        console.log(`Memory Usage: ${chalk.yellow(metrics.memoryUsage.toFixed(1))} MB`);
        console.log(`CPU Usage: ${chalk.yellow(metrics.cpuUsage.toFixed(1))} ms`);

        if (Object.keys(metrics.exchangeLatencies).length > 0) {
            console.log(chalk.blue('\nExchange Latencies:'));
            for (const [exchange, latency] of Object.entries(metrics.exchangeLatencies)) {
                const latencyColor = latency < 1000 ? chalk.green : latency < 3000 ? chalk.yellow : chalk.red;
                console.log(`  ${exchange}: ${latencyColor(latency + 'ms')}`);
            }
        }
    }

    private printConfiguration(config: any): void {
        console.log(chalk.blue.bold('\n⚙️ Current Configuration:'));

        // Environment info
        console.log(chalk.cyan('\nEnvironment:'));
        console.log(`  Mode: ${config.environment}`);
        console.log(`  Debug: ${config.debug ? chalk.green('enabled') : chalk.gray('disabled')}`);
        console.log(`  Log Level: ${config.logLevel}`);

        // Bot config
        console.log(chalk.cyan('\nBot Configuration:'));
        console.log(`  Mode: ${config.bot.mode}`);
        console.log(`  Update Interval: ${config.bot.updateInterval}ms`);
        console.log(`  Max Concurrent Pairs: ${config.bot.maxConcurrentPairs}`);

        // Trading config
        console.log(chalk.cyan('\nTrading Configuration:'));
        console.log(`  Mode: ${config.trading.mode}`);
        console.log(`  Timeframe: ${config.trading.timeframes[config.trading.mode]}`);

        // Risk config
        console.log(chalk.cyan('\nRisk Management:'));
        console.log(`  Max Risk/Trade: ${config.risk.maxRiskPerTrade}%`);
        console.log(`  Default Stop Loss: ${config.risk.defaultStopLoss * 100}%`);
        console.log(`  Min Confidence: ${config.risk.minConfidenceScore}/10`);
    }

    private printTradingPairs(pairs: any[]): void {
        console.log(chalk.blue.bold(`\n💱 Trading Pairs (${pairs.length}):`));

        if (pairs.length === 0) {
            console.log(chalk.gray('No trading pairs configured'));
            return;
        }

        const table = new Table({
            head: ['Symbol', 'Exchange', 'Status', 'Category', 'Success Rate', 'Last Signal'],
            colWidths: [15, 12, 10, 15, 12, 20]
        });

        for (const pair of pairs) {
            const status = pair.isActive ? chalk.green('Active') : chalk.gray('Inactive');
            const successRate = pair.totalSignalsGenerated > 0
                ? `${((pair.successfulSignals / pair.totalSignalsGenerated) * 100).toFixed(1)}%`
                : 'N/A';
            const lastSignal = pair.lastSignalTime > 0
                ? new Date(pair.lastSignalTime).toLocaleString()
                : 'Never';

            table.push([
                pair.symbol,
                pair.exchange,
                status,
                pair.category,
                successRate,
                lastSignal
            ]);
        }

        console.log(table.toString());
    }

    private async watchStatus(): Promise<void> {
        console.log(chalk.blue('👀 Watching bot status... (Press Ctrl+C to exit)'));

        const updateStatus = async () => {
            try {
                // Clear screen
                process.stdout.write('\x1Bc');

                const status = await this.botOrchestrator.getStatus();
                const metrics = await this.botOrchestrator.getMetrics();

                console.log(chalk.blue.bold('═══ Universal Signal Bot v2.0 - Status Watch ═══'));
                console.log(chalk.gray(`Refreshed: ${new Date().toLocaleTimeString()}\n`));

                this.printBotStatus(status, false);
                this.printBotMetrics(metrics, false);

                console.log(chalk.gray('\nPress Ctrl+C to exit watch mode'));

            } catch (error: any) {
                console.error(chalk.red('Status update error:'), error.message);
            }
        };

        // Initial update
        await updateStatus();

        // Set up interval
        const interval = setInterval(updateStatus, 5000);

        // Handle exit
        process.on('SIGINT', () => {
            clearInterval(interval);
            console.log(chalk.yellow('\n\n👋 Status watching stopped'));
            process.exit(0);
        });
    }

    private startStatusUpdates(): void {
        setInterval(async () => {
            try {
                const status = await this.botOrchestrator.getStatus();
                console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Status: ${status.status}, Signals: ${status.todaySignalsGenerated}, Errors: ${status.errorCount}`));
            } catch (error) {
                // Ignore status update errors
            }
        }, 30000); // Update every 30 seconds
    }

    private getStatusColor(status: string): (text: string) => string {
        switch (status) {
            case 'RUNNING': return chalk.green;
            case 'STARTING': return chalk.yellow;
            case 'STOPPING': return chalk.yellow;
            case 'STOPPED': return chalk.gray;
            case 'ERROR': return chalk.red;
            default: return chalk.white;
        }
    }

    private getHealthScoreColor(score: number): string {
        const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
        return color(`${score}/100`);
    }

    private formatUptime(uptimeMs: number): string {
        const seconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}
