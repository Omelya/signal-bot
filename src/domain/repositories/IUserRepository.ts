import {JsonValue} from "@prisma/client/runtime/client";
import {User} from "../entities/User";

export type UserSignal = {
    strategy: string
    id: string
    exchange_id: string
    strategy_id: string
    created_at: Date
    updated_at: Date
    pair: string
    direction: string
    timeframe: string
    entry_price: number
    entry_currency: string
    targets: JsonValue
    confidence: number
    reasoning: string[]
    indicators: JsonValue
    status: string
    trading_pair_id: string | null
    sent_at: Date | null
    executed_at: Date | null
}

export interface IUserRepository {
    save(user: User): Promise<void>;
    update(user: User): Promise<void>;
    findByTelegramId(id: number): Promise<User | null>;
}
