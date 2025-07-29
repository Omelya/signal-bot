import {ExchangeType, TimeFrame} from "./Exchange.types";

export interface IMarketConditions {
    readonly rsi: number;
    readonly macd: number;
    readonly volume: number;
    readonly trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
}

export interface ICandle {
    readonly timestamp: number;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number;
}

export interface IMarketDataCreateParams {
    symbol: string;
    timeframe: TimeFrame;
    candles: ICandle[];
    exchange: ExchangeType;
    timestamp?: number;
}

export interface IMarketStatistics {
    readonly averageVolume: number;
    readonly volatility: number;
    readonly priceChange: number;
    readonly priceChangePercent: number;
    readonly highestPrice: number;
    readonly lowestPrice: number;
    readonly totalVolume: number;
    readonly averagePrice: number;
}

export interface IPriceAction {
    readonly isBullish: boolean;
    readonly isBearish: boolean;
    readonly bodySize: number;
    readonly wickSize: number;
    readonly upperWick: number;
    readonly lowerWick: number;
    readonly isHammer: boolean;
    readonly isDoji: boolean;
    readonly isEngulfing: boolean;
}

export interface IMarketInfo {
    readonly symbol: string;
    readonly baseAsset: string;
    readonly quoteAsset: string;
    readonly minOrderSize: number;
    readonly maxOrderSize: number;
    readonly priceStep: number;
    readonly quantityStep: number;
    readonly isActive: boolean;
    readonly volume24h: number;
}

export interface ITicker {
    readonly symbol: string;
    readonly bid: number;
    readonly ask: number;
    readonly last: number;
    readonly volume: number;
    readonly change: number;
    readonly percentage: number;
    readonly timestamp: number;
}

export interface IEmaValues {
    readonly short: number;
    readonly medium: number;
    readonly long: number;
}

export interface IMacdValues {
    readonly line: number;
    readonly signal: number;
    readonly histogram: number;
}

export interface IBollingerBands {
    readonly upper: number;
    readonly middle: number;
    readonly lower: number;
}

export interface IVolumeAnalysis {
    readonly current: number;
    readonly average: number;
    readonly ratio: number;
}

export interface IAccountBalance {
    readonly free: Record<string, number>;
    readonly used: Record<string, number>;
    readonly total: Record<string, number>;
}
