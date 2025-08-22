import { Signal } from '../entities/Signal';
import { TradingPair } from '../entities/TradingPair';
import { MarketData } from '../entities/MarketData';
import { IMarketAnalysisResult } from './IMarketAnalyzer';
import {ISimpleMarketAnalysisResult} from "./MarketAnalyzer";

export interface ISignalGenerationResult {
    signal?: Signal;
    shouldGenerate: boolean;
    reason: string;
    confidence: number;
    analysis: IMarketAnalysisResult;
}

export type SimpleSignalResult = {
    signal?: Signal;
    shouldGenerate: boolean;
    reason: string;
    confidence: number;
    metadata: {
        processingTime: number;
        analysisScore: number;
        riskLevel: string;
        volume: string;
    };
}

export interface ISignalGenerator {
    generateSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis?: ISimpleMarketAnalysisResult,
    ): Promise<SimpleSignalResult>;

    canGenerateSignal(
        pair: TradingPair,
        marketData: MarketData,
    ): boolean;

    validateSignal(
        signal: Signal,
        analysis: ISimpleMarketAnalysisResult,
    ): { valid: boolean; reason: string };
}
