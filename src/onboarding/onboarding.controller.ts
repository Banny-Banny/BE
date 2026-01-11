import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto, OnboardingResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities';

/**
 * 온보딩 관련 API 엔드포인트
 */
@ApiTags('온보딩')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * 온보딩 완료 처리
   * - 친구 동의 및 위치 동의 정보 저장
   * - 온보딩 완료 시점 기록
   */
  @Post('complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '온보딩 완료',
    description:
      '온보딩 플로우 마지막 단계에서 친구 동의 및 위치 동의 상태를 서버로 전송합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '온보딩 완료 성공',
    type: OnboardingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (필수 필드 누락 등)',
  })
  @ApiResponse({
    status: 401,
    description: '인증 실패 (유효하지 않은 토큰)',
  })
  @ApiResponse({
    status: 500,
    description: '서버 내부 오류',
  })
  async completeOnboarding(
    @CurrentUser() user: User,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<OnboardingResponseDto> {
    return await this.onboardingService.completeOnboarding(user.id, dto);
  }
}
