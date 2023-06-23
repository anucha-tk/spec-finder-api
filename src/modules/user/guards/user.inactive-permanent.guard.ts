import { Injectable, CanActivate, ExecutionContext, BadRequestException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IRequestApp } from "src/common/request/interfaces/request.interface";
import { USER_INACTIVE_PERMANENT_META_KEY } from "src/modules/user/constants/user.constant";
import { ENUM_USER_STATUS_CODE_ERROR } from "src/modules/user/constants/user.status-code.constant";
import { UserDoc } from "src/modules/user/repository/entities/user.entity";

/**
 * Guard allow if `__user.inactivePermanent` includes USER_INACTIVE_PERMANENT_META_KEY boolean[]
 * @throws BadRequestException
 * */
@Injectable()
export class UserInactivePermanentGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate({ getHandler, getClass, switchToHttp }: ExecutionContext): Promise<boolean> {
    const required: boolean[] = this.reflector.getAllAndOverride<boolean[]>(
      USER_INACTIVE_PERMANENT_META_KEY,
      [getHandler(), getClass()],
    );

    if (!required) return true;

    const { __user } = switchToHttp().getRequest<IRequestApp & { __user: UserDoc }>();

    if (!required.includes(__user.inactivePermanent)) {
      throw new BadRequestException({
        statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_INACTIVE_ERROR,
        message: "user.error.inactivePermanent",
      });
    }
    return true;
  }
}
