/**
 * 유효성 검증 관련 상수
 */

// 비밀번호
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 100;

// 닉네임
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 20;

// 제목/내용
export const MAX_CAPSULE_TITLE_LENGTH = 100;
export const MAX_CAPSULE_CONTENT_LENGTH = 500;
export const MAX_TEXT_BLOCK_CONTENT_LENGTH = 500;

// 위치
export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

// 주문
export const MIN_HEADCOUNT = 1;
export const MAX_HEADCOUNT = 10;
export const MIN_PHOTO_COUNT = 0;
export const MAX_PHOTO_COUNT = 5;

// 캡슐
export const DEFAULT_EGG_SLOTS = 3;
export const MAX_MEDIA_COUNT_PER_CAPSULE = 10;
