import { MarketData } from '../entities/MarketData';
import { TechnicalIndicators } from '../valueObjects/TechnicalIndicators';
import { ITechnicalIndicatorValues } from '../../shared';

export interface IMarketAnalysisResult {
    marketData: MarketData;
    indicators: TechnicalIndicators;
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    strength: number; // 0-10
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    volume: 'LOW' | 'NORMAL' | 'HIGH';
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: number; // 0-100
    reasoning: string[];
}

export interface IMarketAnalyzer {
    analyze(marketData: MarketData, strategy?: any): Promise<IMarketAnalysisResult>;
    calculateIndicators(marketData: MarketData, settings: any): Promise<ITechnicalIndicatorValues>;
    detectPatterns(marketData: MarketData): Promise<{
        patterns: string[];
        bullishSignals: string[];
        bearishSignals: string[];
    }>;
    assessRisk(marketData: MarketData, analysis: IMarketAnalysisResult): Promise<{
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
        factors: string[];
        recommendation: string;
    }>;
}
