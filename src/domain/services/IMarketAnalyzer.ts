import { MarketData } from '../entities/MarketData';
import { TechnicalIndicators } from '../valueObjects/TechnicalIndicators';
import { ITechnicalIndicatorValues } from '../../shared';
import {VolumeLevelEnum} from "./analyzers/VolumeAnalyzer";
import {TrendEnum} from "./analyzers/TrendAnalyzer";
import {VolatileLevelEnum} from "./risk/RiskAssessmentService";
import {PatternDetectors} from "./PatternDetector";
import {ISimpleMarketAnalysisResult} from "./MarketAnalyzer";

export interface IMarketAnalysisResult {
    marketData: MarketData;
    indicators: TechnicalIndicators;
    trend: TrendEnum;
    strength: number; // 0-10
    volatility: VolatileLevelEnum;
    volume: VolumeLevelEnum;
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: number; // 0-100
    reasoning: string[];
}

export interface IMarketAnalyzer {
    analyze(marketData: MarketData, strategy?: any): IMarketAnalysisResult;
    calculateIndicators(marketData: MarketData, settings: any): ITechnicalIndicatorValues;
    detectPatterns(marketData: MarketData): PatternDetectors;
    analyzeSimple(marketData: MarketData, strategy?: any): ISimpleMarketAnalysisResult
}
