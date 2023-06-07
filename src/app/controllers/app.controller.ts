import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Controller({
  version: VERSION_NEUTRAL,
  path: "/",
})
export class AppController {
  private readonly serviceName: string;

  constructor(
    private readonly configService: ConfigService, // private readonly helperDateService: HelperDateService,
  ) {
    this.serviceName = this.configService.get<string>("app.name");
  }
  @Get("/hello")
  getHello(): string {
    return this.serviceName;
  }
}
