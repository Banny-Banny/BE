import { IsUUID } from 'class-validator';

export class GetOrderParamDto {
  @IsUUID()
  id: string;
}

