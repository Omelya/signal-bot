import { TechnicalIndicators } from "../../valueObjects/TechnicalIndicators";
import { MarketData } from "../../entities/MarketData";
import { SimpleTrendEnum, TrendSignal } from "./SimpleTrendAnalyzer";
import {VolumeLevelEnum} from "./VolumeAnalyzer";

export type SignalScore = {
    totalScore: number; // 0-10
    direction: 'BUY' | 'SELL' | 'HOLD';
    strength: 'WEAK' | 'MODERATE' | 'STRONG';
    confidence: number; // 0-100
    breakdown: ScoreBreakdown;
    recommendation: SignalRecommendation;
}

export type ScoreBreakdown = {
    trend: number; // 0-4 points
    momentum: number; // 0-3 points
    volume: number; // 0-2 points
    entry: number; // 0-1 points
    penalties: number; // negative points
    details: string[]; // Пояснення кожного компонента
}

export type SignalRecommendation = {
    action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    positionSize: 'SMALL' | 'NORMAL' | 'LARGE';
    reasons: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class SimpleSignalScorer {
    public scoreSignal(
        trendSignal: TrendSignal,
        indicators: TechnicalIndicators,
        marketData: MarketData,
        volume: VolumeLevelEnum
    ): SignalScore {

        try {
            // 1. Розрахунок компонентів балу
            const breakdown = this.calculateScoreBreakdown(trendSignal, indicators, marketData, volume);

            // 2. Загальний бал
            const totalScore = this.calculateTotalScore(breakdown);

            // 3. Напрямок сигналу
            const direction = this.determineDirection(trendSignal, totalScore);

            // 4. Сила сигналу
            const strength = this.determineStrength(totalScore);

            // 5. Впевненість
            const confidence = this.calculateConfidence(breakdown, trendSignal, totalScore);

            // 6. Рекомендація
            const recommendation = this.generateRecommendation(
                totalScore,
                direction,
                confidence,
                volume,
                breakdown
            );

            return {
                totalScore,
                direction,
                strength,
                confidence,
                breakdown,
                recommendation
            };

        } catch (error) {
            // Fallback у випадку помилки
            return this.createSafeHoldSignal(error);
        }
    }

    /**
     * Розрахунок детального розбору балів
     * Замінює ваші методи calculateStrength() та generateRecommendation()
     */
    private calculateScoreBreakdown(
        trendSignal: TrendSignal,
        indicators: TechnicalIndicators,
        marketData: MarketData,
        volume: VolumeLevelEnum
    ): ScoreBreakdown {

        const details: string[] = [];

        // 1. Trend Score (максимум 4 бали - 40% ваги)
        const trendScore = this.calculateTrendScore(trendSignal, details);

        // 2. Momentum Score (максимум 3 бали - 30% ваги)
        const momentumScore = this.calculateMomentumScore(indicators, marketData, details);

        // 3. Volume Score (максимум 2 бали - 20% ваги)
        const volumeScore = this.calculateVolumeScore(volume, marketData, details);

        // 4. Entry Timing Score (максимум 1 бал - 10% ваги)
        const entryScore = this.calculateEntryScore(indicators, trendSignal, details);

        // 5. Penalties (негативні бали)
        const penalties = this.calculatePenalties(indicators, marketData, details);

        return {
            trend: trendScore,
            momentum: momentumScore,
            volume: volumeScore,
            entry: entryScore,
            penalties,
            details
        };
    }

    /**
     * Оцінка тренду (0-4 бали)
     * Замінює складну логіку з TrendAnalyzer
     */
    private calculateTrendScore(trendSignal: TrendSignal, details: string[]): number {
        let score = 0;

        if (trendSignal.direction === SimpleTrendEnum.NEUTRAL) {
            score = 1;
            details.push('Тренд: Нейтральний (+1.0)');
            return score;
        }

        // 1. Базовий бал від сили тренду (0-3 бали)
        const strengthScore = (trendSignal.strength / 10) * 3;
        score += strengthScore;

        // 2. Бонус за високу впевненість (0-1 бал)
        let confidenceBonus = 0;
        if (trendSignal.confidence >= 8) {
            confidenceBonus = 1;
        } else if (trendSignal.confidence >= 6) {
            confidenceBonus = 0.5;
        } else if (trendSignal.confidence >= 4) {
            confidenceBonus = 0.2;
        }

        score += confidenceBonus;

        const trendText = trendSignal.direction === SimpleTrendEnum.BULLISH ? 'Бичачий' : 'Ведмежий';
        details.push(`Тренд: ${trendText} сила(${strengthScore.toFixed(1)}) + впевненість(${confidenceBonus.toFixed(1)}) = +${score.toFixed(1)}`);

        return Math.min(4, Math.round(score * 10) / 10);
    }

    /**
     * Оцінка моментуму (0-3 бали)
     * Спрощує вашу логіку з RSI та price changes
     */
    private calculateMomentumScore(
        indicators: TechnicalIndicators,
        marketData: MarketData,
        details: string[]
    ): number {
        let score = 0;
        const statistics = marketData.getStatistics();
        const rsi = indicators.values.rsi;
        const scoreDetails: string[] = [];

        // 1. RSI positioning (0-1.5 бали)
        let rsiScore = 0;
        if (rsi < 30) {
            rsiScore = 1.5; // Oversold - відмінно для BUY
            scoreDetails.push(`RSI перепродано (${rsi.toFixed(1)})`);
        } else if (rsi > 70) {
            rsiScore = 1.5; // Overbought - відмінно для SELL
            scoreDetails.push(`RSI перекуплено (${rsi.toFixed(1)})`);
        } else if (rsi >= 45 && rsi <= 55) {
            rsiScore = 1; // Нейтральна зона - добре для будь-якого напрямку
            scoreDetails.push(`RSI нейтральний (${rsi.toFixed(1)})`);
        } else if ((rsi >= 30 && rsi <= 45) || (rsi >= 55 && rsi <= 70)) {
            rsiScore = 0.7; // Помірні рівні
            scoreDetails.push(`RSI помірний (${rsi.toFixed(1)})`);
        } else {
            rsiScore = 0.3; // Проміжні рівні
            scoreDetails.push(`RSI проміжний (${rsi.toFixed(1)})`);
        }

        score += rsiScore;

        // 2. Price momentum (0-1.5 бали)
        const absPriceChange = Math.abs(statistics.priceChangePercent);
        let momentumScore = 0;

        if (absPriceChange > 5) {
            momentumScore = 1.5; // Дуже сильний моментум
            scoreDetails.push(`Дуже сильний моментум (${statistics.priceChangePercent.toFixed(1)}%)`);
        } else if (absPriceChange > 3) {
            momentumScore = 1.2; // Сильний моментум
            scoreDetails.push(`Сильний моментум (${statistics.priceChangePercent.toFixed(1)}%)`);
        } else if (absPriceChange > 1.5) {
            momentumScore = 0.8; // Помірний моментум
            scoreDetails.push(`Помірний моментум (${statistics.priceChangePercent.toFixed(1)}%)`);
        } else if (absPriceChange > 0.5) {
            momentumScore = 0.4; // Слабкий моментум
            scoreDetails.push(`Слабкий моментум (${statistics.priceChangePercent.toFixed(1)}%)`);
        } else {
            momentumScore = 0.1; // Дуже слабкий
            scoreDetails.push(`Мінімальний моментум (${statistics.priceChangePercent.toFixed(1)}%)`);
        }

        score += momentumScore;

        details.push(`Моментум: ${scoreDetails.join(' + ')} = +${score.toFixed(1)}`);

        return Math.min(3, Math.round(score * 10) / 10);
    }

    /**
     * Оцінка об'єму (0-2 бали)
     * Спрощує вашу VolumeAnalyzer логіку
     */
    private calculateVolumeScore(
        volume: VolumeLevelEnum,
        marketData: MarketData,
        details: string[]
    ): number {
        const statistics = marketData.getStatistics();
        const absPriceChange = Math.abs(statistics.priceChangePercent);
        let score = 0;
        let reasoning = '';

        switch (volume) {
            case VolumeLevelEnum.HIGH:
                if (absPriceChange > 2) {
                    score = 2; // Ідеальна комбінація
                    reasoning = `Високий об'єм + сильний рух (${absPriceChange.toFixed(1)}%)`;
                } else {
                    score = 1.5; // Високий об'єм - завжди добре
                    reasoning = `Високий об'єм (слабкий рух ${absPriceChange.toFixed(1)}%)`;
                }
                break;

            case VolumeLevelEnum.NORMAL:
                if (absPriceChange > 3) {
                    score = 1.2; // Нормальний об'єм зі сильним рухом
                    reasoning = `Нормальний об'єм + сильний рух (${absPriceChange.toFixed(1)}%)`;
                } else {
                    score = 1; // Стандартно
                    reasoning = `Нормальний об'єм (${absPriceChange.toFixed(1)}% рух)`;
                }
                break;

            case VolumeLevelEnum.LOW:
                if (absPriceChange < 1) {
                    score = 0.5; // Низький об'єм, але і рух слабкий
                    reasoning = `Низький об'єм + слабкий рух (${absPriceChange.toFixed(1)}%)`;
                } else {
                    score = 0.2; // Низький об'єм зі значним рухом - підозріло
                    reasoning = `Низький об'єм + сильний рух (${absPriceChange.toFixed(1)}%) - ризик`;
                }
                break;
        }

        details.push(`Об'єм: ${reasoning} = +${score.toFixed(1)}`);

        return Math.round(score * 10) / 10;
    }

    /**
     * Оцінка таймінгу входу (0-1 бал)
     * Визначає наскільки добрий момент для входу
     */
    private calculateEntryScore(
        indicators: TechnicalIndicators,
        trendSignal: TrendSignal,
        details: string[]
    ): number {
        const rsi = indicators.values.rsi;
        let score = 0;
        let reasoning = '';

        if (trendSignal.direction === SimpleTrendEnum.BULLISH) {
            // Для бичачого тренду - краще входити на відкатах
            if (rsi < 40) {
                score = 1; // Відмінний момент для покупки
                reasoning = `Відмінний момент BUY (RSI: ${rsi.toFixed(1)})`;
            } else if (rsi < 50) {
                score = 0.7; // Хороший момент
                reasoning = `Хороший момент BUY (RSI: ${rsi.toFixed(1)})`;
            } else if (rsi < 60) {
                score = 0.4; // Прийнятний момент
                reasoning = `Прийнятний момент BUY (RSI: ${rsi.toFixed(1)})`;
            } else {
                score = 0.1; // Поганий момент - перекуплено
                reasoning = `Поганий тайминг BUY - перекуплено (RSI: ${rsi.toFixed(1)})`;
            }
        } else if (trendSignal.direction === SimpleTrendEnum.BEARISH) {
            // Для ведмежого тренду - краще входити на підйомах
            if (rsi > 60) {
                score = 1; // Відмінний момент для продажу
                reasoning = `Відмінний момент SELL (RSI: ${rsi.toFixed(1)})`;
            } else if (rsi > 50) {
                score = 0.7; // Хороший момент
                reasoning = `Хороший момент SELL (RSI: ${rsi.toFixed(1)})`;
            } else if (rsi > 40) {
                score = 0.4; // Прийнятний момент
                reasoning = `Прийнятний момент SELL (RSI: ${rsi.toFixed(1)})`;
            } else {
                score = 0.1; // Поганий момент - перепродано
                reasoning = `Поганий тайминг SELL - перепродано (RSI: ${rsi.toFixed(1)})`;
            }
        } else {
            // Нейтральний тренд
            if (rsi < 35 || rsi > 65) {
                score = 0.5; // Екстремальні рівні можуть дати розворот
                reasoning = `Можливий розворот (RSI: ${rsi.toFixed(1)})`;
            } else {
                score = 0.1; // Не найкращий час для торгівлі
                reasoning = `Нейтральний тайминг (RSI: ${rsi.toFixed(1)})`;
            }
        }

        details.push(`Тайминг: ${reasoning} = +${score.toFixed(1)}`);

        return Math.round(score * 10) / 10;
    }

    /**
     * Розрахунок штрафів (негативні бали)
     * Спрощує вашу складну систему penalties
     */
    private calculatePenalties(
        indicators: TechnicalIndicators,
        marketData: MarketData,
        details: string[]
    ): number {
        let penalties = 0;
        const penaltyDetails: string[] = [];

        // 1. Дивергенція індикаторів
        if (indicators.hasDivergence()) {
            penalties -= 1;
            penaltyDetails.push('Дивергенція індикаторів (-1.0)');
        }

        // 2. Застарілі дані
        const dataAge = marketData.getAgeInMinutes();
        if (dataAge > 15) {
            penalties -= 1;
            penaltyDetails.push(`Застарілі дані ${dataAge}хв (-1.0)`);
        } else if (dataAge > 10) {
            penalties -= 0.5;
            penaltyDetails.push(`Стареші дані ${dataAge}хв (-0.5)`);
        }

        // 3. Екстремальні значення RSI (можуть бути обманливими)
        const rsi = indicators.values.rsi;
        if (rsi > 85 || rsi < 15) {
            penalties -= 0.5;
            penaltyDetails.push(`Екстремальний RSI ${rsi.toFixed(1)} (-0.5)`);
        }

        // 4. Дуже низька волатільність (складно отримати прибуток)
        const stats = marketData.getStatistics();
        if (Math.abs(stats.priceChangePercent) < 0.3 && stats.volatility < 0.01) {
            penalties -= 0.3;
            penaltyDetails.push('Дуже низька активність (-0.3)');
        }

        if (penaltyDetails.length > 0) {
            details.push(`Штрафи: ${penaltyDetails.join(', ')}`);
        }

        return Math.round(penalties * 10) / 10;
    }

    /**
     * Розрахунок загального балу
     */
    private calculateTotalScore(breakdown: ScoreBreakdown): number {
        const total = breakdown.trend + breakdown.momentum + breakdown.volume + breakdown.entry + breakdown.penalties;
        return Math.max(0, Math.min(10, Math.round(total * 10) / 10));
    }

    /**
     * Визначення напрямку сигналу
     */
    private determineDirection(trendSignal: TrendSignal, totalScore: number): 'BUY' | 'SELL' | 'HOLD' {
        // Мінімальний поріг для генерації сигналу
        if (totalScore < 4) return 'HOLD';

        if (trendSignal.direction === SimpleTrendEnum.BULLISH) return 'BUY';
        if (trendSignal.direction === SimpleTrendEnum.BEARISH) return 'SELL';

        return 'HOLD';
    }

    /**
     * Визначення сили сигналу
     */
    private determineStrength(totalScore: number): 'WEAK' | 'MODERATE' | 'STRONG' {
        if (totalScore >= 8) return 'STRONG';
        if (totalScore >= 6) return 'MODERATE';
        return 'WEAK';
    }

    /**
     * Розрахунок впевненості (0-100%)
     */
    private calculateConfidence(
        breakdown: ScoreBreakdown,
        trendSignal: TrendSignal,
        totalScore: number
    ): number {

        // 1. Базова впевненість від загального балу (50% ваги)
        const scoreConfidence = (totalScore / 10) * 50;

        // 2. Впевненість тренду (30% ваги)
        const trendConfidence = (trendSignal.confidence / 10) * 30;

        // 3. Бонус за відсутність штрафів (20% ваги)
        const penaltyConfidence = breakdown.penalties >= -0.5 ? 20 :
            breakdown.penalties >= -1.0 ? 10 : 0;

        const totalConfidence = scoreConfidence + trendConfidence + penaltyConfidence;

        return Math.max(0, Math.min(100, Math.round(totalConfidence)));
    }

    /**
     * Генерація фінальної рекомендації
     * Замінює вашу складну логіку в generateRecommendation()
     */
    private generateRecommendation(
        totalScore: number,
        direction: 'BUY' | 'SELL' | 'HOLD',
        confidence: number,
        volume: VolumeLevelEnum,
        breakdown: ScoreBreakdown
    ): SignalRecommendation {

        let action: SignalRecommendation['action'] = 'HOLD';
        let positionSize: SignalRecommendation['positionSize'] = 'NORMAL';
        let riskLevel: SignalRecommendation['riskLevel'] = 'MEDIUM';
        const reasons: string[] = [];

        // 1. Визначення дії на основі балу та впевненості
        if (totalScore >= 8.5 && confidence >= 80) {
            action = direction === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL';
            reasons.push(`Відмінний сигнал: бал ${totalScore}/10, впевненість ${confidence}%`);
        } else if (totalScore >= 7 && confidence >= 65) {
            action = direction === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL';
            reasons.push(`Сильний сигнал: бал ${totalScore}/10, впевненість ${confidence}%`);
        } else if (totalScore >= 5.5 && confidence >= 50) {
            action = direction === 'BUY' ? 'BUY' : 'SELL';
            reasons.push(`Хороший сигнал: бал ${totalScore}/10, впевненість ${confidence}%`);
        } else if (totalScore >= 4 && confidence >= 40) {
            action = direction === 'BUY' ? 'BUY' : 'SELL';
            reasons.push(`Помірний сигнал: бал ${totalScore}/10, впевненість ${confidence}%`);
        } else {
            action = 'HOLD';
            reasons.push(`Слабкий сигнал: бал ${totalScore}/10, впевненість ${confidence}%`);
        }

        // 2. Визначення розміру позиції
        if (confidence >= 85 && volume === VolumeLevelEnum.HIGH && breakdown.penalties > -0.5) {
            positionSize = 'LARGE';
            reasons.push('Висока впевненість + хороша ліквідність = збільшена позиція');
            riskLevel = 'LOW';
        } else if (confidence >= 70 && volume !== VolumeLevelEnum.LOW) {
            positionSize = 'NORMAL';
            riskLevel = confidence >= 80 ? 'LOW' : 'MEDIUM';
        } else {
            positionSize = 'SMALL';
            reasons.push('Знижена впевненість або низький об\'єм = мала позиція');
            riskLevel = confidence < 50 ? 'HIGH' : 'MEDIUM';
        }

        // 3. Особливі випадки
        if (volume === VolumeLevelEnum.LOW && action !== 'HOLD') {
            positionSize = 'SMALL';
            riskLevel = 'HIGH';
            reasons.push('Низький об\'єм - ризик проковзання');
        }

        if (breakdown.penalties <= -1.5) {
            positionSize = 'SMALL';
            riskLevel = 'HIGH';
            reasons.push('Багато негативних факторів - обережно');
        }

        return {
            action,
            positionSize,
            reasons: reasons.slice(0, 3), // Максимум 3 причини
            riskLevel
        };
    }

    /**
     * Безпечний fallback сигнал у випадку помилки
     */
    private createSafeHoldSignal(error: any): SignalScore {
        return {
            totalScore: 0,
            direction: 'HOLD',
            strength: 'WEAK',
            confidence: 0,
            breakdown: {
                trend: 0,
                momentum: 0,
                volume: 0,
                entry: 0,
                penalties: -5,
                details: [`Помилка аналізу: ${error.message}`]
            },
            recommendation: {
                action: 'HOLD',
                positionSize: 'SMALL',
                reasons: ['Помилка в аналізі - утримуємося від торгівлі'],
                riskLevel: 'HIGH'
            }
        };
    }

    /**
     * Допоміжний метод для швидкої перевірки якості сигналу
     */
    public isHighQualitySignal(signalScore: SignalScore): boolean {
        return signalScore.totalScore >= 7 &&
            signalScore.confidence >= 70 &&
            signalScore.direction !== 'HOLD';
    }

    /**
     * Допоміжний метод для перевірки готовності до торгівлі
     */
    public shouldTrade(signalScore: SignalScore): boolean {
        return signalScore.totalScore >= 5 &&
            signalScore.confidence >= 50 &&
            signalScore.direction !== 'HOLD' &&
            signalScore.recommendation.riskLevel !== 'HIGH';
    }
}