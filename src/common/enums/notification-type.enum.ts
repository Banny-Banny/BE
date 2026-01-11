/**
 * 알림 타입 Enum
 * 사용자에게 발송되는 알림의 종류를 정의
 */
export enum NotificationType {
  /** 타임캡슐 오픈 알림 */
  CAPSULE_OPEN = 'CAPSULE_OPEN',

  /** 친구 추가 알림 (요청/수락 통합) */
  FRIEND_ADD = 'FRIEND_ADD',

  /** 친구 요청 알림 (레거시, FRIEND_ADD로 통합 예정) */
  FRIEND_REQUEST = 'FRIEND_REQUEST',

  /** 친구 요청 수락 알림 */
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',

  /** 에그 발견 알림 */
  EGG_DISCOVERED = 'EGG_DISCOVERED',

  /** 이스터에그 발견 알림 (프론트엔드 용) */
  EASTER_EGG_VIEWED = 'EASTER_EGG_VIEWED',

  /** 에그 소멸 알림 */
  EGG_DELETED = 'EGG_DELETED',

  /** 시스템 공지 */
  SYSTEM = 'SYSTEM',

  /** 마케팅 알림 */
  MARKETING = 'MARKETING',
}
