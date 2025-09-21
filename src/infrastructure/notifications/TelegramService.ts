import TelegramBot from 'node-telegram-bot-api';
import {
    ILogger,
    INotificationChannel,
    INotification,
    INotificationDeliveryResult,
    ITelegramConfig,
    NotificationDeliveryError,
    AuthenticationError,
    RateLimitError, ISignalMetadata,
} from '../../shared';
import {UserTradingPairRepository} from "../persistence/UserTradingPairRepository";

export class TelegramService implements INotificationChannel {
    public readonly name = 'telegram';
    private bot!: TelegramBot;
    private lastMessageTime = 0;
    private messageQueue: Array<{ notification: INotification; resolve: Function; reject: Function, chatId?: number,  }> = [];
    private isProcessingQueue = false;

    constructor(
        private readonly userTradingPairRepository: UserTradingPairRepository,
        private readonly config: ITelegramConfig,
        private readonly logger: ILogger,
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
                category: 'system',
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
    async sendSignalNotification(notification: INotification<ISignalMetadata>): Promise<INotificationDeliveryResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                error: new Error('Telegram service is not enabled or configured')
            };
        }

        const tradingPairWithUser = await this
            .userTradingPairRepository
            .findActiveTradingPairWithUser(notification.metadata!.pair);

        if (tradingPairWithUser.length === 0) {
            return {
                success: false,
                error: new Error('No users found for this trading pair')
            };
        }

        return new Promise((resolve, reject) => {
            let completedCount = 0;
            let hasError = false;
            let lastError: Error | undefined;

            tradingPairWithUser.forEach(item => {
                this.messageQueue.push({
                    notification,
                    resolve: (result: INotificationDeliveryResult) => {
                        completedCount++;

                        if (!result.success && !hasError) {
                            hasError = true;
                            lastError = result.error;
                        }

                        if (completedCount === tradingPairWithUser.length) {
                            if (hasError) {
                                resolve({
                                    success: false,
                                    error: lastError as Error,
                                });
                            } else {
                                resolve({
                                    success: true
                                });
                            }
                        }
                    },
                    reject: (error: Error) => {
                        if (!hasError) {
                            hasError = true;
                            reject(error);
                        }
                    },
                    chatId: item.user!.telegram_user_id,
                });
            });

            this.processQueue();
        });
    }

    async sendAlert(title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Promise<INotificationDeliveryResult> {
        const emoji = this.getPriorityEmoji(priority);

        const notification: INotification = {
            id: 'alert-' + Date.now(),
            title: `${emoji} ${title}`,
            message,
            category: 'system',
            type: priority === 'urgent' ? 'error' : priority === 'high' ? 'warning' : 'info',
            priority,
            timestamp: new Date()
        };

        return this.send(notification);
    }

    async sendBotStatus(notification: INotification): Promise<INotificationDeliveryResult> {
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
            const { chatId, notification, resolve, reject } = this.messageQueue.shift()!;

            try {
                await this.respectRateLimit();

                const result = await this.sendMessage(notification, chatId);
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

    private async sendMessage(notification: INotification, chatId?: number): Promise<INotificationDeliveryResult> {
        try {
            const message = this.formatMessage(notification);
            const options = this.getMessageOptions(notification);
            const result = await this.bot.sendMessage(chatId ?? this.config.chatId, message, options);

            // Send to admin chats if urgent
            if (notification.priority === 'urgent' && this.config.adminChatIds.length > 0) {
                for (const adminChatId of this.config.adminChatIds) {
                    try {
                        await this.bot.sendMessage(adminChatId, `🚨 URGENT: ${message}`, options);
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
        } catch (error) {
            this.logger.error('Failed to send Telegram message:', error);
            return this.handleTelegramError(error);
        }
    }

    private formatMessage(notification: INotification): string {
        const emoji = this.getTypeEmoji(notification.type);
        const timestamp = notification.timestamp.toLocaleString('uk-UA');

        let message = `${emoji} <b>${notification.title}</b>\n\n`;
        message += `${notification.message}\n\n`;
        message += `🕐 ${timestamp}`;

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

        let message = `${directionEmoji} *${signal.direction} ${signal.pair}*\n\n`;
        message += `💰 Entry: \`${signal.entry}\`\n`;
        message += `🛑 Stop Loss: \`${signal.stopLoss}\`\n`;
        message += `🎯 Take Profits:\n`;

        signal.takeProfits.forEach((tp, index) => {
            message += `   TP${index + 1}: \`${tp}\`\n`;
        });

        message += `\n${confidenceStars} Confidence: ${signal.confidence}/10\n`;
        message += `🏢 Exchange: ${signal.exchange.toUpperCase()}\n`;
        message += `📈 Strategy: ${signal.strategy}\n\n`;

        message += `📋 *Analysis:*\n`;
        signal.reasoning.forEach((reason, index) => {
            message += `${index + 1}. ${reason}\n`;
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

        let message = `${statusEmoji} *Bot Status: ${status.isRunning ? 'Running' : 'Stopped'}*\n\n`;
        message += `⏱️ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n`;
        message += `🏢 Active Exchanges: ${status.activeExchanges.join(', ') || 'None'}\n`;
        message += `💱 Active Pairs: ${status.activePairs.length}\n`;
        message += `📊 Signals Today: ${status.signalsToday}\n`;
        message += `📈 Success Rate: ${status.successRate.toFixed(1)}%\n`;

        return message;
    }

    private getMessageOptions(notification: INotification): any {
        const options: any = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

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
            error: new NotificationDeliveryError(`Telegram error: ${error.description || error.message}`, 'telegram')
        };
    }
}
