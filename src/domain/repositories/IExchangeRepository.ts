import { Exchange } from '../entities/Exchange';
import { ExchangeType } from '../../shared';

export interface IExchangeRepository {
    save(exchange: Exchange): Promise<void>;
    findByType(type: ExchangeType): Promise<Exchange | null>;
    findAll(): Promise<Exchange[]>;
    findInitialized(): Promise<Exchange[]>;
    findHealthy(minHealthScore?: number): Promise<Exchange[]>;
    update(exchange: Exchange): Promise<void>;
    delete(type: ExchangeType): Promise<boolean>;
    exists(type: ExchangeType): Promise<boolean>;
    count(): Promise<number>;
    clear(): Promise<void>;
    getStatistics(): Promise<{
        total: number;
        initialized: number;
        healthy: number;
        byType: Record<ExchangeType, {
            exists: boolean;
            initialized: boolean;
            healthScore: number;
            isConnected: boolean;
        }>;
    }>;
    findByHealthRange(minScore: number, maxScore?: number): Promise<Exchange[]>;
    getHealthScores(): Promise<Map<ExchangeType, number>>;
}
