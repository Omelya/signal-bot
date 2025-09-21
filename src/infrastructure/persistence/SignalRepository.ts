import {ISignalRepository} from "../../domain/repositories/ISignalRepository";
import {DomainError, ExchangeType, ILogger, ISignalTargets, SignalDirection, SignalStatus} from "../../shared";
import {UserSignal} from "../../domain/repositories/IUserRepository";
import {Signal} from "../../domain/entities/Signal";
import {PrismaClient} from "@prisma/client";
import {UniqueId} from "../../domain/valueObjects/UniqueId";
import {Price} from "../../domain/valueObjects/Price";

const prisma = new PrismaClient();

export class SignalRepository implements ISignalRepository {
    public constructor(private logger: ILogger) {
    }

    async cleanupExpiredSignals(maxAgeMinutes: number = 60): Promise<number> {
        try {
            const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

            const result = await prisma.signal.updateMany({
                where: {
                    status: SignalStatus.SENT,
                    created_at: {lt: cutoffTime},
                },
                data: {
                    status: SignalStatus.EXECUTED,
                    executed_at: new Date(),
                    updated_at: new Date(),
                },
            });

            return result.count;
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return 0;
    }

    clear(): Promise<void> {
        return Promise.resolve(undefined);
    }

    async count(): Promise<number> {
        try {
            return  await prisma.signal.count();
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return 0;
    }

    delete(id: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    findActive(): Promise<Signal[]> {
        return Promise.resolve([]);
    }

    async findActiveByPair(pair: string): Promise<Signal | null> {
        try {
            const item = await prisma
                .signal
                .findFirst({
                    where: {
                        status: SignalStatus.SENT,
                        pair: pair,
                    },
                    orderBy: {created_at: 'desc'},
                    include: {exchange: true},
                });

            if (item) {
                return Signal.create({
                    id: UniqueId.fromString(item.id),
                    pair: item.pair,
                    direction: item.direction as SignalDirection,
                    entry: Price.fromNumber(item.entry_price, item.entry_currency),
                    targets: item.targets as unknown as ISignalTargets,
                    confidence: item.confidence,
                    reasoning: item.reasoning,
                    exchange: item.exchange.name as ExchangeType,
                    timeframe: item.timeframe,
                    strategy: item.strategy,
                });
            }
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return Promise.resolve(null);
    }

    findByExchange(exchange: ExchangeType): Promise<Signal[]> {
        return Promise.resolve([]);
    }

    async findById(id: string): Promise<Signal | null> {
        try {
            const item = await prisma
                .signal
                .findFirst({
                    where: {id},
                    orderBy: {created_at: 'desc'},
                    include: {exchange: true},
                });

            if (item) {
                return Signal.create({
                    id: UniqueId.fromString(item.id),
                    pair: item.pair,
                    direction: item.direction as SignalDirection,
                    entry: Price.fromNumber(item.entry_price, item.entry_currency),
                    targets: item.targets as unknown as ISignalTargets,
                    confidence: item.confidence,
                    reasoning: item.reasoning,
                    exchange: item.exchange.name as ExchangeType,
                    timeframe: item.timeframe,
                    strategy: item.strategy,
                });
            }
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return Promise.resolve(null);
    }

    findByPair(pair: string): Promise<Signal[]> {
        return Promise.resolve([]);
    }

    findByStatus(status: SignalStatus): Promise<Signal[]> {
        return Promise.resolve([]);
    }

    findRecent(hours?: number): Promise<Signal[]> {
        return Promise.resolve([]);
    }

    findWithFilters(filters: {
        status?: SignalStatus;
        pair?: string;
        exchange?: ExchangeType;
        direction?: SignalDirection;
        minConfidence?: number;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number
    }): Promise<Signal[]> {
        return Promise.resolve([]);
    }

    getCountUserSignalByDate(userId: number, startDate: Date, endDate: Date): Promise<number> {
        try {
            return prisma.signal.count({
                where: {
                    AND: [
                        {
                            tradingPair: {
                                user_trading_pairs: {
                                    some: {
                                        user_id: userId,
                                        is_active: true,
                                    },
                                },
                            },
                        },
                        {
                            created_at: {
                                gte: startDate,
                                lt: endDate,
                            },
                        },
                    ],
                },
            });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return new Promise(() => 0);
    }

    getLastUserSignals(userId: number, number: number): Promise<UserSignal[]> {
        try {
            return prisma
                .signal
                .findMany({
                    where: {
                        tradingPair: {
                            user_trading_pairs: {
                                some: {
                                    user_id: userId,
                                    is_active: true,
                                },
                            },
                        },
                    },
                    take: number,
                    orderBy: {created_at: 'desc'},
                });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return new Promise(() => []);
    }

    getStatistics(): Promise<{
        total: number;
        byStatus: Record<SignalStatus, number>;
        byExchange: Record<ExchangeType, number>;
        byDirection: Record<SignalDirection, number>;
        avgConfidence: number;
        successRate: number
    }> {
        throw new Error('Method not implemented');
    }

    async save(signal: Signal): Promise<Signal| null> {
        try {
            const exchange = await prisma
                .exchange
                .findFirst({
                    where: {name: signal.exchange},
                });

            if (!exchange) {
                throw new DomainError(`Exchange ${signal.exchange} not found`);
            }

            const pair = await prisma
                .tradingPair
                .findFirst({
                    where: {symbol: signal.pair},
                });

            if (!pair) {
                throw new DomainError(`Trading pair ${signal.pair} not found`);
            }

            const strategy = await prisma
                .strategy
                .findFirst({
                    where: {name: 'Swing Trading'},
                });

            if (!strategy) {
                throw new DomainError(`Strategy ${!signal.strategy} not found`);
            }

            const savedSignal = await prisma
                .signal
                .create({
                    data: {
                        pair: signal.pair,
                        direction: signal.direction,
                        strategy: signal.strategy,
                        timeframe: signal.timeframe,
                        entry_price: signal.entry.value,
                        targets: {stopLoss: signal.targets.stopLoss, takeProfits: signal.targets.takeProfits},
                        confidence: signal.confidence,
                        reasoning: signal.reasoning as string[],
                        status: signal.status,
                        exchange_id: exchange.id,
                        trading_pair_id: pair.id,
                        strategy_id: strategy.id,
                        created_at: signal.createdAt,
                        updated_at: signal.createdAt,
                    },
                });

            return Signal.create({
                id: UniqueId.fromString(savedSignal.id),
                pair: signal.pair,
                direction: signal.direction as SignalDirection,
                entry: signal.entry,
                targets: signal.targets,
                confidence: signal.confidence,
                reasoning: signal.reasoning as string[],
                exchange: signal.exchange,
                timeframe: signal.timeframe,
                strategy: signal.strategy,
            })
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return null;
    }

    async update(signal: Signal): Promise<void> {
        try {
            await prisma
                .signal
                .update({
                    where: {id: signal.id},
                    data: {
                        status: signal.status,
                        sent_at: signal.sentAt ?? null,
                        executed_at: signal.executedAt ?? null,
                        updated_at: new Date(),
                    },
                });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }
    }

    async getNumberSignalsByDate(fromDate: Date, toDate: Date): Promise<number> {
        try {
            return await prisma.signal.count({
                where: {
                    created_at: {
                        gte: fromDate,
                        lt: toDate,
                    },
                },
            });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return new Promise(() => 0);
    }
}
