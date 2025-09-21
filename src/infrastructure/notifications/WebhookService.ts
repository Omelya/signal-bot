import axios, { AxiosInstance } from 'axios';
import {
    INotificationChannel,
    INotification,
    INotificationDeliveryResult,
    IWebhookConfig,
    ILogger,
    NotificationDeliveryError,
    NetworkError,
    TimeoutError,
    AuthenticationError
} from '../../shared';

export class WebhookService implements INotificationChannel {
    public readonly name = 'webhook';
    private httpClient!: AxiosInstance;

    constructor(
        private readonly config: IWebhookConfig,
        private readonly logger: ILogger
    ) {
        this.initializeHttpClient();
    }

    sendSignalNotification(notification: INotification<any>): Promise<INotificationDeliveryResult> {
        throw new Error("Method not implemented.");
    }

    isEnabled(): boolean {
        return this.config.enabled && this.config.urls.length > 0;
    }

    async send(notification: INotification): Promise<INotificationDeliveryResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                error: new Error('Webhook service is not enabled or configured')
            };
        }

        const results = await Promise.allSettled(
            this.config.urls.map(url => this.sendToWebhook(url, notification))
        );

        // Check if at least one webhook succeeded
        const successCount = results.filter(result =>
            result.status === 'fulfilled' && result.value.success
        ).length;

        if (successCount > 0) {
            return {
                success: true,
                messageId: `sent_to_${successCount}_webhooks`
            };
        }

        const getFirstError = (): Error => {
            for (const result of results) {
                if (result.status === 'rejected') {
                    return result.reason instanceof Error
                        ? result.reason
                        : new Error(String(result.reason));
                }

                if (result.status === 'fulfilled' && !result.value.success && result.value.error) {
                    return result.value.error;
                }
            }
            return new Error('All webhook deliveries failed');
        };

        return {
            success: false,
            error: getFirstError(),
        };
    }

    async test(): Promise<boolean> {
        if (!this.isEnabled()) {
            return false;
        }

        try {
            const testNotification: INotification = {
                id: 'test-' + Date.now(),
                title: 'Test Webhook',
                message: 'This is a test webhook from Universal Signal Bot',
                type: 'info',
                category: 'system',
                priority: 'normal',
                timestamp: new Date()
            };

            const result = await this.send(testNotification);
            return result.success;
        } catch (error) {
            this.logger.error('Webhook test failed:', error);
            return false;
        }
    }

    // Private methods
    private initializeHttpClient(): void {
        this.httpClient = axios.create({
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'UniversalSignalBot/2.0',
                ...this.config.headers
            }
        });

        // Add authentication if configured
        if (this.config.authentication.type !== 'none' && this.config.authentication.credentials) {
            this.setupAuthentication();
        }
    }

    private setupAuthentication(): void {
        const { type, credentials } = this.config.authentication;

        switch (type) {
            case 'basic':
                if (credentials?.username && credentials?.password) {
                    this.httpClient.defaults.auth = {
                        username: credentials.username,
                        password: credentials.password
                    };
                }
                break;

            case 'bearer':
                if (credentials?.token) {
                    this.httpClient.defaults.headers['Authorization'] = `Bearer ${credentials.token}`;
                }
                break;

            case 'api_key':
                if (credentials?.key && credentials?.value) {
                    this.httpClient.defaults.headers[credentials.key] = credentials.value;
                }
                break;
        }
    }

    private async sendToWebhook(url: string, notification: INotification): Promise<INotificationDeliveryResult> {
        const payload = this.formatWebhookPayload(notification);

        try {
            const response = await this.withRetry(() =>
                this.httpClient.post(url, payload)
            );

            this.logger.debug(`Webhook sent successfully to ${url}`, {
                status: response.status,
                notificationId: notification.id
            });

            return {
                success: true,
                messageId: response.headers['x-message-id'] || notification.id
            };
        } catch (error) {
            this.logger.error(`Failed to send webhook to ${url}:`, error);
            return this.handleWebhookError(error, url);
        }
    }

    private formatWebhookPayload(notification: INotification): any {
        return {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            priority: notification.priority,
            timestamp: notification.timestamp.toISOString(),
            metadata: notification.metadata || {},
            source: 'UniversalSignalBot',
            version: '2.0'
        };
    }

    private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt === this.config.retryAttempts) {
                    throw lastError;
                }

                // Don't retry for certain errors
                if (axios.isAxiosError(error)) {
                    const status = error.response?.status;
                    if (status && (status === 401 || status === 403 || status === 404)) {
                        throw lastError;
                    }
                }

                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    private handleWebhookError(error: any, url: string): INotificationDeliveryResult {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return {
                    success: false,
                    error: new TimeoutError(`Webhook timeout for ${url}`, this.config.timeout)
                };
            }

            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return {
                    success: false,
                    error: new NetworkError(`Cannot connect to webhook ${url}`)
                };
            }

            if (error.response) {
                const status = error.response.status;

                if (status === 401 || status === 403) {
                    return {
                        success: false,
                        error: new AuthenticationError(`Webhook authentication failed for ${url}`, 'webhook')
                    };
                }

                return {
                    success: false,
                    error: new NotificationDeliveryError(
                        `Webhook failed with status ${status}: ${error.response.data}`,
                        'webhook',
                        url
                    )
                };
            }
        }

        return {
            success: false,
            error: new NotificationDeliveryError(`Webhook error: ${error.message}`, 'webhook', url)
        };
    }
}
