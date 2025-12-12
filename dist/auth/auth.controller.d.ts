import type { Response } from 'express';
import { TokenResponse } from './auth.service';
import { User } from '../entities';
interface KakaoRequest extends Request {
    user: TokenResponse;
}
export declare class AuthController {
    kakaoLogin(): void;
    kakaoCallback(req: KakaoRequest, res: Response): void;
    getMe(user: User): {
        id: string;
        nickname: string;
        email: string;
        profileImg: string;
        phoneNumber: string;
        isMarketingAgreed: boolean;
        isPushAgreed: boolean;
        isLocationTermAgreed: boolean;
        createdAt: Date;
    };
    verifyToken(user: User): {
        valid: boolean;
        userId: string;
    };
}
export {};
