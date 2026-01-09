import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from './pagination.dto';

/**
 * 타임캡슐 리스트 아이템 DTO
 */
export class CapsuleListItemDto {
  @ApiProperty({
    description: '캡슐 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '캡슐 제목',
    example: '2024년 추억',
  })
  title: string;

  @ApiProperty({
    description: '캡슐 상태 (WAITING, COMPLETED, BURIED 등)',
    example: 'WAITING',
  })
  status: string;

  @ApiProperty({
    description: '캡슐 오픈일',
    example: '2025-12-31T00:00:00.000Z',
    nullable: true,
  })
  openDate: Date | null;

  @ApiProperty({
    description: '참여자 수',
    example: 3,
  })
  participantCount: number;

  @ApiProperty({
    description: '내 작성 상태 (true: 작성 완료, false: 미작성)',
    example: true,
  })
  myWriteStatus: boolean;

  @ApiProperty({
    description: '캡슐 생성일',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '제출 마감 시간',
    example: '2025-01-10T15:30:00.000Z',
    nullable: true,
  })
  deadline: Date | null;

  @ApiProperty({
    description: '작성 완료한 참여자 수',
    example: 2,
  })
  completedCount: number;

  @ApiProperty({
    description: '진행률 0-100 (status === "WAITING"일 때만 제공)',
    example: 66.67,
    nullable: true,
  })
  progressPercentage?: number | null;

  constructor(partial: Partial<CapsuleListItemDto>) {
    Object.assign(this, partial);
  }
}

/**
 * 타임캡슐 리스트 응답 DTO (페이지네이션)
 */
export class PaginatedCapsuleResponseDto extends PaginatedResponseDto<CapsuleListItemDto> {
  @ApiProperty({
    description: '캡슐 리스트',
    type: [CapsuleListItemDto],
  })
  declare items: CapsuleListItemDto[];

  constructor(
    items: CapsuleListItemDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    super(items, total, limit, offset);
  }
}
