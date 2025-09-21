import {IUserRepository} from "../../domain/repositories/IUserRepository";
import {PrismaClient} from "@prisma/client";
import {ILogger} from "../../shared";
import {User} from "../../domain/entities/User";

const prisma = new PrismaClient();

export class UserRepository implements IUserRepository {
    public constructor(private logger: ILogger) {
    }

    async save(user: User): Promise<void> {
        try {
            await prisma.user.create({
                data: {
                    telegram_user_id: user.telegram_user_id,
                    telegram_username: user.telegram_username,
                    notifications_enabled: user.notifications_enabled,
                },
            });
        } catch (error: any) {
            this.logger.error('Error query', error);
        }
    }

    update(user: User): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async findByTelegramId(id: number): Promise<User | null> {
        try {
            const data = await prisma
                .user
                .findFirst({
                    where: {telegram_user_id: id},
                });

            if (data) {
                return User.create({
                    id: data.id as unknown as number,
                    telegram_user_id: data.telegram_user_id as unknown as number,
                    telegram_username: data.telegram_username,
                    notifications_enabled: data.notifications_enabled,
                });
            }
        } catch (error: any) {
            this.logger.error('Error query', error);
        }

        return null;
    }
}
