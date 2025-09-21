import {TelegramMessage} from "../../domain/entities/TelegramMessage";
import {TelegramCallbackDataEnum} from "../../shared/types/TelegramCallbackData.types";
import {PrismaClient} from "@prisma/client";
import {AbstractTelegramHandler} from "./AbstractTelegramHandler";
import {UserPair} from "../../domain/entities/UserPair";

const prisma = new PrismaClient();

export class TelegramCallbackHandler extends AbstractTelegramHandler {
    public async settingsNewUser(message: TelegramMessage) {
        await this.deleteMessage(message);
        await this.sendTopCryptoPair(message);
        await this.sendAltCryptoPair(message);
    }

    public async addTradingPair(message: TelegramMessage) {
        await this.sendTopCryptoPair(message);
        await this.sendAltCryptoPair(message);

        const button = {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🔙 Повернутися в головне меню',
                        callback_data: TelegramCallbackDataEnum.MAIN_MENU,
                    }],
                ],
            },
        };

        await this.sendMessage(message.getChatId(), 'Керування', button);
    }

    public async chooseTradingPair(message: TelegramMessage, symbol: string) {
        const pair = await prisma
            .tradingPair
            .findFirst({where: {symbol: symbol}});

        if (!pair) {
            const errorText = `Торгова пара ${symbol} не знайдена`;
            await this.sendMessage(message.getChatId(), errorText);

            return;
        }

        const userPair = await this
            .userTradingPairRepository
            .findUserPair(message.getChatId(), pair.id);

        if (userPair && userPair.is_active) {
            await this.sendPairAlreadyExist(message);
            return;
        }

        try {
            if (userPair) {
                await this.userTradingPairRepository.update(userPair.activate());
            } else {
                await this
                    .userTradingPairRepository
                    .save(UserPair.create({
                        user_id: message.getChatId(),
                        trading_pair_id: pair.id,
                    }));
            }

            const text = `Додано нову торгову пару ${symbol}`;
            await this.sendMessage(message.getChatId(), text);
            await this.sendNextButton(message);
        } catch (error: any) {
            this.logger.error(
                `Failed add new trading pair ${symbol} for user ${message.getChatId()}`,
                error.message,
            );

            const errorText = `Не вдалося додати нову торгову пару ${symbol}`
            await this.sendMessage(message.getChatId(), errorText);
        }
    }

    public async deleteTradingPair(message: TelegramMessage, symbol: string) {
        const pair = await prisma.tradingPair.findFirst({
            where: {symbol: symbol},
            include: {
                user_trading_pairs: {
                    where: {
                        user_id: message.getChatId(),
                    },
                },
            },
        });

        if (!pair || pair?.user_trading_pairs?.length === 0) {
            const errorText = `Торгова пара ${symbol} не знайдена`;
            await this.sendMessage(message.getChatId(), errorText);

            return;
        }

        const [userTradingPair] = pair?.user_trading_pairs;

        try {
            await prisma
                .userTradingPair
                .update({
                    where: {id: userTradingPair!.id},
                    data: {is_active: false},
                });

            const text = `Торгову пару ${symbol} видалено`;

            await this.sendMessage(message.getChatId(), text);
            await this.settings(message);
        } catch (error: any) {
            this.logger.error(
                `Failed deleting trading pair ${symbol} for user ${message.getChatId()}`,
                error.message,
            );

            const errorText = `Не вдалося видалити торгову пару ${symbol}`
            await this.sendMessage(message.getChatId(), errorText);
        }
    }

    public async changeStatusNotification(message: TelegramMessage) {
        await this.changeStatusSignalNotification(message);

        const mainMenu = await this.showMainMenu(message);

        if (mainMenu) {
            try {
                await this.sendMessage(
                    message.getChatId(),
                    mainMenu?.text,
                    mainMenu?.button,
                    message.getId(),
                );
            } catch (error: any) {
                this.logger.error(error?.message, error)
            }
        }
    }

    public async changeStatusSignalNotification(message: TelegramMessage, enable?: boolean) {
        const user = await prisma
            .user
            .findFirst({
                where: {telegram_user_id: message.getChatId()},
            });

        if (!user) {
            await this.sendUserNotFoundError(message);
            return;
        }

        let notificationStatus;
        if (enable) {
            notificationStatus = enable;
        } else {
            notificationStatus = !user.notifications_enabled;
        }

        try {
            await prisma.user.update({
                where: {telegram_user_id: message.getChatId()},
                data: {notifications_enabled: notificationStatus},
            });
        } catch (error: any) {
            this.logger.error(`Failed change status signal notification for ${user.telegram_user_id}`, error);

            const errorText = 'Не вдалося оновити налаштування нотифікацій, почніть спочатку';
            await this.sendMessage(message.getChatId(), errorText);
        }
    }

    public async settings(message: TelegramMessage) {
        const activePairs = await prisma
            .userTradingPair
            .findMany({
                where: {
                    user_id: message.getChatId(),
                    is_active: true,
                },
                include: {trading_pair: true},
            });

        const countActivePairs = activePairs.length ?? 0;

        const text = `⚙️ Налаштування бота

Обрані валютні пари: ${countActivePairs}/5`;

        let deleteButtons: { text: string; callback_data: string; }[][] = [];

        activePairs.forEach((pair) => {
            deleteButtons.push([{
                text: `🗑 Видалити пару ${pair.trading_pair.symbol}`,
                callback_data: TelegramCallbackDataEnum.DELETE_TRADING_PAIR + pair.trading_pair.symbol,
            }]);
        });

        const button = {
            reply_markup: {
                inline_keyboard: [
                    [{text: '🔙 Повернутися в головне меню', callback_data: TelegramCallbackDataEnum.MAIN_MENU}],
                    [{text: '➕ Додати пару', callback_data: TelegramCallbackDataEnum.ADD_TRADING_PAIR}],
                    ...deleteButtons,
                ],
            },
        };

        await this.sendMessage(message.getChatId(), text, button, message.getId());
    }

    private async sendTopCryptoPair(message: TelegramMessage) {
        const text = 'Топ криптовалюти:';
        const sentMessage = await this.bot?.sendMessage(
            message.getChatId(),
            text,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'BTC/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'BTC/USDT',
                            },
                            {
                                text: 'ETH/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'ETH/USDT',
                            },
                            {
                                text: 'BNB/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'BNB/USDT',
                            },
                        ],
                        [
                            {
                                text: 'ADA/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'ADA/USDT',
                            },
                            {
                                text: 'DOT/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'DOT/USDT',
                            },
                            {
                                text: 'SOL/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'SOL/USDT',
                            },
                        ],
                    ],
                },
            },
        );

        if (sentMessage) {
            this.autoDeleteMessage(message.getChatId(), sentMessage.message_id);
        }
    }

    private async sendAltCryptoPair(message: TelegramMessage) {
        const text = 'Альткоїни:';
        const sentMessage = await this.bot?.sendMessage(
            message.getChatId(),
            text,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'DOGE/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'DOGE/USDT',
                            },
                            {
                                text: 'SHIB/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'SHIB/USDT',
                            },
                            {
                                text: 'XRP/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'XRP/USDT',
                            },
                        ],
                        [
                            {
                                text: 'LTC/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'LTC/USDT',
                            },
                            {
                                text: 'LINK/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'LINK/USDT',
                            },
                            {
                                text: 'UNI/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'UNI/USDT',
                            },
                        ],
                        [
                            {
                                text: 'AVAX/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'AVAX/USDT',
                            },
                            {
                                text: 'MNT/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'MNT/USDT',
                            },
                            {
                                text: 'PEPE/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'PEPE/USDT',
                            },
                        ],
                        [
                            {
                                text: 'STBL/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'STBL/USDT',
                            },
                            {
                                text: 'MATIC/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'MATIC/USDT',
                            },
                            {
                                text: 'AAVE/USDT',
                                callback_data: TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR + 'AAVE/USDT',
                            },
                        ],
                    ],
                },
            },
        );

        if (sentMessage) {
            this.autoDeleteMessage(message.getChatId(), sentMessage.message_id);
        }
    }

    private async sendNextButton(message: TelegramMessage) {
        await this.bot?.sendMessage(
            message.getChatId(),
            'Продовжимо?',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Далі', callback_data: TelegramCallbackDataEnum.MAIN_MENU}],
                    ],
                },
            },
        );
    }
}
