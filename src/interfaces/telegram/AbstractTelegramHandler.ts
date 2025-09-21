import TelegramBot, {EditMessageTextOptions, SendMessageOptions} from "node-telegram-bot-api";
import {ILogger} from "../../shared";
import {TelegramMessage} from "../../domain/entities/TelegramMessage";
import {TelegramCallbackDataEnum} from "../../shared/types/TelegramCallbackData.types";
import {IUserRepository} from "../../domain/repositories/IUserRepository";
import {IUserTradingRepository} from "../../domain/repositories/IUserTradingRepository";
import {ISignalRepository} from "../../domain/repositories/ISignalRepository";

export abstract class AbstractTelegramHandler {
    protected bot?: TelegramBot;

    public constructor(
        protected userRepository: IUserRepository,
        protected userTradingPairRepository: IUserTradingRepository,
        protected signalRepository: ISignalRepository,
        protected logger: ILogger,
    ) {
    }

    public init(bot: TelegramBot): void {
        this.bot = bot;
    }

    protected async sendMessage(
        chatId: number,
        text: string,
        options?: SendMessageOptions,
        id?: number,
    ) {
        if (id) {
            await this.bot?.editMessageText(text, {
                chat_id: chatId,
                message_id: id,
                ...options as EditMessageTextOptions,
            });
        } else {
            await this.bot?.sendMessage(chatId, text, options);
        }
    }

    protected async editMessage(message: TelegramMessage, options: EditMessageTextOptions) {
        await this.bot?.editMessageText(message.getText(), {
            chat_id: message.getChatId(),
            message_id: message.getId(),
            ...options,
        });
    }

    protected async deleteMessage(message: TelegramMessage) {
        await this.bot?.deleteMessage(message.getChatId(), message.getId());
    }

    protected autoDeleteMessage(chatId: number, messageId: number, delay: number = 300000) {
        setTimeout(() => {
            try {
                this.bot?.deleteMessage(chatId, messageId);
            } catch (error) {
                this.logger.error('Не вдалося видалити повідомлення:', error);
            }
        }, delay);
    }

    protected async sendUserNotFoundError(message: TelegramMessage) {
        const text = 'Такого користувача не існує, виконайте команду /start, щоб продовжити';
        await this.sendMessage(message.getChatId(), text);

        this.logger.error(text, message);
    }

    protected async sendPairAlreadyExist(message: TelegramMessage) {
        const text = `Ви вже підписані на торгову пару ${message.getText()}`;
        await this.sendMessage(message.getChatId(), text);

        this.logger.error(text, message);
    }

    public async showMainMenu(message: TelegramMessage) {
        const activePairs = await this
            .userTradingPairRepository
            .findActiveUserTradingPair(message.getChatId());

        const countActivePairs = activePairs.length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySignalsCount = await this
            .signalRepository
            .getCountUserSignalByDate(message.getChatId(), today, tomorrow);

        const lastSignals = await this
            .signalRepository
            .getLastUserSignals(message.getChatId(), 3);

        const user = await this
            .userRepository
            .findByTelegramId(message.getChatId());

        if (!user) {
            await this.sendUserNotFoundError(message);
            return;
        }

        const notificationIcon = user.notifications_enabled
            ? '✅'
            : '❌';

        const text = `🎯 CryptoSignals

📊 Dashboard:
├── Активні пари: ${countActivePairs}/5 ⚙️
└── Сигналів сьогодні: ${todaySignalsCount} 📈

🔥 Останні сигнали:
${lastSignals.map((value) => (
`- ${value.pair} ${value.direction}\n\n`))}`;

        const button = {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '⚙️ Налаштування',
                        callback_data: TelegramCallbackDataEnum.SETTINGS,
                    }],
                    [{
                        text: `🔔 Сповіщення: ${notificationIcon}`,
                        callback_data: TelegramCallbackDataEnum.CHANGE_SIGNAL_NOTIFICATION,
                    }],
                ],
            },
        };

        return {text, button};
    }

    public async sendMainMenu(message: TelegramMessage) {
        const mainMenu = await this.showMainMenu(message);

        if (mainMenu) {
            await this.sendMessage(
                message.getChatId(),
                mainMenu.text,
                mainMenu.button,
                message.getId(),
            );
        }
    }
}
