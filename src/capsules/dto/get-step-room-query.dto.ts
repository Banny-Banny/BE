import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * 초대 코드로 대기실 조회 쿼리 파라미터 DTO
 * GET /api/capsules/step-rooms?invite_code={code}
 */
export class GetStepRoomByInviteCodeQueryDto {
  @ApiProperty({
    description: '초대 코드 (6자리 영숫자)',
    example: 'R2Q6VZ',
    minLength: 6,
    maxLength: 6,
    required: true,
  })
  @IsString({ message: '초대 코드는 문자열이어야 합니다' })
  @IsNotEmpty({ message: '초대 코드는 필수입니다' })
  @Length(6, 6, { message: '초대 코드는 6자리여야 합니다' })
  invite_code: string;
}
