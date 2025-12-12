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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../entities");
let AuthService = class AuthService {
    userRepository;
    jwtService;
    constructor(userRepository, jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }
    async kakaoLogin(kakaoUserInfo) {
        let user = await this.userRepository.findOne({
            where: { kakaoId: kakaoUserInfo.kakaoId },
        });
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = this.userRepository.create({
                kakaoId: kakaoUserInfo.kakaoId,
                nickname: kakaoUserInfo.nickname,
                email: kakaoUserInfo.email,
                profileImg: kakaoUserInfo.profileImg,
                phoneNumber: `kakao_${kakaoUserInfo.kakaoId}`,
            });
            await this.userRepository.save(user);
        }
        else {
            user.nickname = kakaoUserInfo.nickname;
            if (kakaoUserInfo.email)
                user.email = kakaoUserInfo.email;
            if (kakaoUserInfo.profileImg)
                user.profileImg = kakaoUserInfo.profileImg;
            await this.userRepository.save(user);
        }
        const accessToken = this.generateToken(user);
        return {
            accessToken,
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email,
                profileImg: user.profileImg,
                isNewUser,
            },
        };
    }
    generateToken(user) {
        const payload = {
            sub: user.id,
            nickname: user.nickname,
        };
        return this.jwtService.sign(payload);
    }
    async findById(id) {
        return this.userRepository.findOne({
            where: { id, isActive: true },
        });
    }
    async validateToken(payload) {
        return this.findById(payload.sub);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map