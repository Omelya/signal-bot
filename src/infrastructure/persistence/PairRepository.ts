import {IPairRepository} from "../../domain/repositories/IPairRepository";
import {TradingPair} from "../../domain/entities/TradingPair";
import {PrismaClient} from "@prisma/client";
import {Strategy} from "../../domain/entities/Strategy";
import {
    ExchangeType,
    IIndicatorSettings,
    ILogger,
    IPairSettings,
    IRiskManagement,
    PairCategory,
    TimeFrame
} from "../../shared";

const prisma = new PrismaClient();

export class PairRepository implements IPairRepository {
    public constructor(private logger: ILogger) {
    }

    bulkSave(pairs: TradingPair[]): Promise<void> {
        return Promise.resolve(undefined);
    }

    clear(): Promise<void> {
        return Promise.resolve(undefined);
    }

    count(): Promise<number> {
        return Promise.resolve(0);
    }

    delete(symbol: string, exchange: ExchangeType): Promise<boolean> {
        return Promise.resolve(false);
    }

    exists(symbol: string, exchange: ExchangeType): Promise<boolean> {
        return Promise.resolve(false);
    }

    async findActive(): Promise<TradingPair[]> {
        try {
            const data = await prisma
                .tradingPair
                .findMany({
                    where: {is_active: true},
                    include: {
                        exchange: true,
                        strategy: true,
                    }
                });

            let tradingPairs: TradingPair[] = [];
            if (data.length > 0) {
                data.forEach(item => {
                    const strategy = Strategy.create({
                        name: item.strategy.name,
                        description: item.strategy.description,
                        timeframe: item.strategy.timeframe as TimeFrame,
                        indicators: item.strategy.indicators as unknown as IIndicatorSettings,
                        risk: item.strategy.risk_management as unknown as IRiskManagement,
                        minSignalStrength: item.strategy.min_signal_strength,
                        maxSimultaneousSignals: item.strategy.max_simultaneous_signals,
                    });

                    tradingPairs.push(TradingPair.create({
                        symbol: item.symbol,
                        baseAsset: item.base_asset,
                        quoteAsset: item.quote_asset,
                        exchange: item.exchange.name as ExchangeType,
                        category: item.category as PairCategory,
                        settings: item.settings as unknown as IPairSettings,
                        strategy: strategy,
                    }))
                })
            }

            return tradingPairs;
        } catch (error: any) {
            this.logger.error('Error query', error);

            return Promise.resolve([]);
        }
    }

    async findAll(): Promise<TradingPair[]> {
        try {
            const data = await prisma
                .tradingPair
                .findMany({
                    include: {
                        exchange: true,
                        strategy: true,
                    },
                });

            let tradingPairs: TradingPair[] = [];
            if (data.length > 0) {
                data.forEach(item => {
                    const strategy = Strategy.create({
                        name: item.strategy.name,
                        description: item.strategy.description,
                        timeframe: item.strategy.timeframe as TimeFrame,
                        indicators: item.strategy.indicators as unknown as IIndicatorSettings,
                        risk: item.strategy.risk_management as unknown as IRiskManagement,
                        minSignalStrength: item.strategy.min_signal_strength,
                        maxSimultaneousSignals: item.strategy.max_simultaneous_signals,
                    });

                    tradingPairs.push(TradingPair.create({
                        symbol: item.symbol,
                        baseAsset: item.base_asset,
                        quoteAsset: item.quote_asset,
                        exchange: item.exchange.name as ExchangeType,
                        category: item.category as PairCategory,
                        settings: item.settings as unknown as IPairSettings,
                        strategy: strategy,
                    }))
                })
            }

            return tradingPairs;
        } catch (error: any) {
            this.logger.error('Error query', error);

            return Promise.resolve([]);
        }
    }

    findByCategory(category: PairCategory): Promise<TradingPair[]> {
        return Promise.resolve([]);
    }

    async findByExchange(exchange: ExchangeType): Promise<TradingPair[]> {
        try {
            const data = await prisma
                .tradingPair
                .findMany({
                    where: {
                        exchange: {
                            name: exchange,
                        },
                    },
                    include: {
                        exchange: true,
                        strategy: true,
                    }
                });

            let tradingPairs: TradingPair[] = [];
            if (data.length > 0) {
                data.forEach(item => {
                    const strategy = Strategy.create({
                        name: item.strategy.name,
                        description: item.strategy.description,
                        timeframe: item.strategy.timeframe as TimeFrame,
                        indicators: item.strategy.indicators as unknown as IIndicatorSettings,
                        risk: item.strategy.risk_management as unknown as IRiskManagement,
                        minSignalStrength: item.strategy.min_signal_strength,
                        maxSimultaneousSignals: item.strategy.max_simultaneous_signals,
                    });

                    tradingPairs.push(TradingPair.create({
                        symbol: item.symbol,
                        baseAsset: item.base_asset,
                        quoteAsset: item.quote_asset,
                        exchange: item.exchange.name as ExchangeType,
                        category: item.category as PairCategory,
                        settings: item.settings as unknown as IPairSettings,
                        strategy: strategy,
                    }))
                })
            }

            return tradingPairs;
        } catch (error: any) {
            this.logger.error('Error query', error);

            return Promise.resolve([]);
        }
    }

    async findBySymbol(symbol: string): Promise<TradingPair[]> {
        try {
            const data = await prisma
                .tradingPair
                .findMany({
                    where: {symbol},
                    include: {
                        exchange: true,
                        strategy: true,
                    }
                });

            let tradingPairs: TradingPair[] = [];
            if (data.length > 0) {
                data.forEach(item => {
                    const strategy = Strategy.create({
                        name: item.strategy.name,
                        description: item.strategy.description,
                        timeframe: item.strategy.timeframe as TimeFrame,
                        indicators: item.strategy.indicators as unknown as IIndicatorSettings,
                        risk: item.strategy.risk_management as unknown as IRiskManagement,
                        minSignalStrength: item.strategy.min_signal_strength,
                        maxSimultaneousSignals: item.strategy.max_simultaneous_signals,
                    });

                    tradingPairs.push(TradingPair.create({
                        symbol: item.symbol,
                        baseAsset: item.base_asset,
                        quoteAsset: item.quote_asset,
                        exchange: item.exchange.name as ExchangeType,
                        category: item.category as PairCategory,
                        settings: item.settings as unknown as IPairSettings,
                        strategy: strategy,
                    }))
                })
            }

            return tradingPairs;
        } catch (error: any) {
            this.logger.error('Error query', error);

            return Promise.resolve([]);
        }
    }

    async findBySymbolAndExchange(symbol: string, exchange: ExchangeType): Promise<TradingPair | null> {
        try {
            const data = await prisma.tradingPair.findFirst({
                where: {
                    symbol: symbol,
                    exchange: {
                        name: exchange
                    },
                },
                include: {
                    exchange: true,
                    strategy: true,
                },
            });

            if (data) {
                const strategy = Strategy.create({
                    name: data.strategy.name,
                    description: data.strategy.description,
                    timeframe: data.strategy.timeframe as TimeFrame,
                    indicators: data.strategy.indicators as unknown as IIndicatorSettings,
                    risk: data.strategy.risk_management as unknown as IRiskManagement,
                    minSignalStrength: data.strategy.min_signal_strength,
                    maxSimultaneousSignals: data.strategy.max_simultaneous_signals,
                });

                return TradingPair.create({
                    symbol: data.symbol,
                    baseAsset: data.base_asset,
                    quoteAsset: data.quote_asset,
                    exchange: data.exchange.name as ExchangeType,
                    category: data.category as PairCategory,
                    settings: data.settings as unknown as IPairSettings,
                    strategy: strategy,
                });
            }
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return Promise.resolve(null);
    }

    findWithFilters(filters: {
        exchange?: ExchangeType;
        category?: PairCategory;
        active?: boolean;
        minVolume?: number;
        baseAsset?: string;
        quoteAsset?: string
    }): Promise<TradingPair[]> {
        return Promise.resolve([]);
    }

    getStatistics(): Promise<{
        total: number;
        active: number;
        byExchange: Record<ExchangeType, number>;
        byCategory: Record<PairCategory, number>
    }> {
        return Promise.resolve({
            total: 0,
            active: 0,
            byExchange: {
                [ExchangeType.BINANCE]: 0,
                [ExchangeType.OKX]: 0,
                [ExchangeType.BYBIT]: 0,
            },
            byCategory: {
                [PairCategory.CRYPTO_ALT]: 0,
                [PairCategory.CRYPTO_MAJOR]: 0,
                [PairCategory.STABLECOIN]: 0,
                [PairCategory.DEFI]: 0,
                [PairCategory.MEME]: 0,
                [PairCategory.TRADITIONAL]: 0,
            }
        });
    }

    async save(pair: TradingPair): Promise<void> {
        return Promise.resolve(undefined);
    }

    async update(pair: TradingPair): Promise<void> {
        try {
            prisma
                .tradingPair
                .update({
                    where: {id: pair.id},
                    data: {
                        is_active: pair.isActive,
                        successful_signals: pair.successfulSignals,
                    },
                });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }
    }
}
