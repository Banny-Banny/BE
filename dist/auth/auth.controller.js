"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const current_user_decorator_1 = require("./decorators/current-user.decorator");
const entities_1 = require("../entities");
let AuthController = class AuthController {
    kakaoLogin() {
    }
    kakaoCallback(req, res) {
        const { accessToken, user } = req.user;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const redirectUrl = `${frontendUrl}/auth/callback?token=${accessToken}&isNewUser=${user.isNewUser}`;
        return res.redirect(common_1.HttpStatus.FOUND, redirectUrl);
    }
    getMe(user) {
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
    verifyToken(user) {
        return {
            valid: true,
            userId: user.id,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('kakao'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('kakao')),
    (0, swagger_1.ApiOperation)({
        summary: '카카오 로그인',
        description: '카카오 OAuth 로그인 페이지로 리다이렉트합니다.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 302,
        description: '카카오 로그인 페이지로 리다이렉트',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "kakaoLogin", null);
__decorate([
    (0, common_1.Get)('kakao/callback'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('kakao')),
    (0, swagger_1.ApiExcludeEndpoint)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "kakaoCallback", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiOperation)({
        summary: '내 정보 조회',
        description: '현재 로그인된 사용자의 정보를 반환합니다.',
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [entities_1.User]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, common_1.Get)('verify'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiOperation)({
        summary: '토큰 유효성 검증',
        description: 'JWT 토큰이 유효한지 확인합니다.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '토큰 유효',
        schema: {
            type: 'object',
            properties: {
                valid: { type: 'boolean', example: true },
                userId: { type: 'string', format: 'uuid' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '토큰 무효 또는 만료' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [entities_1.User]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyToken", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth')
], AuthController);
//# sourceMappingURL=auth.controller.js.map