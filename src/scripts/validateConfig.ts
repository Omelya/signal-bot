import 'dotenv/config';
import { ExchangeType, TimeFrame } from '../shared';

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

class ConfigValidator {
    private errors: string[] = [];
    private warnings: string[] = [];

    validate(): ValidationResult {
        this.validateExchangeConfig();
        this.validateTelegramConfig();
        this.validateTradingConfig();
        this.validateRiskConfig();
        this.validateEnvironment();

        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }

    private validateExchangeConfig(): void {
        const exchanges = Object.values(ExchangeType);
        let hasValidExchange = false;

        for (const exchange of exchanges) {
            const apiKey = process.env[`${exchange.toUpperCase()}_API_KEY`];
            const secret = process.env[`${exchange.toUpperCase()}_SECRET`];

            if (apiKey && secret) {
                hasValidExchange = true;

                if (apiKey.length < 10) {
                    this.warnings.push(`${exchange} API key seems too short`);
                }

                if (secret.length < 10) {
                    this.warnings.push(`${exchange} secret key seems too short`);
                }
            }
        }

        if (!hasValidExchange) {
            this.errors.push('At least one exchange must be configured with API credentials');
        }
    }

    private validateTelegramConfig(): void {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken) {
            this.errors.push('TELEGRAM_BOT_TOKEN is required');
        } else if (!botToken.includes(':')) {
            this.errors.push('TELEGRAM_BOT_TOKEN format is invalid');
        }

        if (!chatId) {
            this.errors.push('TELEGRAM_CHAT_ID is required');
        }
    }

    private validateTradingConfig(): void {
        const botMode = process.env.BOT_MODE;
        const tradingMode = process.env.TRADING_MODE;
        const activeExchange = process.env.ACTIVE_EXCHANGE;

        if (!['single', 'multi', 'auto'].includes(botMode || '')) {
            this.errors.push('BOT_MODE must be one of: single, multi, auto');
        }

        if (!['scalping', 'intraday', 'swing', 'position'].includes(tradingMode || '')) {
            this.errors.push('TRADING_MODE must be one of: scalping, intraday, swing, position');
        }

        if (activeExchange && !Object.values(ExchangeType).includes(activeExchange as ExchangeType)) {
            this.errors.push(`ACTIVE_EXCHANGE must be one of: ${Object.values(ExchangeType).join(', ')}`);
        }

        // Validate timeframes if specified
        const timeframeVars = [
            'SCALPING_TIMEFRAME',
            'INTRADAY_TIMEFRAME',
            'SWING_TIMEFRAME',
            'POSITION_TIMEFRAME'
        ];

        timeframeVars.forEach(varName => {
            const timeframe = process.env[varName];
            if (timeframe && !Object.values(TimeFrame).includes(timeframe as TimeFrame)) {
                this.errors.push(`${varName} must be a valid timeframe: ${Object.values(TimeFrame).join(', ')}`);
            }
        });
    }

    private validateRiskConfig(): void {
        const maxRisk = parseFloat(process.env.MAX_RISK_PER_TRADE || '2.0');
        const stopLoss = parseFloat(process.env.DEFAULT_STOP_LOSS || '0.02');
        const minConfidence = parseInt(process.env.MIN_CONFIDENCE_SCORE || '6');

        if (maxRisk <= 0 || maxRisk > 10) {
            this.errors.push('MAX_RISK_PER_TRADE must be between 0 and 10');
        }

        if (stopLoss <= 0 || stopLoss >= 1) {
            this.errors.push('DEFAULT_STOP_LOSS must be between 0 and 1');
        }

        if (minConfidence < 1 || minConfidence > 10) {
            this.errors.push('MIN_CONFIDENCE_SCORE must be between 1 and 10');
        }

        if (maxRisk > 5) {
            this.warnings.push('MAX_RISK_PER_TRADE is quite high (>5%), consider reducing it');
        }
    }

    private validateEnvironment(): void {
        const nodeEnv = process.env.NODE_ENV;
        if (!nodeEnv) {
            this.warnings.push('NODE_ENV is not set, defaulting to development');
        }

        const updateInterval = parseInt(process.env.UPDATE_INTERVAL || '30000');
        if (updateInterval < 5000) {
            this.warnings.push('UPDATE_INTERVAL is very low (<5s), may cause rate limiting');
        }

        const logLevel = process.env.LOG_LEVEL;
        if (!['error', 'warn', 'info', 'debug'].includes(logLevel || 'info')) {
            this.warnings.push('LOG_LEVEL should be one of: error, warn, info, debug');
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new ConfigValidator();
    const result = validator.validate();

    console.log('🔍 Configuration Validation Results');
    console.log('═'.repeat(40));

    if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (result.warnings.length > 0) {
        console.log('\n⚠️ Warnings:');
        result.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    if (result.isValid) {
        console.log('\n✅ Configuration is valid!');
        process.exit(0);
    } else {
        console.log('\n❌ Configuration has errors that must be fixed.');
        process.exit(1);
    }
}

export { ConfigValidator };
