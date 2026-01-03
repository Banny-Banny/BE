import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class SubmitCapsuleDto {
  @ApiProperty({
    description: '위도 (방장의 현재 위치)',
    example: 37.5665,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: '경도 (방장의 현재 위치)',
    example: 126.978,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;
}
