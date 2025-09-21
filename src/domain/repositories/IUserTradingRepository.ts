import {UserPair} from "../entities/UserPair";

export interface IUserTradingRepository {
    save(userPair: UserPair): Promise<void>;
    update(userPair: UserPair): Promise<void>;
    findActiveUserTradingPair(userId: number): Promise<UserPair[]>;
    findUserPair(userId: number, pairId: string): Promise<UserPair | null>;
    findActiveTradingPairWithUser(pair: string): Promise<UserPair[]>;
}
