import { ApiProperty } from "@nestjs/swagger";
import { ENUM_POLICY_SUBJECT } from "src/common/policy/constants/policy.enum.constant";

export class UserPayloadPermissionSerialization {
  @ApiProperty({
    required: true,
    nullable: false,
    enum: ENUM_POLICY_SUBJECT,
    example: ENUM_POLICY_SUBJECT.API_KEY,
  })
  subject: ENUM_POLICY_SUBJECT;

  @ApiProperty({
    required: true,
    nullable: false,
  })
  action: string;
}
