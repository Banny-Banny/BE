import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TokenResponse } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../entities';

interface KakaoRequest extends Request {
  user: TokenResponse;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  /**
   * 카카오 로그인 시작
   * GET /auth/kakao
   */
  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  @ApiOperation({
    summary: '카카오 로그인',
    description: '카카오 OAuth 로그인 페이지로 리다이렉트합니다.',
  })
  @ApiResponse({
    status: 302,
    description: '카카오 로그인 페이지로 리다이렉트',
  })
  kakaoLogin(): void {
    // 카카오 로그인 페이지로 리다이렉트
    // Passport가 자동으로 처리
  }

  /**
   * 카카오 로그인 콜백
   * GET /auth/kakao/callback
   */
  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  @ApiExcludeEndpoint() // Swagger에서 숨김 (OAuth 콜백용)
  kakaoCallback(@Req() req: KakaoRequest, @Res() res: Response) {
    const { accessToken, user } = req.user;

    // 프론트엔드로 리다이렉트 (토큰 포함)
    // 실제 환경에서는 프론트엔드 URL로 변경 필요
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${accessToken}&isNewUser=${user.isNewUser}`;

    return res.redirect(HttpStatus.FOUND, redirectUrl);
  }

  /**
   * 현재 로그인된 유저 정보 조회
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 정보 조회',
    description: '현재 로그인된 사용자의 정보를 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '유저 정보 조회 성공',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        nickname: { type: 'string', example: '홍길동' },
        email: { type: 'string', example: 'user@example.com' },
        profileImg: { type: 'string', example: 'https://...' },
        phoneNumber: { type: 'string', example: '010-1234-5678' },
        isMarketingAgreed: { type: 'boolean' },
        isPushAgreed: { type: 'boolean' },
        isLocationTermAgreed: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      profileImg: user.profileImg,
      phoneNumber: user.phoneNumber,
      isMarketingAgreed: user.isMarketingAgreed,
      isPushAgreed: user.isPushAgreed,
      isLocationTermAgreed: user.isLocationTermAgreed,
      createdAt: user.createdAt,
    };
  }

  /**
   * 로그인 상태 확인 (토큰 유효성 검증)
   * GET /auth/verify
   */
  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '토큰 유효성 검증',
    description: 'JWT 토큰이 유효한지 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 유효',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        userId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '토큰 무효 또는 만료' })
  verifyToken(@CurrentUser() user: User) {
    return {
      valid: true,
      userId: user.id,
    };
  }
}
