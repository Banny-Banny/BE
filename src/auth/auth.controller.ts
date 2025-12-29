import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, TokenResponse } from './auth.service';
import { LocalLoginRequestDto } from './dto/local-login.request.dto';
import { LocalSignupRequestDto } from './dto/local-signup.request.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../entities';

interface KakaoRequest extends Request {
  user: TokenResponse;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}
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
  kakaoLogin(@Req() request: Request): void {
    this.logger.log('=== Request Headers ===');
    this.logger.log(`Origin: ${request.headers.origin}`);
    this.logger.log(`Referer: ${request.headers.referer}`);
    this.logger.log(`User-Agent: ${request.headers['user-agent']}`);
    this.logger.log('======================');

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

    // 클라이언트 콜백 URL (웹/앱 딥링크 모두 지원)
    // - AUTH_CALLBACK_REDIRECT_URL: 앱 딥링크 (예: timeegg://auth/callback)
    // - FRONTEND_URL: 웹 도메인 (예: https://example.com), 기본 경로는 /auth/callback
    const fallbackBase = process.env.FRONTEND_URL || 'http://localhost:8081';
    const fallbackPath =
      process.env.FRONTEND_CALLBACK_PATH || '/api/auth/kakao/callback';
    const webCallback = `${fallbackBase.replace(/\/$/, '')}${fallbackPath}`;
    const mobileCallback =
      process.env.AUTH_CALLBACK_REDIRECT_URL ||
      'timeegg://auth/callback?token=${accessToken}&isNewUser=${user.isNewUser}';

    const userAgentHeader = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(' ')
      : userAgentHeader || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

    const clientCallback =
      isMobile && mobileCallback ? mobileCallback : webCallback;

    const queryParams = new URLSearchParams({
      token: accessToken,
      isNewUser: String(user.isNewUser),
    });

    let redirectUrl = clientCallback;
    try {
      const url = new URL(clientCallback);
      queryParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      redirectUrl = url.toString();
    } catch {
      const separator = clientCallback.includes('?') ? '&' : '?';
      redirectUrl = `${clientCallback}${separator}${queryParams.toString()}`;
    }

    return res.redirect(HttpStatus.FOUND, redirectUrl);
  }

  @Post('local/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '자체 회원가입',
    description:
      '휴대폰 번호/닉네임/비밀번호로 로컬 계정을 생성하고 토큰을 발급합니다.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '회원가입 성공',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '중복된 전화번호 또는 이메일',
  })
  signupLocal(@Body() payload: LocalSignupRequestDto): Promise<TokenResponse> {
    return this.authService.signupLocal(payload);
  }

  @Post('local/login')
  @ApiOperation({
    summary: '자체 로그인',
    description: '전화번호 또는 이메일 + 비밀번호로 인증하고 JWT를 받습니다.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '로그인 성공',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '인증 실패한 경우',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '활성화되지 않은 계정 또는 SNS 계정으로 시도한 경우',
  })
  loginLocal(@Body() payload: LocalLoginRequestDto): Promise<TokenResponse> {
    return this.authService.loginLocal(payload);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 토큰을 무효화하여 재사용을 막습니다.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '로그아웃 성공',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '유효하지 않은 토큰',
  })
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user);
    return { success: true };
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
