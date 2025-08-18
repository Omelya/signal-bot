import { TechnicalIndicators } from "../../valueObjects/TechnicalIndicators";
import { MarketData } from "../../entities/MarketData";

export enum SimpleTrendEnum {
    BULLISH = 'BULLISH',
    BEARISH = 'BEARISH',
    NEUTRAL = 'NEUTRAL'
}

export type TrendSignal = {
    direction: SimpleTrendEnum;
    strength: number;
    confidence: number;
    reasons: string[];
    votes: TrendVotes;
}

export type TrendVotes = {
    bullish: number;
    bearish: number;
    details: string[];
}

export class SimpleTrendAnalyzer {
    public analyzeTrend(indicators: TechnicalIndicators, marketData: MarketData): TrendSignal {
        try {
            const votes = this.collectTrendVotes(indicators, marketData);
            const direction = this.determineTrendDirection(votes);
            const strength = this.calculateTrendStrength(votes, marketData);
            const confidence = this.calculateTrendConfidence(votes, direction, strength);
            const reasons = this.generateTrendReasons(votes, direction, strength);

            return {
                direction,
                strength,
                confidence,
                reasons,
                votes
            };

        } catch (error) {
            return {
                direction: SimpleTrendEnum.NEUTRAL,
                strength: 1,
                confidence: 1,
                reasons: ['Error in trend analysis'],
                votes: { bullish: 0, bearish: 0, details: [] }
            };
        }
    }

    private collectTrendVotes(indicators: TechnicalIndicators, marketData: MarketData): TrendVotes {
        const votes: TrendVotes = { bullish: 0, bearish: 0, details: [] };
        const currentPrice = marketData.currentPrice;
        const ema = indicators.values.ema;
        const statistics = marketData.getStatistics();

        if (currentPrice > ema.medium) {
            votes.bullish += 2;
            votes.details.push(`Ціна вище EMA21 (${ema.medium.toFixed(6)})`);
        } else {
            votes.bearish += 2;
            votes.details.push(`Ціна нижче EMA21 (${ema.medium.toFixed(6)})`);
        }

        const macdSignal = indicators.macdSignal;
        if (macdSignal === 'BUY') {
            votes.bullish += 1.5;
            votes.details.push('MACD бичачий сигнал');
        } else if (macdSignal === 'SELL') {
            votes.bearish += 1.5;
            votes.details.push('MACD ведмежий сигнал');
        } else {
            votes.details.push('MACD нейтральний');
        }

        const priceChange = statistics.priceChangePercent;
        if (priceChange > 2) {
            votes.bullish += 1.5;
            votes.details.push(`Сильний бичачий моментум: +${priceChange.toFixed(1)}%`);
        } else if (priceChange < -2) {
            votes.bearish += 1.5;
            votes.details.push(`Сильний ведмежий моментум: ${priceChange.toFixed(1)}%`);
        } else if (Math.abs(priceChange) > 1) {
            const points = Math.abs(priceChange) > 1.5 ? 0.75 : 0.5;
            if (priceChange > 0) {
                votes.bullish += points;
                votes.details.push(`Помірний бичачий моментум: +${priceChange.toFixed(1)}%`);
            } else {
                votes.bearish += points;
                votes.details.push(`Помірний ведмежий моментум: ${priceChange.toFixed(1)}%`);
            }
        } else {
            votes.details.push(`Слабкий моментум: ${priceChange.toFixed(1)}%`);
        }

        return votes;
    }

    private determineTrendDirection(votes: TrendVotes): SimpleTrendEnum {
        const difference = Math.abs(votes.bullish - votes.bearish);

        if (votes.bullish > votes.bearish && difference >= 1) {
            return SimpleTrendEnum.BULLISH;
        }

        if (votes.bearish > votes.bullish && difference >= 1) {
            return SimpleTrendEnum.BEARISH;
        }

        return SimpleTrendEnum.NEUTRAL;
    }

    private calculateTrendStrength(votes: TrendVotes, marketData: MarketData): number {
        const totalVotes = votes.bullish + votes.bearish;
        const dominantVotes = Math.max(votes.bullish, votes.bearish);
        const statistics = marketData.getStatistics();

        if (totalVotes === 0) return 1;

        const voteStrength = (dominantVotes / totalVotes) * 6; // Максимум 6 балів

        const absPriceChange = Math.abs(statistics.priceChangePercent);
        let momentumBonus = 0;

        if (absPriceChange > 5) momentumBonus = 4;
        else if (absPriceChange > 3) momentumBonus = 2.5;
        else if (absPriceChange > 1.5) momentumBonus = 1.5;
        else if (absPriceChange > 0.5) momentumBonus = 0.5;

        const totalStrength = voteStrength + momentumBonus;

        return Math.max(1, Math.min(10, Math.round(totalStrength * 10) / 10));
    }

    private calculateTrendConfidence(
        votes: TrendVotes,
        direction: SimpleTrendEnum,
        strength: number
    ): number {

        if (direction === SimpleTrendEnum.NEUTRAL) {
            return Math.max(1, Math.min(4, strength * 0.4));
        }

        const totalVotes = votes.bullish + votes.bearish;
        const winningVotes = direction === SimpleTrendEnum.BULLISH ? votes.bullish : votes.bearish;

        if (totalVotes === 0) return 1;

        const agreementRatio = winningVotes / totalVotes;
        const baseConfidence = agreementRatio * 7;

        const strengthBonus = (strength / 10) * 3;

        const totalConfidence = baseConfidence + strengthBonus;

        return Math.max(1, Math.min(10, Math.round(totalConfidence * 10) / 10));
    }

    private generateTrendReasons(
        votes: TrendVotes,
        direction: SimpleTrendEnum,
        strength: number
    ): string[] {
        const reasons: string[] = [];

        // 1. Основний висновок
        if (direction === SimpleTrendEnum.BULLISH) {
            const strengthText = this.getStrengthText(strength);
            reasons.push(`${strengthText} бичачий тренд (${votes.bullish.toFixed(1)} vs ${votes.bearish.toFixed(1)} балів)`);
        } else if (direction === SimpleTrendEnum.BEARISH) {
            const strengthText = this.getStrengthText(strength);
            reasons.push(`${strengthText} ведмежий тренд (${votes.bearish.toFixed(1)} vs ${votes.bullish.toFixed(1)} балів)`);
        } else {
            reasons.push(`Нейтральний ринок - немає чіткого тренду (${votes.bullish.toFixed(1)} vs ${votes.bearish.toFixed(1)})`);
        }

        // 2. Топ-3 деталі з голосування
        const topDetails = votes.details
            .filter(detail => detail.length > 0)
            .slice(0, 3);

        reasons.push(...topDetails);

        return reasons;
    }

    private getStrengthText(strength: number): string {
        if (strength >= 8) return 'Дуже сильний';
        if (strength >= 6) return 'Сильний';
        if (strength >= 4) return 'Помірний';
        return 'Слабкий';
    }

    public isBullish(trendSignal: TrendSignal): boolean {
        return trendSignal.direction === SimpleTrendEnum.BULLISH && trendSignal.strength >= 4;
    }

    public isBearish(trendSignal: TrendSignal): boolean {
        return trendSignal.direction === SimpleTrendEnum.BEARISH && trendSignal.strength >= 4;
    }

    public isHighQualityTrend(trendSignal: TrendSignal): boolean {
        return trendSignal.direction !== SimpleTrendEnum.NEUTRAL &&
            trendSignal.strength >= 6 &&
            trendSignal.confidence >= 6;
    }
}
