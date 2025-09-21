import {ExchangeType, TimeFrame} from "./Exchange.types";
import {IStrategy} from "../../domain/entities/Strategy";

export enum PairCategory {
    CRYPTO_MAJOR = 'crypto_major',
    CRYPTO_ALT = 'crypto_alt',
    DEFI = 'defi',
    MEME = 'meme',
    STABLECOIN = 'stablecoin',
    TRADITIONAL = 'traditional'
}

export interface IPairSettings {
    readonly minVolume: number;
    readonly volatilityMultiplier: number;
    readonly riskAdjustment: number;
    readonly signalStrength: number;
    readonly spreadTolerance: number;
    readonly signalCooldown: number;
    readonly dataPoints: number;
    readonly timeframe: TimeFrame;
    readonly specialRules: IPairSpecialRules;
}

export interface IPairSpecialRules {
    readonly stopLossMultiplier: number;
    readonly takeProfitMultiplier: number;
    readonly volumeWeight: number;
    readonly avoidWeekends?: boolean;
    readonly newsFilter?: boolean;
    readonly socialSentiment?: boolean;
    readonly pumpDetection?: boolean;
    readonly maxPositionTime?: number; // minutes
}

export interface ITradingPairCreateParams {
    id?: string,
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    exchange: ExchangeType;
    category: PairCategory;
    settings: IPairSettings;
    strategy: IStrategy;
}

export interface IUserPairCreateParams {
    id?: string;
    is_active?: boolean;
    trading_pair_id: string;
    user_id: number;
    created_at?: Date;
}

export interface IPairValidationResult {
    isValid: boolean;
    volumeCheck: boolean;
    spreadCheck: boolean;
    priceCheck: boolean;
    availabilityCheck: boolean;
    recommendation: string;
    error?: string;
}
