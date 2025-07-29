export interface INotification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface INotificationDeliveryResult {
    success: boolean;
    messageId?: string;
    error?: Error;
    retryAfter?: number;
}

export interface INotificationChannel {
    name: string;
    isEnabled(): boolean;
    send(notification: INotification): Promise<INotificationDeliveryResult>;
    test(): Promise<boolean>;
}
