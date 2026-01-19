// ===========================================
// Enum 정의 (데이터 정합성 보장)
// ===========================================

/**
 * 미디어 타입 - 캡슐에 포함된 콘텐츠 유형
 */
export enum MediaType {
  TEXT = 'TEXT', // 텍스트만 포함된 캡슐
  IMAGE = 'IMAGE', // 사진이 포함된 캡슐
  VIDEO = 'VIDEO', // 영상이 포함된 캡슐
  AUDIO = 'AUDIO', // 음악/오디오가 포함된 캡슐
  MUSIC = 'MUSIC', // (deprecated) 과거 호환용
}

/**
 * 주문 상태 - 결제 프로세스 상태
 */
export enum OrderStatus {
  PENDING = 'PENDING', // 결제 시도 중
  PENDING_PAYMENT = 'PENDING_PAYMENT', // 주문 생성 완료, 결제 대기
  PAID = 'PAID', // 결제 완료
  CANCELED = 'CANCELED', // 사용자 취소
  FAILED = 'FAILED', // 결제 실패 (잔액 부족 등)
}

export enum TimeOption {
  ONE_WEEK = '1_WEEK',
  ONE_MONTH = '1_MONTH',
  ONE_YEAR = '1_YEAR',
  TWO_YEAR = '2_YEAR',
  THREE_YEAR = '3_YEAR',
  CUSTOM = 'CUSTOM',
}

/**
 * 결제 상태 - PG사 결제 상태
 */
export enum PaymentStatus {
  READY = 'READY', // PG사 결제 요청
  PAID = 'PAID', // PG사 승인 완료
  CANCELED = 'CANCELED', // 환불 완료
  FAILED = 'FAILED', // 승인 거절
}

/**
 * 친구 관계 상태
 */
export enum FriendStatus {
  PENDING = 'PENDING', // 친구 요청 보냄
  CONNECTED = 'CONNECTED', // 친구 수락됨 (맞팔)
  BLOCKED = 'BLOCKED', // 차단함
}

/**
 * 대기실 상태 - 결제 완료 후 작성 대기 중인 캡슐
 */
export enum RoomStatus {
  WAITING = 'WAITING', // 작성 대기 중
  COMPLETED = 'COMPLETED', // 모든 참여자 작성 완료
  EXPIRED = 'EXPIRED', // 마감시한 경과
  BURIED = 'BURIED', // 매장 완료
}

/**
 * 캡슐 타입 - 공통 캡슐에서 타입 분리 용도
 */
export enum CapsuleType {
  TIME_CAPSULE = 'TIME_CAPSULE',
  EASTER_EGG = 'EASTER_EGG',
}

/**
 * 알림 타입 - 사용자에게 발송되는 알림 종류
 */
export enum NotificationType {
  CAPSULE_OPEN = 'CAPSULE_OPEN', // 타임캡슐 오픈 알림
  FRIEND_ADD = 'FRIEND_ADD', // 친구 추가 알림 (요청/수락 통합)
  FRIEND_REQUEST = 'FRIEND_REQUEST', // 친구 요청 알림 (레거시, FRIEND_ADD로 통합 예정)
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED', // 친구 요청 수락 알림
  EGG_DISCOVERED = 'EGG_DISCOVERED', // 에그 발견 알림
  EASTER_EGG_VIEWED = 'EASTER_EGG_VIEWED', // 이스터에그 발견 알림 (프론트엔드 용)
  EGG_DELETED = 'EGG_DELETED', // 에그 소멸 알림
  SYSTEM = 'SYSTEM', // 시스템 공지
  MARKETING = 'MARKETING', // 마케팅 알림
}

/**
 * 관리자 역할
 */
export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
}

/**
 * 1:1 문의 상태
 */
export enum InquiryStatus {
  PENDING = 'PENDING', // 답변 대기
  IN_PROGRESS = 'IN_PROGRESS', // 진행 중
  ON_HOLD = 'ON_HOLD', // 보류
  COMPLETED = 'COMPLETED', // 답변 완료
}

/**
 * 1:1 문의 메시지 발신자 타입
 */
export enum InquirySenderType {
  USER = 'USER',
  ADMIN = 'ADMIN',
}
