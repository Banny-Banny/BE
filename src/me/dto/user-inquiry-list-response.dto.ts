import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from './pagination.dto';
import { UserInquiryListItemDto } from './user-inquiry-list-item.dto';

export class PaginatedUserInquiryResponseDto extends PaginatedResponseDto<UserInquiryListItemDto> {
  @ApiProperty({
    description: '문의(채팅방) 리스트',
    type: [UserInquiryListItemDto],
  })
  declare items: UserInquiryListItemDto[];

  constructor(
    items: UserInquiryListItemDto[],
    total: number,
    limit: number,
    offset: number,
  ) {
    super(items, total, limit, offset);
  }
}
