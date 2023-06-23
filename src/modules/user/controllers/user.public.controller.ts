import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "src/common/auth/services/auth.service";
import { Response } from "src/common/response/decorators/response.decorator";
import { IResponse } from "src/common/response/interfaces/response.interface";
import { ENUM_USER_STATUS_CODE_ERROR } from "../constants/user.status-code.constant";
import { UserPublicLoginDoc } from "../docs/user.public.doc";
import { UserLoginSerialization } from "../serializations/user.login.serialization";
import { UserLoginDto } from "../dtos/user.login.dto";
import { UserDoc } from "../repository/entities/user.entity";
import { ENUM_ERROR_STATUS_CODE_ERROR } from "src/common/error/constants/error.status-code.constant";
import { IUserDoc } from "../interfaces/user.interface";
import { ENUM_ROLE_STATUS_CODE_ERROR } from "src/modules/role/constants/role.status-code.constant";
import { UserService } from "../services/user.service";
import { SettingService } from "src/common/setting/services/setting.service";
import { ENUM_AUTH_LOGIN_WITH } from "src/common/auth/constants/auth.enum.constant";
import { ApiKeyPublicProtected } from "src/common/api-key/decorators/api-key.decorator";

@ApiKeyPublicProtected()
@ApiTags("modules.public.user")
@Controller({
  version: "1",
  path: "/user",
})
export class UserPublicController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly settingService: SettingService,
  ) {}

  @UserPublicLoginDoc()
  @Response("user.login", {
    serialization: UserLoginSerialization,
  })
  @HttpCode(HttpStatus.OK)
  @Post("/login")
  async login(@Body() { email, password }: UserLoginDto): Promise<IResponse> {
    const user: UserDoc = await this.userService.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException({
        statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_NOT_FOUND_ERROR,
        message: "user.error.notFound",
      });
    }

    const [passwordAttempt, maxPasswordAttempt] = await Promise.all([
      this.settingService.getPasswordAttempt(),
      this.settingService.getMaxPasswordAttempt(),
    ]);

    if (passwordAttempt && user.passwordAttempt >= maxPasswordAttempt) {
      throw new ForbiddenException({
        statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_PASSWORD_ATTEMPT_MAX_ERROR,
        message: "user.error.passwordAttemptMax",
      });
    }

    const validate: boolean = await this.authService.validateUser(password, user.password);
    if (!validate) {
      try {
        await this.userService.increasePasswordAttempt(user);
      } catch (err: any) {
        throw new InternalServerErrorException({
          statusCode: ENUM_ERROR_STATUS_CODE_ERROR.ERROR_UNKNOWN,
          message: "http.serverError.internalServerError",
          _error: err.message,
        });
      }

      throw new BadRequestException({
        statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_PASSWORD_NOT_MATCH_ERROR,
        message: "user.error.passwordNotMatch",
      });
    }

    switch (true) {
      case user.blocked:
        throw new ForbiddenException({
          statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_BLOCKED_ERROR,
          message: "user.error.blocked",
        });
      case user.inactivePermanent:
        throw new ForbiddenException({
          statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_INACTIVE_PERMANENT_ERROR,
          message: "user.error.inactivePermanent",
        });
      case !user.isActive:
        throw new ForbiddenException({
          statusCode: ENUM_USER_STATUS_CODE_ERROR.USER_INACTIVE_ERROR,
          message: "user.error.inactive",
        });
    }

    const userWithRole: IUserDoc = await this.userService.joinWithRole(user);
    if (!userWithRole.role.isActive) {
      throw new ForbiddenException({
        statusCode: ENUM_ROLE_STATUS_CODE_ERROR.ROLE_INACTIVE_ERROR,
        message: "role.error.inactive",
      });
    }

    try {
      await this.userService.resetPasswordAttempt(user);
    } catch (err: any) {
      throw new InternalServerErrorException({
        statusCode: ENUM_ERROR_STATUS_CODE_ERROR.ERROR_UNKNOWN,
        message: "http.serverError.internalServerError",
        _error: err.message,
      });
    }

    const [payload, tokenType, expiresIn] = await Promise.all([
      this.userService.payloadSerialization(userWithRole),
      this.authService.getTokenType(),
      this.authService.getAccessTokenExpirationTime(),
    ]);

    const [payloadAccessToken, payloadRefreshToken, payloadEncryption] = await Promise.all([
      this.authService.createPayloadAccessToken(payload),
      this.authService.createPayloadRefreshToken(payload._id, {
        loginWith: ENUM_AUTH_LOGIN_WITH.LOCAL,
      }),
      this.authService.getPayloadEncryption(),
    ]);

    let payloadHashedAccessToken: Record<string, any> | string = payloadAccessToken;
    let payloadHashedRefreshToken: Record<string, any> | string = payloadRefreshToken;

    if (payloadEncryption) {
      payloadHashedAccessToken = await this.authService.encryptAccessToken(payloadAccessToken);
      payloadHashedRefreshToken = await this.authService.encryptRefreshToken(payloadRefreshToken);
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.authService.createAccessToken(payloadHashedAccessToken),
      this.authService.createRefreshToken(payloadHashedRefreshToken),
    ]);

    return {
      data: {
        tokenType,
        expiresIn,
        accessToken,
        refreshToken,
      },
    };
  }
}
