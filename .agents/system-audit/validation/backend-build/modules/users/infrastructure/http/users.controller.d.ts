import { UsersService } from '../../application/users.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(user: CurrentUserPayload): Promise<import("../../domain/ports/user.repository.port").UserRecord>;
    updateProfile(user: CurrentUserPayload, dto: UpdateUserDto): Promise<import("../../domain/ports/user.repository.port").UserRecord>;
    deleteAccount(user: CurrentUserPayload): Promise<{
        message: string;
    }>;
}
