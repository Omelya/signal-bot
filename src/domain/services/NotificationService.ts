import { Signal } from '../entities/Signal';
import {
    INotificationService,
    INotificationResult
} from './INotificationService';
import {
    INotificationChannel,
    INotification,
    INotificationDeliveryResult,
    ILogger,
    NotificationError,
} from '../../shared';

export class NotificationService implements INotificationService {
    private readonly channels: Map<string, INotificationChannel> = new Map();

    constructor(
        channels: INotificationChannel[],
        private readonly logger: ILogger
    ) {
        this.registerChannels(channels);
    }

    async sendSignalNotification(signal: Signal, message: string): Promise<INotificationResult> {
        try {
            const notification: INotification = {
                id: `signal-${signal.id}-${Date.now()}`,
                title: `🎯 ${signal.direction} Signal - ${signal.pair}`,
                message,
                type: this.getNotificationTypeFromSignal(signal),
                priority: this.getPriorityFromSignal(signal),
                timestamp: new Date(),
                metadata: {
                    signalId: signal.id,
                    pair: signal.pair,
                    direction: signal.direction,
                    confidence: signal.confidence,
                    exchange: signal.exchange,
                    strategy: signal.strategy
                }
            };

            this.logger.info(`Sending signal notification for signal ${signal.id}`, {
                signalId: signal.id,
                pair: signal.pair,
                direction: signal.direction,
                notification
            });

            const result = await this.broadcastNotification(notification);

            this.logger.info(`Signal notification sent for ${signal.pair}`, {
                signalId: signal.id,
                success: result.success,
                deliveredChannels: result.deliveredChannels.length,
                failedChannels: result.failedChannels.length
            });

            return result;

        } catch (error: any) {
            this.logger.error(`Failed to send signal notification for ${signal.id}:`, error);
            throw new NotificationError(`Signal notification failed: ${error.message}`);
        }
    }

    async sendAlert(
        title: string,
        message: string,
        priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
    ): Promise<INotificationResult> {
        try {
            this.logger.debug(`Sending alert notification`, {
                title,
                priority,
                enabledChannels: this.getEnabledChannels()
            });

            const notification: INotification = {
                id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title,
                message,
                type: this.getNotificationTypeFromPriority(priority),
                priority,
                timestamp: new Date(),
                metadata: {
                    source: 'alert',
                    priority
                }
            };

            const result = await this.broadcastNotification(notification);

            this.logger.info(`Alert notification sent`, {
                title,
                priority,
                success: result.success,
                deliveredChannels: result.deliveredChannels.length
            });

            return result;

        } catch (error: any) {
            this.logger.error(`Failed to send alert notification:`, error);
            throw new NotificationError(`Alert notification failed: ${error.message}`);
        }
    }

    async sendBotStatus(status: {
        isRunning: boolean;
        activeExchanges: string[];
        activePairs: string[];
        uptime: number;
        signalsToday: number;
        successRate: number;
    }): Promise<INotificationResult> {
        try {
            this.logger.debug(`Sending bot status notification`, {
                isRunning: status.isRunning,
                activeExchanges: status.activeExchanges.length,
                activePairs: status.activePairs.length
            });

            const statusEmoji = status.isRunning ? '✅' : '❌';
            const title = `${statusEmoji} Bot Status Update`;

            const message = this.formatBotStatusMessage(status);

            const notification: INotification = {
                id: `bot-status-${Date.now()}`,
                title,
                message,
                type: status.isRunning ? 'success' : 'warning',
                priority: status.isRunning ? 'normal' : 'high',
                timestamp: new Date(),
                metadata: {
                    source: 'bot_status',
                    botStatus: status
                }
            };

            const result = await this.broadcastNotification(notification);

            this.logger.info(`Bot status notification sent`, {
                isRunning: status.isRunning,
                success: result.success,
                deliveredChannels: result.deliveredChannels.length
            });

            return result;

        } catch (error: any) {
            this.logger.error(`Failed to send bot status notification:`, error);
            throw new NotificationError(`Bot status notification failed: ${error.message}`);
        }
    }

    async sendCustomNotification(notification: INotification): Promise<INotificationResult> {
        try {
            this.logger.debug(`Sending custom notification`, {
                id: notification.id,
                type: notification.type,
                priority: notification.priority,
                title: notification.title
            });

            const result = await this.broadcastNotification(notification);

            this.logger.info(`Custom notification sent`, {
                id: notification.id,
                success: result.success,
                deliveredChannels: result.deliveredChannels.length
            });

            return result;

        } catch (error: any) {
            this.logger.error(`Failed to send custom notification:`, error);
            throw new NotificationError(`Custom notification failed: ${error.message}`);
        }
    }

    async testAllChannels(): Promise<Record<string, boolean>> {
        this.logger.info('Testing all notification channels...');

        const results: Record<string, boolean> = {};
        const enabledChannels = this.getEnabledChannelInstances();

        for (const channel of enabledChannels) {
            try {
                this.logger.debug(`Testing channel: ${channel.name}`);
                const success = await channel.test();
                results[channel.name] = success;

                if (success) {
                    this.logger.info(`✅ Channel ${channel.name} test passed`);
                } else {
                    this.logger.warn(`❌ Channel ${channel.name} test failed`);
                }

            } catch (error) {
                this.logger.error(`❌ Channel ${channel.name} test error:`, error);
                results[channel.name] = false;
            }
        }

        const successCount = Object.values(results).filter(Boolean).length;
        const totalCount = Object.keys(results).length;

        this.logger.info(`Channel testing completed: ${successCount}/${totalCount} channels working`, results);

        return results;
    }

    getEnabledChannels(): string[] {
        return Array.from(this.channels.values())
            .filter(channel => channel.isEnabled())
            .map(channel => channel.name);
    }

    isAnyChannelEnabled(): boolean {
        return this.getEnabledChannels().length > 0;
    }

    // Channel management methods

    /**
     * Register notification channels
     */
    private registerChannels(channels: INotificationChannel[]): void {
        for (const channel of channels) {
            this.channels.set(channel.name, channel);
            this.logger.debug(`Registered notification channel: ${channel.name}`, {
                enabled: channel.isEnabled()
            });
        }

        const enabledCount = this.getEnabledChannels().length;
        this.logger.info(`Notification service initialized with ${enabledCount} enabled channels`, {
            totalChannels: this.channels.size,
            enabledChannels: this.getEnabledChannels()
        });
    }

    /**
     * Get enabled channel instances
     */
    private getEnabledChannelInstances(): INotificationChannel[] {
        return Array.from(this.channels.values())
            .filter(channel => channel.isEnabled());
    }

    /**
     * Broadcast notification to all enabled channels
     */
    private async broadcastNotification(notification: INotification): Promise<INotificationResult> {
        const enabledChannels = this.getEnabledChannelInstances();

        if (enabledChannels.length === 0) {
            this.logger.warn('No enabled notification channels available');
            return {
                success: false,
                deliveredChannels: [],
                failedChannels: [],
                errors: {}
            };
        }

        const deliveredChannels: string[] = [];
        const failedChannels: string[] = [];
        const errors: Record<string, Error> = {};

        // Send to all channels in parallel
        const deliveryPromises = enabledChannels.map(async (channel) => {
            try {
                const result = await this.sendToChannel(channel, notification);

                if (result.success) {
                    deliveredChannels.push(channel.name);
                    this.logger.debug(`✅ Notification delivered to ${channel.name}`, {
                        messageId: result.messageId,
                        notificationId: notification.id
                    });
                } else {
                    failedChannels.push(channel.name);
                    if (result.error) {
                        errors[channel.name] = result.error;
                    }
                    this.logger.warn(`❌ Notification failed for ${channel.name}`, {
                        error: result.error?.message,
                        notificationId: notification.id
                    });
                }

            } catch (error) {
                failedChannels.push(channel.name);
                errors[channel.name] = error as Error;
                this.logger.error(`❌ Notification error for ${channel.name}:`, error);
            }
        });

        // Wait for all deliveries to complete
        await Promise.allSettled(deliveryPromises);

        const success = deliveredChannels.length > 0;

        return {
            success,
            deliveredChannels,
            failedChannels,
            errors
        };
    }

    /**
     * Send notification to specific channel with retry logic
     */
    private async sendToChannel(
        channel: INotificationChannel,
        notification: INotification,
        maxRetries: number = 2
    ): Promise<INotificationDeliveryResult> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                const result = await channel.send(notification);

                if (result.success) {
                    if (attempt > 1) {
                        this.logger.info(`✅ Notification delivered to ${channel.name} after ${attempt} attempts`);
                    }
                    return result;
                }

                lastError = result.error;

                // Don't retry for certain error types
                if (lastError && this.shouldNotRetry(lastError)) {
                    break;
                }

                if (attempt <= maxRetries) {
                    const delay = this.calculateRetryDelay(attempt, result.retryAfter);
                    this.logger.debug(`Retrying notification to ${channel.name} in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await this.sleep(delay);
                }

            } catch (error) {
                lastError = error as Error;

                if (this.shouldNotRetry(lastError) || attempt > maxRetries) {
                    break;
                }

                if (attempt <= maxRetries) {
                    const delay = this.calculateRetryDelay(attempt);
                    this.logger.debug(`Retrying notification to ${channel.name} in ${delay}ms due to error (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await this.sleep(delay);
                }
            }
        }

        return {
            success: false,
            error: lastError || new Error('Unknown delivery error')
        };
    }

    /**
     * Check if error should not be retried
     */
    private shouldNotRetry(error: Error): boolean {
        const nonRetryableErrors = [
            'AUTHENTICATION_ERROR',
            'AUTHORIZATION_ERROR',
            'VALIDATION_ERROR',
            'NOT_FOUND',
            'BAD_REQUEST'
        ];

        return nonRetryableErrors.some(errorType =>
            error.name.includes(errorType) || error.message.includes(errorType)
        );
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(attempt: number, retryAfter?: number): number {
        if (retryAfter) {
            return Math.min(retryAfter, 60000); // Max 1 minute
        }

        // Exponential backoff: 1s, 2s, 4s, etc.
        const baseDelay = 1000;
        const maxDelay = 30000; // Max 30 seconds

        return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get notification type from signal
     */
    private getNotificationTypeFromSignal(signal: Signal): 'info' | 'success' | 'warning' | 'error' {
        if (signal.confidence >= 8) {
            return 'success';
        } else if (signal.confidence >= 6) {
            return 'info';
        } else {
            return 'warning';
        }
    }

    /**
     * Get priority from signal confidence
     */
    private getPriorityFromSignal(signal: Signal): 'low' | 'normal' | 'high' | 'urgent' {
        if (signal.confidence >= 9) {
            return 'urgent';
        } else if (signal.confidence >= 7) {
            return 'high';
        } else if (signal.confidence >= 5) {
            return 'normal';
        } else {
            return 'low';
        }
    }

    /**
     * Get notification type from priority
     */
    private getNotificationTypeFromPriority(priority: 'low' | 'normal' | 'high' | 'urgent'): 'info' | 'success' | 'warning' | 'error' {
        switch (priority) {
            case 'urgent':
                return 'error';
            case 'high':
                return 'warning';
            case 'normal':
                return 'info';
            case 'low':
            default:
                return 'info';
        }
    }

    /**
     * Format bot status message
     */
    private formatBotStatusMessage(status: {
        isRunning: boolean;
        activeExchanges: string[];
        activePairs: string[];
        uptime: number;
        signalsToday: number;
        successRate: number;
    }): string {
        const statusIcon = status.isRunning ? '✅' : '❌';
        const uptimeFormatted = this.formatUptime(status.uptime);

        let message = `${statusIcon} *Bot Status:* ${status.isRunning ? 'Running' : 'Stopped'}\n\n`;

        if (status.isRunning) {
            message += `⏱️ *Uptime:* ${uptimeFormatted}\n`;
            message += `🏢 *Active Exchanges:* ${status.activeExchanges.length > 0 ? status.activeExchanges.join(', ') : 'None'}\n`;
            message += `💱 *Active Pairs:* ${status.activePairs.length}\n`;
            message += `📊 *Signals Today:* ${status.signalsToday}\n`;
            message += `📈 *Success Rate:* ${status.successRate.toFixed(1)}%\n`;
        } else {
            message += `⚠️ Bot is currently stopped\n`;
        }

        message += `\n🕐 *Status Updated:* ${new Date().toLocaleString()}`;

        return message;
    }

    /**
     * Format uptime duration
     */
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

    // Public utility methods

    /**
     * Add a new notification channel
     */
    public addChannel(channel: INotificationChannel): void {
        this.channels.set(channel.name, channel);
        this.logger.info(`Added notification channel: ${channel.name}`, {
            enabled: channel.isEnabled()
        });
    }

    /**
     * Remove notification channel
     */
    public removeChannel(channelName: string): boolean {
        const removed = this.channels.delete(channelName);
        if (removed) {
            this.logger.info(`Removed notification channel: ${channelName}`);
        }
        return removed;
    }

    /**
     * Get channel by name
     */
    public getChannel(channelName: string): INotificationChannel | undefined {
        return this.channels.get(channelName);
    }

    /**
     * Get all registered channels
     */
    public getAllChannels(): INotificationChannel[] {
        return Array.from(this.channels.values());
    }

    /**
     * Get notification service statistics
     */
    public getStatistics(): {
        totalChannels: number;
        enabledChannels: number;
        channelStatus: Array<{
            name: string;
            enabled: boolean;
            lastTest?: boolean;
        }>;
    } {
        const channels = this.getAllChannels();

        return {
            totalChannels: channels.length,
            enabledChannels: this.getEnabledChannels().length,
            channelStatus: channels.map(channel => ({
                name: channel.name,
                enabled: channel.isEnabled()
            }))
        };
    }

    /**
     * Send system notification (for internal bot events)
     */
    public async sendSystemNotification(
        type: 'startup' | 'shutdown' | 'error' | 'warning' | 'info',
        title: string,
        message: string,
        metadata?: Record<string, any>
    ): Promise<INotificationResult> {
        const priorityMap = {
            'startup': 'normal' as const,
            'shutdown': 'high' as const,
            'error': 'urgent' as const,
            'warning': 'high' as const,
            'info': 'normal' as const
        };

        const typeMap = {
            'startup': 'success' as const,
            'shutdown': 'info' as const,
            'error': 'error' as const,
            'warning': 'warning' as const,
            'info': 'info' as const
        };

        return this.sendCustomNotification({
            id: `system-${type}-${Date.now()}`,
            title: `🤖 ${title}`,
            message,
            type: typeMap[type],
            priority: priorityMap[type],
            timestamp: new Date(),
            metadata: {
                source: 'system',
                systemEventType: type,
                ...metadata
            }
        });
    }
}
