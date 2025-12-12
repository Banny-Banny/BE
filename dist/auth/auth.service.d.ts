import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../entities';
export interface KakaoUserInfo {
    kakaoId: string;
    nickname: string;
    email?: string;
    profileImg?: string;
}
export interface JwtPayload {
    sub: string;
    nickname: string;
}
export interface TokenResponse {
    accessToken: string;
    user: {
        id: string;
        nickname: string;
        email: string | null;
        profileImg: string | null;
        isNewUser: boolean;
    };
}
export declare class AuthService {
    private readonly userRepository;
    private readonly jwtService;
    constructor(userRepository: Repository<User>, jwtService: JwtService);
    kakaoLogin(kakaoUserInfo: KakaoUserInfo): Promise<TokenResponse>;
    generateToken(user: User): string;
    findById(id: string): Promise<User | null>;
    validateToken(payload: JwtPayload): Promise<User | null>;
}
