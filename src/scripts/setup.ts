import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {ExchangeType} from '../shared';

interface SetupConfig {
    exchanges: {
        bybit?: { apiKey: string; secretKey: string; sandbox: boolean };
        binance?: { apiKey: string; secretKey: string; sandbox: boolean };
        okx?: { apiKey: string; secretKey: string; passphrase: string; sandbox: boolean };
    };
    telegram: {
        botToken: string;
        chatId: string;
    };
    trading: {
        mode: 'single' | 'multi' | 'auto';
        tradingMode: 'scalping' | 'intraday' | 'swing' | 'position';
        activeExchange: string;
        pair?: string;
    };
    risk: {
        maxRiskPerTrade: number;
        defaultStopLoss: number;
        minConfidenceScore: number;
    };
}

class BotSetup {
    private rl: readline.Interface;
    private config: Partial<SetupConfig> = {
        exchanges: {},
        telegram: { botToken: '', chatId: '' },
        trading: { mode: 'single', tradingMode: 'intraday', activeExchange: 'bybit' },
        risk: { maxRiskPerTrade: 2.0, defaultStopLoss: 0.02, minConfidenceScore: 6 }
    };

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async run(): Promise<void> {
        console.log('🤖 Universal Signal Bot v2.0 Setup');
        console.log('═'.repeat(50));

        try {
            await this.createDirectories();
            await this.setupExchanges();
            await this.setupTelegram();
            await this.setupTradingConfig();
            await this.setupRiskManagement();
            await this.generateEnvFile();
            await this.validateSetup();

            console.log('\n🎉 Setup completed successfully!');
            console.log('📝 Configuration saved to .env file');
            console.log('🚀 You can now start the bot with: npm run dev');

        } catch (error) {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    private async createDirectories(): Promise<void> {
        const directories = ['logs', 'data', 'signals', 'backtest-results'];

        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        }
    }

    private async setupExchanges(): Promise<void> {
        console.log('\n📊 Exchange Configuration');
        console.log('─'.repeat(30));

        const exchanges = [ExchangeType.BYBIT, ExchangeType.BINANCE] as ExchangeType[];

        for (const exchange of exchanges) {
            const setup = await this.askYesNo(`Setup ${exchange.toUpperCase()}?`);
            if (setup) {
                await this.setupExchange(exchange);
            }
        }
    }

    private async setupExchange(exchange: ExchangeType): Promise<void> {
        console.log(`\n🔧 Setting up ${exchange.toUpperCase()}:`);

        const apiKey = await this.askQuestion(`${exchange} API Key: `);
        const secretKey = await this.askQuestion(`${exchange} Secret Key: `);
        const sandbox = await this.askYesNo(`Use ${exchange} sandbox/testnet?`);

        if (exchange === ExchangeType.OKX) {
            const passphrase = await this.askQuestion('OKX Passphrase: ');
            this.config.exchanges![exchange] = { apiKey, secretKey, passphrase, sandbox };
        } else {
            this.config.exchanges![exchange] = { apiKey, secretKey, sandbox };
        }

        console.log(`✅ ${exchange.toUpperCase()} configured`);
    }

    private async setupTelegram(): Promise<void> {
        console.log('\n📱 Telegram Configuration');
        console.log('─'.repeat(30));

        const botToken = await this.askQuestion('Telegram Bot Token: ');
        const chatId = await this.askQuestion('Telegram Chat ID: ');

        this.config.telegram = { botToken, chatId };
        console.log('✅ Telegram configured');
    }

    private async setupTradingConfig(): Promise<void> {
        console.log('\n⚙️ Trading Configuration');
        console.log('─'.repeat(30));

        const mode = await this.askChoice('Trading Mode:', ['single', 'multi', 'auto']) as 'single'|'multi'|'auto';
        const tradingMode = await this.askChoice('Strategy Type:', ['scalping', 'intraday', 'swing', 'position']) as "scalping" | "intraday" | "swing" | "position";

        const exchangeKeys = Object.keys(this.config.exchanges!);
        const activeExchange = exchangeKeys.length > 1
            ? await this.askChoice('Active Exchange:', exchangeKeys)
            : exchangeKeys[0] || 'bybit';

        this.config.trading = { mode, tradingMode, activeExchange };

        if (mode === 'single') {
            this.config.trading!.pair = await this.askQuestion('Trading Pair (e.g., BTC/USDT): ', 'SOL/USDT');
        }

        console.log('✅ Trading configuration set');
    }

    private async setupRiskManagement(): Promise<void> {
        console.log('\n⚠️ Risk Management');
        console.log('─'.repeat(30));

        const maxRisk = await this.askNumber('Max Risk Per Trade (%): ', 2.0);
        const stopLoss = await this.askNumber('Default Stop Loss (%): ', 2.0);
        const minConfidence = await this.askNumber('Min Confidence Score (1-10): ', 6);

        this.config.risk = {
            maxRiskPerTrade: maxRisk,
            defaultStopLoss: stopLoss / 100, // Convert to decimal
            minConfidenceScore: minConfidence
        };

        console.log('✅ Risk management configured');
    }

    private async generateEnvFile(): Promise<void> {
        const envContent = this.buildEnvContent();
        const envPath = path.join(process.cwd(), '.env');

        if (fs.existsSync(envPath)) {
            const overwrite = await this.askYesNo('.env file exists. Overwrite?');
            if (!overwrite) {
                console.log('⚠️ Skipping .env file generation');
                return;
            }
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env file generated');
    }

    private buildEnvContent(): string {
        const lines: string[] = [
            '# Universal Signal Bot v2.0 Configuration',
            '# Generated by setup script',
            '',
            '# Exchange Configuration'
        ];

        // Add exchange configs
        Object.entries(this.config.exchanges!).forEach(([exchange, config]) => {
            const exchangeUpper = exchange.toUpperCase();
            lines.push(`${exchangeUpper}_API_KEY=${config.apiKey}`);
            lines.push(`${exchangeUpper}_SECRET=${config.secretKey}`);
            if ('passphrase' in config) {
                lines.push(`${exchangeUpper}_PASSPHRASE=${config.passphrase}`);
            }
            lines.push(`${exchangeUpper}_SANDBOX=${config.sandbox}`);
            lines.push('');
        });

        // Add telegram config
        lines.push('# Telegram Configuration');
        lines.push(`TELEGRAM_BOT_TOKEN=${this.config.telegram!.botToken}`);
        lines.push(`TELEGRAM_CHAT_ID=${this.config.telegram!.chatId}`);
        lines.push('');

        // Add trading config
        lines.push('# Bot Configuration');
        lines.push(`BOT_MODE=${this.config.trading!.mode}`);
        lines.push(`TRADING_MODE=${this.config.trading!.tradingMode}`);
        lines.push(`ACTIVE_EXCHANGE=${this.config.trading!.activeExchange}`);
        if (this.config.trading!.pair) {
            lines.push(`TRADING_PAIR=${this.config.trading!.pair}`);
        }
        lines.push('UPDATE_INTERVAL=30000');
        lines.push('MAX_CONCURRENT_PAIRS=5');
        lines.push('');

        // Add risk management
        lines.push('# Risk Management');
        lines.push(`MAX_RISK_PER_TRADE=${this.config.risk!.maxRiskPerTrade}`);
        lines.push(`DEFAULT_STOP_LOSS=${this.config.risk!.defaultStopLoss}`);
        lines.push(`MIN_CONFIDENCE_SCORE=${this.config.risk!.minConfidenceScore}`);
        lines.push('');

        // Add other defaults
        lines.push('# Logging');
        lines.push('LOG_LEVEL=info');
        lines.push('LOG_FILE=logs/bot.log');
        lines.push('');
        lines.push('# Development');
        lines.push('NODE_ENV=development');
        lines.push('DEBUG=false');

        return lines.join('\n');
    }

    private async validateSetup(): Promise<void> {
        console.log('\n🔍 Validating configuration...');

        // Check if at least one exchange is configured
        if (Object.keys(this.config.exchanges!).length === 0) {
            throw new Error('At least one exchange must be configured');
        }

        // Check telegram config
        if (!this.config.telegram!.botToken || !this.config.telegram!.chatId) {
            throw new Error('Telegram configuration is required');
        }

        console.log('✅ Configuration validated');
    }

    private askQuestion(question: string, defaultValue?: string): Promise<string> {
        return new Promise((resolve) => {
            const prompt = defaultValue ? `${question}[${defaultValue}] ` : question;
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim() || defaultValue || '');
            });
        });
    }

    private async askYesNo(question: string, defaultValue: boolean = false): Promise<boolean> {
        const answer = await this.askQuestion(`${question} (y/n) `, defaultValue ? 'y' : 'n');
        return answer.toLowerCase().startsWith('y');
    }

    private async askChoice(question: string, choices: string[]): Promise<string> {
        console.log(`${question}`);
        choices.forEach((choice, index) => {
            console.log(`  ${index + 1}) ${choice}`);
        });

        const answer = await this.askQuestion('Select option: ');
        const index = parseInt(answer) - 1;

        if (index >= 0 && index < choices.length) {
            return choices[index] as string;
        }

        console.log('Invalid selection, using first option');
        return choices[0] as string;
    }

    private async askNumber(question: string, defaultValue: number): Promise<number> {
        const answer = await this.askQuestion(question, defaultValue.toString());
        const num = parseFloat(answer);
        return isNaN(num) ? defaultValue : num;
    }
}

if (require.main === module) {
    const setup = new BotSetup();
    setup.run().catch(console.error);
}

export { BotSetup };
