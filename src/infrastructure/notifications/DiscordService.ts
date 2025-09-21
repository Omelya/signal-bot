import axios from 'axios';
import {
    ILogger,
    NotificationDeliveryError,
    INotificationChannel,
    INotification,
    INotificationDeliveryResult,
} from '../../shared';
import {response} from "express";
import {error} from "winston";

export interface IDiscordConfig {
    enabled: boolean;
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
}

export class DiscordService implements INotificationChannel {
    public readonly name = 'discord';

    constructor(
        private readonly config: IDiscordConfig,
        private readonly logger: ILogger
    ) {}

    isEnabled(): boolean {
        return this.config.enabled && !!this.config.webhookUrl;
    }

    async send(notification: INotification): Promise<INotificationDeliveryResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                error: new Error('Discord service is not enabled or configured')
            };
        }

        try {
            const embed = this.createEmbed(notification);
            const payload = {
                username: this.config.username || 'Universal Signal Bot',
                avatar_url: this.config.avatarUrl,
                embeds: [embed]
            };

            const response = await axios.post(this.config.webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            return {
                success: true,
                messageId: response.headers['x-ratelimit-remaining'] || notification.id
            };
        } catch (error: any) {
            this.logger.error('Failed to send Discord notification:', error);
            return {
                success: false,
                error: new NotificationDeliveryError(`Discord error: ${error.message}`, 'discord')
            };
        }
    }

    async test(): Promise<boolean> {
        try {
            const testNotification: INotification = {
                id: 'test-' + Date.now(),
                title: 'Test Discord Notification',
                message: 'This is a test message from Universal Signal Bot',
                category: 'system',
                type: 'info',
                priority: 'normal',
                timestamp: new Date()
            };

            const result = await this.send(testNotification);
            return result.success;
        } catch (error) {
            this.logger.error('Discord test failed:', error);
            return false;
        }
    }

    private createEmbed(notification: INotification): any {
        const color = this.getColorForType(notification.type);
        const timestamp = notification.timestamp.toISOString();

        const embed: any = {
            title: notification.title,
            description: notification.message,
            color: color,
            timestamp: timestamp,
            footer: {
                text: 'Universal Signal Bot',
                icon_url: 'https://example.com/bot-icon.png'
            }
        };

        // Add fields for signal notifications
        if (notification.metadata?.signalId) {
            embed.fields = [
                {
                    name: 'Signal ID',
                    value: notification.metadata.signalId,
                    inline: true
                }
            ];

            if (notification.metadata.pair) {
                embed.fields.push({
                    name: 'Trading Pair',
                    value: notification.metadata.pair,
                    inline: true
                });
            }
        }

        return embed;
    }

    private getColorForType(type: string): number {
        const colorMap: Record<string, number> = {
            'info': 3447003,      // Blue
            'success': 3066993,   // Green
            'warning': 15844367,  // Yellow
            'error': 15158332     // Red
        };
        return colorMap[type] || 3447003;
    }

    sendSignalNotification(notification: INotification): Promise<INotificationDeliveryResult> {
        return Promise.resolve({success: false});
    }
}
