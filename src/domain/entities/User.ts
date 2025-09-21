import {IUserCreateParams} from "../../shared/types/User.types";

export class User {
    private constructor(
        public readonly id: number,
        public readonly telegram_username: string,
        public readonly telegram_user_id: number,
        public notifications_enabled: boolean,
    ) {
    }

    /**
     * Factory method to create a new TradingPair
     */
    static create(params: IUserCreateParams): User {
        return new User(
            params.id ?? 0,
            params.telegram_username,
            params.telegram_user_id,
            params.notifications_enabled,
        );
    }

    static fromPrisma(params: {
        id: bigint;
        telegram_username: string,
        telegram_user_id: bigint,
        notifications_enabled: boolean,
    }): User {
        return new User(
            Number(params.id),
            params.telegram_username,
            Number(params.telegram_user_id),
            params.notifications_enabled,
        );
    }

    public changeNotificationStatus(): User {
        this.notifications_enabled = !this.notifications_enabled;

        return this;
    }

    public toPlainObject() {
        return {
            id: this.id,
            telegram_username: this.telegram_username,
            telegram_user_id: this.telegram_user_id,
            notifications_enabled: this.notifications_enabled,
        }
    }
}
