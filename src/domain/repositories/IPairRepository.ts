import { TradingPair } from '../entities/TradingPair';
import { ExchangeType, PairCategory } from '../../shared';

export interface IPairRepository {
    save(pair: TradingPair): Promise<void>;
    findBySymbol(symbol: string): Promise<TradingPair[]>;
    findByExchange(exchange: ExchangeType): Promise<TradingPair[]>;
    findByCategory(category: PairCategory): Promise<TradingPair[]>;
    findActive(): Promise<TradingPair[]>;
    findBySymbolAndExchange(symbol: string, exchange: ExchangeType): Promise<TradingPair | null>;
    findAll(): Promise<TradingPair[]>;
    update(pair: TradingPair): Promise<void>;
    delete(symbol: string, exchange: ExchangeType): Promise<boolean>;
    count(): Promise<number>;
    clear(): Promise<void>;
    exists(symbol: string, exchange: ExchangeType): Promise<boolean>;
    getStatistics(): Promise<{
        total: number;
        active: number;
        byExchange: Record<ExchangeType, number>;
        byCategory: Record<PairCategory, number>;
    }>;
    bulkSave(pairs: TradingPair[]): Promise<void>;
    findWithFilters(filters: {
        exchange?: ExchangeType;
        category?: PairCategory;
        active?: boolean;
        minVolume?: number;
        baseAsset?: string;
        quoteAsset?: string;
    }): Promise<TradingPair[]>;
}
