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
  MUSIC = 'MUSIC', // 음악이 포함된 캡슐
}

/**
 * 주문 상태 - 결제 프로세스 상태
 */
export enum OrderStatus {
  PENDING = 'PENDING', // 결제 시도 중
  PAID = 'PAID', // 결제 완료
  CANCELED = 'CANCELED', // 사용자 취소
  FAILED = 'FAILED', // 결제 실패 (잔액 부족 등)
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
