import {TimeFrame} from "./Exchange.types";

export interface IEmaSettings {
    readonly short: number;
    readonly medium: number;
    readonly long: number;
}

export interface IRsiSettings {
    readonly period: number;
    oversold: number;
    overbought: number;
}

export interface IMacdSettings {
    readonly fastPeriod: number;
    readonly slowPeriod: number;
    readonly signalPeriod: number;
}

export interface IBollingerBandsSettings {
    readonly period: number;
    readonly standardDeviation: number;
}

export interface IVolumeSettings {
    threshold: number;
    readonly period: number;
}

export interface IRiskManagement {
    stopLoss: number;
    takeProfits: readonly number[];
    readonly maxRiskPerTrade: number;
    readonly riskRewardRatio: number;
}

export interface IIndicatorSettings {
    readonly ema: IEmaSettings;
    rsi: IRsiSettings;
    readonly macd: IMacdSettings;
    readonly bollingerBands: IBollingerBandsSettings;
    readonly volume: IVolumeSettings;
}

export interface IStrategyCreateParams {
    name: string;
    description: string;
    timeframe: TimeFrame;
    indicators: IIndicatorSettings;
    risk: IRiskManagement;
    minSignalStrength: number;
    maxSimultaneousSignals: number;
}

export interface ISignalConditions {
    readonly bullish: IConditionSet;
    readonly bearish: IConditionSet;
}

export interface IConditionSet {
    readonly primary: string[];
    readonly secondary: string[];
    readonly confirmation: string[];
    readonly weight: number;
}

export interface IStrategyBacktestResult {
    readonly totalTrades: number;
    readonly winRate: number;
    readonly profitFactor: number;
    readonly maxDrawdown: number;
    readonly averageReturn: number;
    readonly sharpeRatio: number;
}

export enum StrategyType {
    SCALPING = 'SCALPING',
    INTRADAY = 'INTRADAY',
    SWING = 'SWING',
    POSITION = 'POSITION'
}

export interface ITechnicalIndicatorValues {
    readonly rsi: number;
    readonly ema: {
        readonly short: number;
        readonly medium: number;
        readonly long: number;
    };
    readonly macd: {
        readonly line: number;
        readonly signal: number;
        readonly histogram: number;
    };
    readonly bollingerBands: {
        readonly upper: number;
        readonly middle: number;
        readonly lower: number;
    };
    readonly stochastic: {
        readonly k: number;
        readonly d: number;
    };
    readonly atr: number;
    readonly adx: number;
    readonly volumeProfile: {
        readonly sma: number;
        readonly ratio: number;
    };
}
