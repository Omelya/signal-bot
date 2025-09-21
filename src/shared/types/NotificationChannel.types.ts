export interface INotification<T = any> {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    category: 'signal' | 'system';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    timestamp: Date;
    metadata?: T;
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
    sendSignalNotification(notification: INotification): Promise<INotificationDeliveryResult>;
    test(): Promise<boolean>;
}
