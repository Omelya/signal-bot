import {User} from "../valueObjects/telegram/User";

export class TelegramMessage {
    constructor(
        private readonly id: number,
        private readonly chatId: number,
        private readonly text: string,
        private readonly user: User,
        private readonly timestamp: Date,
    ) {}

    getId(): number { return this.id; }

    getChatId(): number { return this.chatId; }

    getText(): string { return this.text; }

    getUser(): User { return this.user; }

    getTimestamp(): Date { return this.timestamp; }

    isCommand(): boolean {
        return this.text.startsWith('/');
    }
}
