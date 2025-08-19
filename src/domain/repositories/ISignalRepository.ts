import { Signal } from '../entities/Signal';
import { SignalStatus, SignalDirection, ExchangeType } from '../../shared';

export interface ISignalRepository {
    save(signal: Signal): Promise<void>;
    findById(id: string): Promise<Signal | null>;
    findByStatus(status: SignalStatus): Promise<Signal[]>;
    findByPair(pair: string): Promise<Signal[]>;
    findByExchange(exchange: ExchangeType): Promise<Signal[]>;
    findActive(): Promise<Signal[]>;
    findRecent(hours?: number): Promise<Signal[]>;
    findWithFilters(filters: {
        status?: SignalStatus;
        pair?: string;
        exchange?: ExchangeType;
        direction?: SignalDirection;
        minConfidence?: number;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<Signal[]>;
    update(signal: Signal): Promise<void>;
    delete(id: string): Promise<boolean>;
    count(): Promise<number>;
    clear(): Promise<void>;
    cleanupExpiredSignals(maxAgeMinutes?: number): Promise<number>
    getStatistics(): Promise<{
        total: number;
        byStatus: Record<SignalStatus, number>;
        byExchange: Record<ExchangeType, number>;
        byDirection: Record<SignalDirection, number>;
        avgConfidence: number;
        successRate: number;
    }>;
}
