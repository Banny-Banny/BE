import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../entities';

interface RequestWithUser extends Request {
  user: User;
}

/**
 * 현재 로그인된 유저 정보를 가져오는 커스텀 데코레이터
 *
 * @example
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // data가 지정되면 해당 필드만 반환
    if (data) {
      return user?.[data];
    }

    return user;
  },
);
