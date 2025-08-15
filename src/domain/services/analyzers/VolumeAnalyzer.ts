import {ICandle, ITechnicalIndicatorValues} from "../../../shared";
import {MarketData} from "../../entities/MarketData";

export enum VolumeLevelEnum {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
}

export class VolumeAnalyzer {
    public analyzeVolume(marketData: MarketData, indicators: ITechnicalIndicatorValues): VolumeLevelEnum {
        const volumeProfile = indicators.volumeProfile;
        const statistics = marketData.getStatistics();

        // 1. Базовий аналіз за співвідношенням
        let volumeScore = this.calculateBaseVolumeScore(volumeProfile.ratio);

        // 2. Коригування за ціновим рухом
        const priceVolumeAdjustment = this.analyzePriceVolumeRelationship(
            statistics.priceChangePercent,
            volumeProfile.ratio
        );
        volumeScore += priceVolumeAdjustment;

        // 3. Коригування за часом (деякі періоди мають природно вищий об'єм)
        const timeAdjustment = this.getTimeBasedVolumeAdjustment();
        volumeScore += timeAdjustment;

        // 4. Аналіз тренду об'єму
        const volumeTrendAdjustment = this.analyzeVolumeTrend(marketData, indicators);
        volumeScore += volumeTrendAdjustment;

        // 5. Коригування за волатільністю
        const volatilityAdjustment = this.getVolatilityVolumeAdjustment(
            statistics.volatility,
            volumeProfile.ratio
        );
        volumeScore += volatilityAdjustment;

        return this.determineVolumeCategory(volumeScore);
    }

    private analyzeVolumeTrend(
        marketData: MarketData,
        indicators: ITechnicalIndicatorValues,
        periodsToAnalyze: number = 20,
    ): number {
        const volumeProfile = indicators.volumeProfile;

        // Перевіряємо чи достатньо даних для аналізу
        if (!marketData.hasSufficientData(periodsToAnalyze)) {
            // Якщо недостатньо даних, повертаємо спрощений аналіз
            return this.getSimpleVolumeSignal(volumeProfile.ratio);
        }

        // Отримуємо дані за останні N періодів
        const recentCandles = marketData.getCandles(periodsToAnalyze);
        const recentVolumes = recentCandles.map(candle => candle.volume);
        const currentVolume = marketData.latestCandle.volume;
        const averageVolume = marketData.getAverageVolume(periodsToAnalyze);

        // 1. Аналіз тренду об'єму (30% ваги)
        const volumeTrendScore = this.calculateVolumeTrendScore(recentVolumes) * 0.3;

        // 2. Аналіз поточного об'єму відносно середнього (25% ваги)
        const currentVolumeScore = this.calculateCurrentVolumeScore(currentVolume, averageVolume) * 0.25;

        // 3. Кореляція об'єму з рухом ціни (25% ваги)
        const volumePriceCorrelationScore = this.calculateVolumePriceCorrelation(
            recentCandles,
            recentVolumes
        ) * 0.25;

        // 4. Аналіз об'ємних пробоїв та аномалій (20% ваги)
        const volumeBreakoutScore = this.calculateVolumeBreakoutScore(
            currentVolume,
            recentVolumes,
            averageVolume
        ) * 0.2;

        const trendScore = volumeTrendScore + currentVolumeScore + volumePriceCorrelationScore + volumeBreakoutScore;

        // Нормалізуємо результат до діапазону [-1, 1]
        return Math.max(-1, Math.min(1, trendScore));
    }

    /**
     * Розраховує оцінку тренду об'єму на основі динаміки за N періодів
     */
    private calculateVolumeTrendScore(volumes: number[]): number {
        if (volumes.length < 3) return 0;

        const volumeChanges: number[] = [];
        let increasingPeriods = 0;
        let decreasingPeriods = 0;

        // Аналізуємо зміни об'єму між періодами
        for (let i = 1; i < volumes.length; i++) {
            const currentVol = volumes[i] as number;
            const previousVol = volumes[i - 1] as number;

            const change = (currentVol - previousVol) / previousVol;
            volumeChanges.push(change);

            if (change > 0.05) increasingPeriods++; // збільшення більше 5%
            if (change < -0.05) decreasingPeriods++; // зменшення більше 5%
        }

        // Розраховуємо загальний тренд
        const trendDirection = (increasingPeriods - decreasingPeriods) / volumeChanges.length;

        // Розраховуємо силу тренду через середнє абсолютне значення змін
        const averageAbsChange = volumeChanges.reduce((sum, change) => sum + Math.abs(change), 0) / volumeChanges.length;
        const trendStrength = Math.min(1, averageAbsChange * 2); // нормалізуємо силу

        return trendDirection * trendStrength;
    }

    /**
     * Оцінює поточний об'єм відносно середнього
     */
    private calculateCurrentVolumeScore(currentVolume: number, averageVolume: number): number {
        const ratio = currentVolume / averageVolume;

        if (ratio >= 3.0) return 1.0;      // Надзвичайно високий об'єм
        if (ratio >= 2.0) return 0.8;      // Дуже високий об'єм
        if (ratio >= 1.5) return 0.5;      // Високий об'єм
        if (ratio >= 1.2) return 0.2;      // Помірно високий об'єм
        if (ratio >= 0.8) return 0;        // Нормальний об'єм
        if (ratio >= 0.5) return -0.3;     // Низький об'єм
        return -0.6;                       // Дуже низький об'єм
    }

    /**
     * Аналізує кореляцію між об'ємом та рухом ціни
     */
    private calculateVolumePriceCorrelation(candles: readonly ICandle[], volumes: number[]): number {
        if (candles.length < 2) return 0;

        let positiveCorrelations = 0;
        let negativeCorrelations = 0;
        let totalSignificantMoves = 0;

        for (let i = 1; i < candles.length; i++) {
            const currentCandle = candles[i] as ICandle;
            const previousCandle = candles[i - 1] as ICandle;
            const currentVolume = volumes[i] as number;
            const previousVolume = volumes[i - 1] as number;

            // Розраховуємо зміну ціни та об'єму
            const priceChange = (currentCandle.close - previousCandle.close) / previousCandle.close;
            const volumeChange = (currentVolume - previousVolume) / previousVolume;

            // Враховуємо тільки значні рухи (більше 1%)
            if (Math.abs(priceChange) > 0.01) {
                totalSignificantMoves++;

                // Перевіряємо кореляцію: позитивна - об'єм зростає з ціною
                if ((priceChange > 0 && volumeChange > 0) || (priceChange < 0 && volumeChange > 0)) {
                    positiveCorrelations++;
                } else if (volumeChange < -0.1) { // Об'єм значно падає
                    negativeCorrelations++;
                }
            }
        }

        if (totalSignificantMoves === 0) return 0;

        const correlationRatio = positiveCorrelations / totalSignificantMoves;
        const negativeRatio = negativeCorrelations / totalSignificantMoves;

        // Позитивна кореляція об'єму з рухами ціни = хороший знак
        return (correlationRatio * 0.8) - (negativeRatio * 0.5);
    }

    /**
     * Виявляє об'ємні пробої та аномалії
     */
    private calculateVolumeBreakoutScore(
        currentVolume: number,
        recentVolumes: number[],
        averageVolume: number
    ): number {
        // Розраховуємо стандартне відхилення об'єму
        const volumeVariance = recentVolumes.reduce((sum, vol) => {
            return sum + Math.pow(vol - averageVolume, 2);
        }, 0) / recentVolumes.length;

        const volumeStdDev = Math.sqrt(volumeVariance);

        // Виявляємо аномальні об'єми
        const zScore = (currentVolume - averageVolume) / volumeStdDev;

        // Перевіряємо максимальний об'єм за останні періоди
        const maxRecentVolume = Math.max(...recentVolumes);
        const isNewVolumeHigh = currentVolume > maxRecentVolume;

        let breakoutScore = 0;

        // Оцінюємо на основі Z-score
        if (zScore >= 3.0) {
            breakoutScore = 1.0; // Надзвичайно високий об'єм
        } else if (zScore >= 2.0) {
            breakoutScore = 0.7; // Дуже високий об'єм
        } else if (zScore >= 1.5) {
            breakoutScore = 0.4; // Помітно високий об'єм
        } else if (zScore <= -2.0) {
            breakoutScore = -0.6; // Аномально низький об'єм
        }

        // Бонус за новий максимум об'єму
        if (isNewVolumeHigh && zScore > 1.0) {
            breakoutScore += 0.3;
        }

        return Math.max(-1, Math.min(1, breakoutScore));
    }

    /**
     * Спрощений аналіз об'єму для випадків з недостатніми даними
     */
    private getSimpleVolumeSignal(volumeRatio: number): number {
        if (volumeRatio >= 3.0) return 0.8;
        if (volumeRatio >= 2.0) return 0.5;
        if (volumeRatio >= 1.5) return 0.3;
        if (volumeRatio >= 1.2) return 0.1;
        if (volumeRatio >= 0.8) return 0;
        if (volumeRatio >= 0.6) return -0.2;
        return -0.4;
    }

    private calculateBaseVolumeScore(ratio: number): number {
        if (ratio > 3.0) return 10;      // Екстремально високий
        if (ratio > 2.5) return 9;       // Дуже високий
        if (ratio > 2.0) return 8;       // Високий
        if (ratio > 1.5) return 6;       // Вище норми
        if (ratio > 1.3) return 5;       // Нормальний
        if (ratio > 1.0) return 4;       // Трохи нижче норми
        if (ratio > 0.7) return 3;       // Низький
        if (ratio > 0.5) return 2;       // Дуже низький
        return 1;                        // Екстремально низький
    }

    private analyzePriceVolumeRelationship(priceChange: number, volumeRatio: number): number {
        const absPriceChange = Math.abs(priceChange);

        // Здоровий ринок: великі цінові рухи супроводжуються високим об'ємом
        if (absPriceChange > 5 && volumeRatio > 2.0) {
            return 2; // Підтвердження сильного руху
        }

        // Великий ціновий рух на малому об'ємі - підозріло
        if (absPriceChange > 3 && volumeRatio < 0.8) {
            return -2; // Слабке підтвердження
        }

        // Високий об'єм без суттєвої зміни ціни - акумуляція/розподіл
        if (absPriceChange < 1 && volumeRatio > 2.0) {
            return 1; // Цікавий сигнал
        }

        // Малий рух на нормальному об'ємі
        if (absPriceChange < 2 && volumeRatio >= 1.0 && volumeRatio <= 1.5) {
            return 0; // Нейтрально
        }

        return 0;
    }

    private getTimeBasedVolumeAdjustment(): number {
        const now = new Date();
        const hour = now.getUTCHours();

        // Коригування за часовими поясами (UTC)
        // Високий об'єм під час активних торгових сесій

        // Азійська сесія (00:00-08:00 UTC)
        if (hour >= 0 && hour < 8) {
            return 0; // Нейтрально
        }

        // Європейська сесія (08:00-16:00 UTC)
        if (hour >= 8 && hour < 16) {
            return 0.5; // Трохи вищий об'єм очікується
        }

        // Американська сесія (13:00-22:00 UTC) - перекриття з Європою
        if (hour >= 13 && hour < 22) {
            return 1; // Найвищий об'єм очікується
        }

        // Нічний час
        return -0.5; // Нижчий об'єм природний
    }

    private getVolatilityVolumeAdjustment(volatility: number, volumeRatio: number): number {
        // Висока волатільність зазвичай супроводжується високим об'ємом
        if (volatility > 0.05) { // Висока волатільність
            if (volumeRatio > 1.5) {
                return 1; // Очікувано високий об'єм
            } else {
                return -1; // Неочікувано низький об'єм при високій волатільності
            }
        }

        // Низька волатільність
        if (volatility < 0.02 && volumeRatio > 2.0) {
            return 1;
        }

        return 0;
    }

    private determineVolumeCategory(score: number): VolumeLevelEnum {
        if (score >= 8) return VolumeLevelEnum.HIGH;
        if (score >= 4) return VolumeLevelEnum.NORMAL;
        return VolumeLevelEnum.LOW;
    }
}
