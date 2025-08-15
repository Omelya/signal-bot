import TelegramBot from 'node-telegram-bot-api';
import {
    ILogger,
    INotificationChannel,
    INotification,
    INotificationDeliveryResult,
    ITelegramConfig,
    NotificationDeliveryError,
    AuthenticationError,
    RateLimitError,
} from '../../shared';

export class TelegramService implements INotificationChannel {
    public readonly name = 'telegram';
    private bot!: TelegramBot;
    private lastMessageTime = 0;
    private messageQueue: Array<{ notification: INotification; resolve: Function; reject: Function }> = [];
    private isProcessingQueue = false;

    constructor(
        private readonly config: ITelegramConfig,
        private readonly logger: ILogger
    ) {
        if (this.config.enabled && this.config.botToken) {
            this.initializeBot();
        }
    }

    isEnabled(): boolean {
        return this.config.enabled && !!this.config.botToken && !!this.config.chatId;
    }

    async send(notification: INotification): Promise<INotificationDeliveryResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                error: new Error('Telegram service is not enabled or configured')
            };
        }

        return new Promise((resolve, reject) => {
            this.messageQueue.push({ notification, resolve, reject });
            this.processQueue();
        });
    }

    async test(): Promise<boolean> {
        if (!this.isEnabled()) {
            return false;
        }

        try {
            const testNotification: INotification = {
                id: 'test-' + Date.now(),
                title: 'Test Message',
                message: 'This is a test message from Universal Signal Bot',
                type: 'info',
                priority: 'normal',
                timestamp: new Date()
            };

            const result = await this.send(testNotification);
            return result.success;
        } catch (error) {
            this.logger.error('Telegram test failed:', error);
            return false;
        }
    }

    // Telegram-specific methods
    async sendSignalNotification(signal: {
        id: string;
        pair: string;
        direction: string;
        entry: number;
        stopLoss: number;
        takeProfits: number[];
        confidence: number;
        reasoning: string[];
        exchange: string;
        strategy: string;
    }): Promise<INotificationDeliveryResult> {
        const message = this.formatSignalMessage(signal);

        const notification: INotification = {
            id: `signal-${signal.id}`,
            title: `🚨 ${signal.direction} Signal - ${signal.pair}`,
            message,
            type: 'info',
            priority: 'high',
            timestamp: new Date(),
            metadata: { signalId: signal.id, pair: signal.pair }
        };

        return this.send(notification);
    }

    async sendAlert(title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Promise<INotificationDeliveryResult> {
        const emoji = this.getPriorityEmoji(priority);

        const notification: INotification = {
            id: 'alert-' + Date.now(),
            title: `${emoji} ${title}`,
            message,
            type: priority === 'urgent' ? 'error' : priority === 'high' ? 'warning' : 'info',
            priority,
            timestamp: new Date()
        };

        return this.send(notification);
    }

    async sendBotStatus(status: {
        isRunning: boolean;
        activeExchanges: string[];
        activePairs: string[];
        uptime: number;
        signalsToday: number;
        successRate: number;
    }): Promise<INotificationDeliveryResult> {
        const message = this.formatStatusMessage(status);

        const notification: INotification = {
            id: 'status-' + Date.now(),
            title: `🤖 Bot Status Update`,
            message,
            type: status.isRunning ? 'success' : 'warning',
            priority: 'normal',
            timestamp: new Date()
        };

        return this.send(notification);
    }

    // Private methods
    private initializeBot(): void {
        try {
            this.bot = new TelegramBot(this.config.botToken, { polling: false });
            this.logger.info('Telegram bot initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Telegram bot:', error);
            throw new AuthenticationError('Invalid Telegram bot token', 'telegram');
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.messageQueue.length > 0) {
            const { notification, resolve, reject } = this.messageQueue.shift()!;

            try {
                await this.respectRateLimit();

                const result = await this.sendMessage(notification);
                resolve(result);
            } catch (error) {
                const result: INotificationDeliveryResult = {
                    success: false,
                    error: error as Error
                };
                resolve(result);
            }
        }

        this.isProcessingQueue = false;
    }

    private async sendMessage(notification: INotification): Promise<INotificationDeliveryResult> {
        try {
            const message = this.formatMessage(notification);

            // Валідуємо Markdown перед відправкою
            if (!this.validateMarkdown(message)) {
                this.logger.warn('Invalid markdown detected, sending without formatting');
                // Відправляємо без parse_mode якщо є проблеми з розміткою
                const result = await this.bot.sendMessage(this.config.chatId, message);
                return {
                    success: true,
                    messageId: result.message_id.toString()
                };
            }

            const options = this.getMessageOptions(notification);
            const result = await this.bot.sendMessage(this.config.chatId, message, options);

            // Send to admin chats if urgent
            if (notification.priority === 'urgent' && this.config.adminChatIds.length > 0) {
                for (const adminChatId of this.config.adminChatIds) {
                    try {
                        const urgentMessage = `🚨 URGENT: ${message}`;
                        if (this.validateMarkdown(urgentMessage)) {
                            await this.bot.sendMessage(adminChatId, urgentMessage, options);
                        } else {
                            await this.bot.sendMessage(adminChatId, urgentMessage);
                        }
                    } catch (error) {
                        this.logger.warn(`Failed to send urgent message to admin ${adminChatId}:`, error);
                    }
                }
            }

            this.lastMessageTime = Date.now();

            return {
                success: true,
                messageId: result.message_id.toString()
            };
        } catch (error: any) {
            this.logger.error('Failed to send Telegram message:', error);

            if (error.description && error.description.includes('parse entities')) {
                try {
                    this.logger.info('Retrying without markdown formatting');
                    const plainMessage = this.stripMarkdown(this.formatMessage(notification));
                    const result = await this.bot.sendMessage(this.config.chatId, plainMessage);

                    return {
                        success: true,
                        messageId: result.message_id.toString()
                    };
                } catch (retryError) {
                    this.logger.error('Retry also failed:', retryError);
                    return this.handleTelegramError(retryError);
                }
            }

            return this.handleTelegramError(error);
        }
    }

    private formatMessage(notification: INotification): string {
        const emoji = this.getTypeEmoji(notification.type);
        const timestamp = notification.timestamp.toLocaleString('uk-UA');

        const safeTitle = this.escapeMarkdown(notification.title);
        const safeMessage = this.escapeMarkdown(notification.message);

        let message = `${emoji} *${safeTitle}*\n\n`;
        message += `${safeMessage}\n\n`;
        message += `🕐 ${timestamp}`;

        if (notification.metadata?.signalId) {
            const safeSignalId = this.escapeMarkdown(notification.metadata.signalId);
            message += `\n📊 Signal ID: \`${safeSignalId}\``;
        }

        return message;
    }

    private formatSignalMessage(signal: {
        pair: string;
        direction: string;
        entry: number;
        stopLoss: number;
        takeProfits: number[];
        confidence: number;
        reasoning: string[];
        exchange: string;
        strategy: string;
    }): string {
        const directionEmoji = signal.direction === 'LONG' ? '📈' : '📉';
        const confidenceStars = '⭐'.repeat(Math.min(5, Math.floor(signal.confidence / 2)));

        const safePair = this.escapeMarkdown(signal.pair);
        const safeDirection = this.escapeMarkdown(signal.direction);
        const safeExchange = this.escapeMarkdown(signal.exchange.toUpperCase());
        const safeStrategy = this.escapeMarkdown(signal.strategy);

        let message = `${directionEmoji} *${safeDirection} ${safePair}*\n\n`;
        message += `💰 Entry: \`${signal.entry}\`\n`;
        message += `🛑 Stop Loss: \`${signal.stopLoss}\`\n`;
        message += `🎯 Take Profits:\n`;

        signal.takeProfits.forEach((tp, index) => {
            message += `   TP${index + 1}: \`${tp}\`\n`;
        });

        message += `\n${confidenceStars} Confidence: ${signal.confidence}/10\n`;
        message += `🏢 Exchange: ${safeExchange}\n`;
        message += `📈 Strategy: ${safeStrategy}\n\n`;

        message += `📋 *Analysis:*\n`;
        signal.reasoning.forEach((reason, index) => {
            const safeReason = this.escapeMarkdown(reason);
            message += `${index + 1}\\. ${safeReason}\n`;
        });

        return message;
    }

    private formatStatusMessage(status: {
        isRunning: boolean;
        activeExchanges: string[];
        activePairs: string[];
        uptime: number;
        signalsToday: number;
        successRate: number;
    }): string {
        const statusEmoji = status.isRunning ? '✅' : '❌';
        const uptimeHours = Math.floor(status.uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((status.uptime % (1000 * 60 * 60)) / (1000 * 60));

        const statusText = status.isRunning ? 'Running' : 'Stopped';
        const exchangesList = status.activeExchanges.length > 0
            ? status.activeExchanges.map(ex => this.escapeMarkdown(ex)).join(', ')
            : 'None';

        let message = `${statusEmoji} *Bot Status: ${statusText}*\n\n`;
        message += `⏱️ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n`;
        message += `🏢 Active Exchanges: ${exchangesList}\n`;
        message += `💱 Active Pairs: ${status.activePairs.length}\n`;
        message += `📊 Signals Today: ${status.signalsToday}\n`;
        message += `📈 Success Rate: ${status.successRate.toFixed(1)}%\n`;

        return message;
    }

    private getMessageOptions(notification: INotification): any {
        const options: any = {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        };

        // Add inline keyboard for signal notifications
        if (notification.metadata?.signalId) {
            options.reply_markup = {
                inline_keyboard: [[
                    { text: '✅ Executed', callback_data: `signal_executed_${notification.metadata.signalId}` },
                    { text: '❌ Failed', callback_data: `signal_failed_${notification.metadata.signalId}` }
                ]]
            };
        }

        return options;
    }

    private getTypeEmoji(type: string): string {
        const emojiMap: Record<string, string> = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };
        return emojiMap[type] || 'ℹ️';
    }

    private getPriorityEmoji(priority: string): string {
        const emojiMap: Record<string, string> = {
            'low': 'ℹ️',
            'normal': '📢',
            'high': '⚠️',
            'urgent': '🚨'
        };
        return emojiMap[priority] || '📢';
    }

    private async respectRateLimit(): Promise<void> {
        const minInterval = 60000 / this.config.rateLimitPerMinute; // Convert to milliseconds
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;

        if (timeSinceLastMessage < minInterval) {
            const waitTime = minInterval - timeSinceLastMessage;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    private handleTelegramError(error: any): INotificationDeliveryResult {
        if (error.description && error.description.includes('parse entities')) {
            return {
                success: false,
                error: new NotificationDeliveryError(
                    'Telegram message formatting error - invalid markdown entities',
                    'telegram'
                )
            };
        }

        if (error.code === 429) {
            const retryAfter = error.parameters?.retry_after || 60;
            return {
                success: false,
                error: new RateLimitError('Telegram rate limit exceeded', retryAfter * 1000),
                retryAfter: retryAfter * 1000
            };
        }

        if (error.code === 401) {
            return {
                success: false,
                error: new AuthenticationError('Invalid Telegram bot token', 'telegram')
            };
        }

        if (error.code === 400 && error.description.includes('chat not found')) {
            return {
                success: false,
                error: new NotificationDeliveryError('Telegram chat not found', 'telegram', this.config.chatId)
            };
        }

        return {
            success: false,
            error: new NotificationDeliveryError(
                `Telegram error: ${error.description || error.message}`,
                'telegram'
            )
        };
    }

    private escapeMarkdown(text: string): string {
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    }

    private validateMarkdown(text: string): boolean {
        const markdownPairs = [
            { open: '*', close: '*' },
            { open: '_', close: '_' },
            { open: '`', close: '`' },
            { open: '~', close: '~' }
        ];

        for (const pair of markdownPairs) {
            const regex = new RegExp(`\\${pair.open}`, 'g');
            const matches = text.match(regex);

            if (matches && matches.length % 2 !== 0) {
                this.logger.warn(`Unpaired markdown character: ${pair.open}`);
                return false;
            }
        }

        return true;
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/\*(.+?)\*/g, '$1')  // жирний текст
            .replace(/_(.+?)_/g, '$1')    // курсив
            .replace(/`(.+?)`/g, '$1')    // код
            .replace(/~(.+?)~/g, '$1')    // закреслений
            .replace(/\\/g, '');          // екрановані символи
    }
}
