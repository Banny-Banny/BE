/**
 * 알림 타입 Enum
 * 사용자에게 발송되는 알림의 종류를 정의
 */
export enum NotificationType {
  /** 타임캡슐 오픈 알림 */
  CAPSULE_OPEN = 'CAPSULE_OPEN',

  /** 친구 요청 알림 */
  FRIEND_REQUEST = 'FRIEND_REQUEST',

  /** 친구 수락 알림 */
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',

  /** 시스템 공지 */
  SYSTEM = 'SYSTEM',

  /** 마케팅 알림 */
  MARKETING = 'MARKETING',
}

