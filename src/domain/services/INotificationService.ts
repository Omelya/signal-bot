import { Signal } from '../entities/Signal';
import { INotification } from '../../shared';

export interface INotificationResult {
    success: boolean;
    deliveredChannels: string[];
    failedChannels: string[];
    errors: Record<string, Error>;
}

export interface INotificationService {
    sendSignalNotification(signal: Signal, message: string): Promise<INotificationResult>;
    sendAlert(
        title: string,
        message: string,
        priority?: 'low' | 'normal' | 'high' | 'urgent'
    ): Promise<INotificationResult>;
    sendBotStatus(status: {
        isRunning: boolean;
        activeExchanges: string[];
        activePairs: string[];
        uptime: number;
        signalsToday: number;
        successRate: number;
    }): Promise<INotificationResult>;
    sendCustomNotification(notification: INotification): Promise<INotificationResult>;
    testAllChannels(): Promise<Record<string, boolean>>;
    getEnabledChannels(): string[];
    isAnyChannelEnabled(): boolean;
}
