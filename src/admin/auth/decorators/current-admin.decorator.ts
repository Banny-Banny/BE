import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminUser } from '../../../entities';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AdminUser }>();
    return request.user ?? null;
  },
);
