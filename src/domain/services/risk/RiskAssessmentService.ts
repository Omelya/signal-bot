import {MarketData} from "../../entities/MarketData";
import {IMarketAnalysisResult} from "../IMarketAnalyzer";
import {DomainError, ILogger} from "../../../shared";
import {VolumeLevelEnum} from "../analyzers/VolumeAnalyzer";
import {TrendEnum} from "../analyzers/TrendAnalyzer";
import {TechnicalIndicators} from "../../valueObjects/TechnicalIndicators";

export enum RiskLevelEnum {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    VERY_HIGH = 'VERY_HIGH',
}

export enum VolatileLevelEnum {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
}

export type RiskAssessment = {
    riskLevel: RiskLevelEnum;
    factors: string[];
    recommendation: string;
}

export class RiskAssessmentService {
    public constructor(private readonly logger: ILogger) {
    }

    public assessRisk(marketData: MarketData, analysis: IMarketAnalysisResult): RiskAssessment {
        const factors: string[] = [];
        let riskScore = 0;

        try {
            const volatilityRisk = this.assessVolatilityRisk(analysis.volatility, factors);
            riskScore += volatilityRisk;

            const volumeRisk = this.assessVolumeRisk(analysis.volume, factors);
            riskScore += volumeRisk;

            const trendRisk = this.assessTrendRisk(analysis.trend, analysis.strength, factors);
            riskScore += trendRisk;

            const structureRisk = this.assessMarketStructureRisk(marketData, factors);
            riskScore += structureRisk;

            const divergenceRisk = this.assessDivergenceRisk(analysis.indicators, factors);
            riskScore += divergenceRisk;

            const riskLevel = this.determineRiskLevel(riskScore);

            const recommendation = this.generateRiskRecommendation(riskLevel);

            this.logger.debug(`Risk assessment completed for ${marketData.symbol}`, {
                riskLevel,
                riskScore,
                factorsCount: factors.length
            });

            return { riskLevel, factors, recommendation };
        } catch (error: any) {
            this.logger.error('Risk assessment failed:', error);
            throw new DomainError(`Risk assessment failed: ${error.message}`);
        }
    }

    private assessVolatilityRisk(volatility: VolatileLevelEnum, factors: string[]): number {
        switch (volatility) {
            case VolatileLevelEnum.HIGH:
                factors.push('High market volatility increases risk');
                return 3;
            case VolatileLevelEnum.MEDIUM:
                factors.push('Moderate volatility present');
                return 1;
            case VolatileLevelEnum.LOW:
                return 0;
        }
    }

    private assessVolumeRisk(volume: VolumeLevelEnum, factors: string[]): number {
        switch (volume) {
            case VolumeLevelEnum.LOW:
                factors.push('Low volume suggests weak market participation');
                return 2;
            case VolumeLevelEnum.NORMAL:
                return 0;
            case VolumeLevelEnum.HIGH:
                factors.push('High volume provides good liquidity');
                return -1;
        }
    }

    private assessTrendRisk(
        trend: TrendEnum,
        strength: number,
        factors: string[]
    ): number {
        if (trend === TrendEnum.SIDEWAYS) {
            factors.push('Sideways market increases uncertainty');
            return 2;
        }

        if (strength < 4) {
            factors.push('Weak trend strength reduces reliability');
            return 2;
        }

        return 0;
    }

    private assessMarketStructureRisk(marketData: MarketData, factors: string[]): number {
        const statistics = marketData.getStatistics();
        let risk = 0;

        // Price range analysis
        const priceRange = (statistics.highestPrice - statistics.lowestPrice) / statistics.averagePrice;
        if (priceRange > 0.2) {
            factors.push('Wide price range indicates high volatility period');
            risk += 1;
        }

        // Recent data check
        if (!marketData.isRecent(5)) {
            factors.push('Market data is not recent');
            risk += 1;
        }

        return risk;
    }

    private assessDivergenceRisk(indicators: TechnicalIndicators, factors: string[]): number {
        if (indicators.hasDivergence()) {
            factors.push('Technical indicator divergence detected');
            return 2;
        }
        return 0;
    }

    private determineRiskLevel(riskScore: number): RiskLevelEnum {
        if (riskScore >= 8) return RiskLevelEnum.VERY_HIGH;
        if (riskScore >= 5) return RiskLevelEnum.HIGH;
        if (riskScore >= 2) return RiskLevelEnum.MEDIUM;
        return RiskLevelEnum.LOW;
    }

    private generateRiskRecommendation(riskLevel: RiskLevelEnum): string {
        switch (riskLevel) {
            case RiskLevelEnum.LOW:
                return 'Low risk environment suitable for normal position sizing';
            case RiskLevelEnum.MEDIUM:
                return 'Moderate risk present, consider reducing position size by 25%';
            case RiskLevelEnum.HIGH:
                return 'High risk environment, reduce position size by 50% and use tight stops';
            case RiskLevelEnum.VERY_HIGH:
                return 'Very high risk, consider avoiding trades or use minimal position sizes';
        }
    }
}
