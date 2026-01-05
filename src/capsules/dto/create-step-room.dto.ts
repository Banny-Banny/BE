import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * 타임캡슐(대기실) 생성 요청 DTO
 */
export class CreateStepRoomDto {
  @ApiProperty({
    description: '결제 완료된 주문 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: '주문 ID는 필수입니다' })
  @IsUUID('4', { message: '올바른 UUID 형식이어야 합니다' })
  order_id: string;
}

