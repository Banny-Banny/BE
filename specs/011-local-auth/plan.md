# Implementation Plan: 자체 로컬 인증 (로그인/회원가입/로그아웃)

**Branch**: `011-local-auth` | **Date**: 2025-12-28 | **Spec**: `specs/011-local-auth/spec.md`  
**Input**: 기존 카카오 중심 Auth에 로컬 회원가입/로그인/로그아웃을 추가하여 `users` 테이블에 `password_hash` 등 로컬 필드를 신설하고, JWT 기반 session invalidation까지 확보

## Summary
- `POST /auth/local/signup`: phone_number 기준 중복 체크 후 bcrypt 해시 저장, `provider='LOCAL'`로 새로운 `users` 행 삽입 및 바로 JWT access token 반환.
- `POST /auth/local/login`: `phoneNumber` 또는 `email` + 비밀번호 조합 검증, `is_active`/`provider`/token_version 기준으로 reject, 성공 시 JWT 반환.
- `POST /auth/logout`: 토큰 블랙리스트 또는 `last_logout_at/token_version` 갱신으로 이후 same token 사용 금지, JwtAuthGuard 에서 무효화 체크.
- Db 마이그레이션/엔티티 업데이트, service 로직 확장, Swagger 문서 등록, 테스트/예외 처리 강화.

## Technical Context
- NestJS + TypeORM + PostgreSQL + JWT (현재 `auth` 모듈에서 Kakao OAuth 기반).
- `users` 엔티티에는 `phone_number` 유니크, `provider`, `is_active`, `egg_slots` 등 필드 존재. 새 `password_hash`, optional `last_logout_at/token_version` 컬럼이 필요.
- JwtAuthGuard/CurrentUser decorator 이미 존재, logout 검증을 위해 guard에 블랙리스트 또는 token_version 체크 로직 추가 가능.
- token invalidation 자료구조: Redis set 또는 테이블(`blacklisted_tokens`) 사용 예정. 우선 simple table + TTL/expiry.

## Plan / Steps
1. **데이터 모델 마이그레이션**
   - `password_hash` 칼럼(varchar 255, nullable true for existing kakao users)과 `token_version`(int default 0) 또는 `last_logout_at` datetime 컬럼을 `users` 테이블에 추가.  
   - (Optional) `local_auth_tokens` 혹은 `token_blacklist` 테이블을 만들어 `token`, `expires_at`, `user_id` 를 저장하거나 Redis TTL 키로 대체.
2. **엔티티/DTO/Validation**
   - `User` 엔티티에 새 필드 선언, `nullable`/`default` 고려.  
   - `AuthModule`에 `bcrypt` 등 해시 유틸 추가.  
   - DTO: `LocalSignupRequestDto`, `LocalLoginRequestDto`, `LogoutRequestDto` with class-validator rules (phone/email format, password length ≥8).
3. **서비스 로직**
   - `AuthService`에 `signupLocal(payload)`, `loginLocal(payload)`, `logout(token)` 메서드 추가/조정.  
   - signup: phone/email 중복 체크, bcrypt.hash, user 생성, `generateToken`.  
   - login: `userRepository.findOne({ where: [{ phoneNumber }, { email }] })` + bcrypt.compare + `isActive` 확인 + token_version mismatch.  
   - logout: `tokenVersion++` (또는 블랙리스트 엔트리) + optional `lastLogoutAt = now`.
   - JwtAuthGuard 검증 시 payload 내 tokenVersion(Content). `generateToken`에 `tokenVersion` 포함, guard에서 현재 user.tokenVersion와 비교.
4. **컨트롤러/라우팅**
   - `AuthController`에 `/auth/local/signup`, `/auth/local/login`, `/auth/logout` POST 엔드포인트 추가.  
   - Swagger 데코레이터로 요청/응답 정의(201/200/401/403/409).  
   - Logout은 JwtAuthGuard 보호, body optional (token in header).  
5. **토큰 설정**
   - JWT payload에 `tokenVersion` 및 `provider` info 포함.  
   - JwtAuthGuard 또는 custom decorator에서 payload 검증 후 `tokenVersion` mismatch 또는 blacklisted token detection.
6. **테스트/문서**
   - 유닛 테스트: signup 중복, login 실패/성공, logout 후 guard fail.  
   - (Optional) e2e 테스트 or spec coverage: POST endpoints behave as expected.  
   - Swagger `auth` 태그에 새로운 엔드포인트 및 오류 코드 등록.

## Scope / Out of Scope
- 포함: 로컬 비밀번호 필드 저장/검증, `users` DB 수정, 로그인/회원가입/로그아웃 API/문서/테스트.  
- 제외: 비밀번호 초기화/재설정(미구현), 로컬 계정과 SNS 통합 자동 병합, MFA(다단계 인증).

## Risks / Checks
- `phone_number` 중복: 기존 카카오 유저와 중복 시 false error => provider/is_active 기준으로 거절 또는 existing LOCAL account 우선 처리.  
- 비밀번호 해시 저장 실패: `bcrypt` 에러 핸들링 및 민감 정보 무노출 logging.  
- token_version/blacklist 동기화 누락: guard에 tokenVersion 체크 누락 시 logout ineffective → unit test로 검증.  
- 추가 칼럼 마이그레이션으로 기존 빌드/마이그레이션 스크립트 영향 → migrations 폴더 및 `schema.sql` 업데이트.  

