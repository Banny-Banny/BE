import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MyEggsType {
  PLANTED = 'PLANTED',
  FOUND = 'FOUND',
}

export enum MyEggsSortOrder {
  LATEST = 'LATEST',
  OLDEST = 'OLDEST',
}

export class GetMyEggsQueryDto {
  @ApiProperty({
    enum: MyEggsType,
    description: '조회 타입 (PLANTED: 심은 알, FOUND: 발견한 알)',
    example: 'PLANTED',
  })
  @IsEnum(MyEggsType)
  type: MyEggsType;

  @ApiProperty({
    enum: MyEggsSortOrder,
    required: false,
    description:
      '정렬 순서 (LATEST: 최신순, OLDEST: 오래된순) - type=FOUND일 때만 사용',
    example: 'LATEST',
  })
  @IsOptional()
  @IsEnum(MyEggsSortOrder)
  sort?: MyEggsSortOrder;
}
