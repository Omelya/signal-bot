import {IUserTradingRepository} from "../../domain/repositories/IUserTradingRepository";
import {ILogger, IUserPairCreateParams} from "../../shared";
import {PrismaClient} from "@prisma/client";
import {UserPair} from "../../domain/entities/UserPair";
import * as trace_events from "node:trace_events";

const prisma = new PrismaClient();

export class UserTradingPairRepository implements IUserTradingRepository {
    public constructor(private logger: ILogger) {
    }

    async save(userPair: UserPair): Promise<void> {
        try {
            await prisma
                .userTradingPair
                .create({
                    data: {
                        trading_pair_id: userPair.trading_pair_id,
                        user_id: userPair.user_id,
                    },
                });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }
    }

    async update(userPair: UserPair): Promise<void> {
        try {
            prisma
                .userTradingPair
                .update({
                    where: {id: userPair.id},
                    data: userPair.toPlainObject(),
                });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }
    }

    async findActiveUserTradingPair(userId: number): Promise<UserPair[]> {
        try {
            const userPair = await prisma
                .userTradingPair
                .findMany({
                    where: {
                        user_id: userId,
                        is_active: true,
                    },
                });

            let pairs: UserPair[] = [];

            userPair.map(item => {
                pairs.push(UserPair.create(item as unknown as IUserPairCreateParams));
            })

            return pairs;
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return Promise.resolve([]);
    }

    async findUserPair(userId: number, pairId: string): Promise<UserPair | null> {
        const userPair = await prisma
            .userTradingPair
            .findFirst({
                where: {
                    AND: {
                        trading_pair_id: pairId,
                        user_id: userId,
                    },
                },
            });

        if (userPair) {
            return UserPair.create(userPair as unknown as IUserPairCreateParams);
        }

        return null;
    }

    async findActiveTradingPairWithUser(pair: string): Promise<UserPair[]> {
        try {
            const data = await prisma
                .userTradingPair
                .findMany({
                    where: {
                        trading_pair: { symbol: pair },
                        is_active: true,
                        user: {notifications_enabled: true}
                    },
                    include: {
                        user: true,
                    },
                });

            if (data.length > 0) {
                return data.map(item => UserPair.fromPrisma(item));
            }
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return [];
    }
}
