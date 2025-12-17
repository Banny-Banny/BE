import { IsUUID } from 'class-validator';

export class KakaoReadyDto {
  @IsUUID()
  order_id: string;
}

