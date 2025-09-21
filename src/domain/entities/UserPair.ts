import {IUserPairCreateParams} from "../../shared";
import {TradingPair} from "./TradingPair";
import {User} from "./User";

export class UserPair {
    private constructor(
        readonly id: string,
        readonly user_id: number,
        readonly trading_pair_id: string,
        public is_active: boolean,
        readonly createdAt: Date = new Date(),
        readonly user?: User,
    ) {
    }

    /**
     * Factory method to create a new UserPair
     */
    static create(params: IUserPairCreateParams): UserPair {
        return new UserPair(
            params.id ?? '',
            params.user_id,
            params.trading_pair_id,
            params.is_active ?? true,
            params.created_at,
        );
    }

    static fromPrisma(prismaUserPair: {
        id: string;
        user_id: bigint;
        trading_pair_id: string;
        is_active: boolean;
        created_at: Date;
        user?: {
            id: bigint;
            telegram_username: string,
            telegram_user_id: bigint,
            notifications_enabled: boolean,
        };
    }): UserPair {
        return new UserPair(
            prismaUserPair.id,
            Number(prismaUserPair.user_id),
            prismaUserPair.trading_pair_id,
            prismaUserPair.is_active,
            prismaUserPair.created_at,
            prismaUserPair.user ? User.fromPrisma(prismaUserPair.user) : undefined,
        );
    }

    public deactivate(): UserPair {
        this.is_active = false;

        return this;
    }

    public activate(): UserPair {
        this.is_active = true;

        return this;
    }

    public toPlainObject() {
        return {
            id: this.id,
            user_id: this.user_id,
            trading_pair_id: this.trading_pair_id,
            is_active: this.is_active,
            created_at: this.createdAt,
        }
    }
}
