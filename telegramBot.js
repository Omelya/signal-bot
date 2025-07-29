const axios = require('axios');
const config = require('./config');

class TelegramBot {
    constructor() {
        this.botToken = config.telegram.botToken;
        this.chatId = config.telegram.chatId;
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    }

    formatSignal(signal) {
        const emoji = signal.direction === 'SHORT' ? '🔴' : '🟢';
        const time = new Date(signal.timestamp).toLocaleTimeString('uk-UA', {
            timeZone: 'UTC',
            hour12: false
        });

        const reasoningText = signal.reasoning
            .map(reason => this.formatReason(reason))
            .map(reason => `• ${reason}`)
            .join('\n');

        const riskReward = this.calculateRiskReward(signal);

        return `
${emoji} <b>${signal.direction} СИГНАЛ</b> - SOL/USDT
⏰ ${time} UTC | 15m TF

💰 <b>ВХІД:</b> $${signal.entry.toFixed(2)}
🛑 <b>СТОП:</b> $${signal.stopLoss.toFixed(2)}

🎯 <b>ЦІЛІ:</b>
TP1: $${signal.targets[0].toFixed(2)} (30%)
TP2: $${signal.targets[1].toFixed(2)} (40%)  
TP3: $${signal.targets[2].toFixed(2)} (30%)

📊 <b>АНАЛІЗ:</b>
${reasoningText}

⚖️ R/R: 1:${riskReward} | 🎯 Впевненість: ${signal.confidence.toFixed(1)}/10
                    `
            .trim();
    }

    formatReason(reason) {
        const reasonMap = {
            priceAtResistance: 'Ціна біля EMA7 опору',
            rsiNeutral: 'RSI в нейтральній зоні',
            macdBearish: 'MACD ведмежий сигнал',
            volumeConfirmation: 'Підтвердження об\'ємом',
            bearishCandle: 'Ведмежа свічка',
            belowMediumTrend: 'Ціна під EMA14',
            nearBBUpper: 'Біля верхньої Bollinger Band',
            rsiOversold: 'RSI перепроданість',
            macdBullish: 'MACD бичачий сигнал',
            bullishCandle: 'Бича свічка',
            aboveMediumTrend: 'Ціна над EMA14',
            nearBBLower: 'Біля нижньої Bollinger Band',
            bounceFromSupport: 'Відскок від підтримки'
        };

        return reasonMap[reason] || reason;
    }

    calculateRiskReward(signal) {
        const risk = Math.abs(signal.entry - signal.stopLoss);
        const reward = Math.abs(signal.targets[1] - signal.entry); // Друга ціль
        return (reward / risk).toFixed(1);
    }

    async sendMessage(text) {
        try {
            const response = await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: this.chatId,
                text: text,
                parse_mode: 'HTML'
            });

            if (response.data.ok) {
                console.log('✅ Повідомлення відправлено успішно');
                return true;
            } else {
                console.error('❌ Помилка Telegram:', response.data.description);
                return false;
            }
        } catch (error) {
            console.error('❌ Помилка відправки:', error.message);
            return false;
        }
    }

    async sendSignal(signal) {
        const message = this.formatSignal(signal);
        return await this.sendMessage(message);
    }
}

module.exports = TelegramBot;
