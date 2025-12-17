import { IsString, IsUUID } from 'class-validator';

export class KakaoApproveDto {
  @IsUUID()
  order_id: string;

  @IsString()
  pg_token: string;
}
