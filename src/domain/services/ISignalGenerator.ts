import { Signal } from '../entities/Signal';
import { TradingPair } from '../entities/TradingPair';
import { MarketData } from '../entities/MarketData';
import { IMarketAnalysisResult } from './IMarketAnalyzer';

export interface ISignalGenerationResult {
    signal?: Signal;
    shouldGenerate: boolean;
    reason: string;
    confidence: number;
    analysis: IMarketAnalysisResult;
}

export interface ISignalGenerator {
    generateSignal(
        pair: TradingPair,
        marketData: MarketData,
        analysis?: IMarketAnalysisResult
    ): Promise<ISignalGenerationResult>;

    canGenerateSignal(
        pair: TradingPair,
        marketData: MarketData
    ): Promise<boolean>;

    validateSignal(signal: Signal): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }>;

    optimizeSignal(
        signal: Signal,
        marketConditions: any
    ): Promise<Signal>;
}
