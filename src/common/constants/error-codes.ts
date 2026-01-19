/**
 * 에러 코드 상수
 *
 * 일관된 에러 메시지 관리를 위한 Enum
 */

export enum ErrorCode {
  // 인증 관련
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_VERSION_MISMATCH = 'TOKEN_VERSION_MISMATCH',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // 회원가입/로그인
  DUPLICATE_PHONE_NUMBER = 'DUPLICATE_PHONE_NUMBER',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SNS_ACCOUNT_EXISTS = 'SNS_ACCOUNT_EXISTS',
  LOCAL_ACCOUNT_REQUIRED = 'LOCAL_ACCOUNT_REQUIRED',

  // 카카오 관련
  INVALID_CODE = 'INVALID_CODE',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  KAKAO_API_ERROR = 'KAKAO_API_ERROR',

  // 캡슐 관련
  CAPSULE_NOT_FOUND = 'CAPSULE_NOT_FOUND',
  CAPSULE_DELETED = 'CAPSULE_DELETED',
  CAPSULE_LOCKED = 'CAPSULE_LOCKED',
  CAPSULE_CONSUMED = 'CAPSULE_CONSUMED',
  INSUFFICIENT_SLOTS = 'INSUFFICIENT_SLOTS',
  LATITUDE_REQUIRED_FOR_EASTER_EGG = 'LATITUDE_REQUIRED_FOR_EASTER_EGG',
  LONGITUDE_REQUIRED_FOR_EASTER_EGG = 'LONGITUDE_REQUIRED_FOR_EASTER_EGG',
  LOCATION_TOO_FAR = 'LOCATION_TOO_FAR',
  NOT_FRIEND = 'NOT_FRIEND',

  // Step Room 관련
  INVITE_CODE_REQUIRED = 'INVITE_CODE_REQUIRED',
  INVITE_CODE_INVALID = 'INVITE_CODE_INVALID',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  NOT_ROOM_OWNER = 'NOT_ROOM_OWNER',
  ALREADY_JOINED = 'ALREADY_JOINED',
  SLOTS_FULL = 'SLOTS_FULL',
  ALREADY_SUBMITTED = 'ALREADY_SUBMITTED',
  INCOMPLETE_PARTICIPANTS = 'INCOMPLETE_PARTICIPANTS',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',

  // 미디어 관련
  FILE_REQUIRED = 'FILE_REQUIRED',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_MEDIA_TYPE = 'INVALID_MEDIA_TYPE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  MEDIA_NOT_FOUND = 'MEDIA_NOT_FOUND',
  IMAGE_LIMIT_EXCEEDED = 'IMAGE_LIMIT_EXCEEDED',

  // 주문/결제 관련
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ORDER_NOT_OWNED = 'ORDER_NOT_OWNED',
  INVALID_ORDER_STATUS = 'INVALID_ORDER_STATUS',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_AMOUNT_MISMATCH = 'PAYMENT_AMOUNT_MISMATCH',
  PAYMENT_ALREADY_APPROVED = 'PAYMENT_ALREADY_APPROVED',
  PAYMENT_ALREADY_CANCELED = 'PAYMENT_ALREADY_CANCELED',
  INVALID_PAYMENT_STATUS = 'INVALID_PAYMENT_STATUS',

  // 상품 관련
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PRODUCT_INACTIVE = 'PRODUCT_INACTIVE',
  PRODUCT_TYPE_MISMATCH = 'PRODUCT_TYPE_MISMATCH',
  INVALID_PRODUCT_OPTIONS = 'INVALID_PRODUCT_OPTIONS',
  PHOTO_COUNT_EXCEEDED = 'PHOTO_COUNT_EXCEEDED',
  MEDIA_COUNT_EXCEEDED = 'MEDIA_COUNT_EXCEEDED',

  // 친구 관련
  FRIEND_NOT_FOUND = 'FRIEND_NOT_FOUND',
  FRIENDSHIP_NOT_FOUND = 'FRIENDSHIP_NOT_FOUND',
  ALREADY_FRIENDS = 'ALREADY_FRIENDS',
  CANNOT_ADD_SELF = 'CANNOT_ADD_SELF',

  // 알림 관련
  NOTIFICATION_NOT_FOUND = 'NOTIFICATION_NOT_FOUND',

  // 일반
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * 에러 코드에 대한 사용자 친화적인 메시지 맵
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // 인증
  [ErrorCode.INVALID_TOKEN]: '유효하지 않은 토큰입니다.',
  [ErrorCode.TOKEN_EXPIRED]: '토큰이 만료되었습니다.',
  [ErrorCode.TOKEN_VERSION_MISMATCH]: '로그아웃된 토큰입니다.',
  [ErrorCode.UNAUTHORIZED]: '인증이 필요합니다.',
  [ErrorCode.FORBIDDEN]: '권한이 없습니다.',

  // 회원가입/로그인
  [ErrorCode.DUPLICATE_PHONE_NUMBER]: '이미 사용 중인 전화번호입니다.',
  [ErrorCode.DUPLICATE_EMAIL]: '이미 사용 중인 이메일입니다.',
  [ErrorCode.INVALID_CREDENTIALS]: '아이디 또는 비밀번호가 올바르지 않습니다.',
  [ErrorCode.USER_NOT_FOUND]: '사용자를 찾을 수 없습니다.',
  [ErrorCode.SNS_ACCOUNT_EXISTS]: 'SNS 계정으로 가입된 사용자입니다.',
  [ErrorCode.LOCAL_ACCOUNT_REQUIRED]: '로컬 계정만 로그인할 수 있습니다.',

  // 카카오
  [ErrorCode.INVALID_CODE]:
    '유효하지 않거나 이미 사용된 카카오 인가 코드입니다.',
  [ErrorCode.INSUFFICIENT_SCOPE]:
    '동의창에서 친구 목록 항목을 체크 해제했습니다.',
  [ErrorCode.KAKAO_API_ERROR]: '카카오 API 오류가 발생했습니다.',

  // 캡슐
  [ErrorCode.CAPSULE_NOT_FOUND]: '캡슐을 찾을 수 없습니다.',
  [ErrorCode.CAPSULE_DELETED]: '삭제된 캡슐입니다.',
  [ErrorCode.CAPSULE_LOCKED]: '아직 열람할 수 없는 캡슐입니다.',
  [ErrorCode.CAPSULE_CONSUMED]: '이미 소진된 캡슐입니다.',
  [ErrorCode.INSUFFICIENT_SLOTS]: '캡슐 슬롯이 부족합니다.',
  [ErrorCode.LATITUDE_REQUIRED_FOR_EASTER_EGG]:
    '이스터에그 생성 시 위도는 필수입니다.',
  [ErrorCode.LONGITUDE_REQUIRED_FOR_EASTER_EGG]:
    '이스터에그 생성 시 경도는 필수입니다.',
  [ErrorCode.LOCATION_TOO_FAR]: '위치가 너무 멉니다.',
  [ErrorCode.NOT_FRIEND]: '친구만 조회할 수 있습니다.',

  // Step Room
  [ErrorCode.INVITE_CODE_REQUIRED]: '초대 코드가 필요합니다.',
  [ErrorCode.INVITE_CODE_INVALID]: '유효하지 않은 초대 코드입니다.',
  [ErrorCode.ROOM_NOT_FOUND]: '대기실을 찾을 수 없습니다.',
  [ErrorCode.NOT_ROOM_OWNER]: '방장만 실행할 수 있습니다.',
  [ErrorCode.ALREADY_JOINED]: '이미 참여 중입니다.',
  [ErrorCode.SLOTS_FULL]: '정원이 초과되었습니다.',
  [ErrorCode.ALREADY_SUBMITTED]: '이미 제출된 캡슐입니다.',
  [ErrorCode.INCOMPLETE_PARTICIPANTS]:
    '모든 참여자가 저장을 완료해야 제출할 수 있습니다.',
  [ErrorCode.UNAUTHORIZED_ACCESS]: '이 캡슐에 접근할 권한이 없습니다.',

  // 미디어
  [ErrorCode.FILE_REQUIRED]: '파일이 필요합니다.',
  [ErrorCode.INVALID_FILE_TYPE]: '유효하지 않은 파일 형식입니다.',
  [ErrorCode.FILE_TOO_LARGE]: '파일 크기가 너무 큽니다.',
  [ErrorCode.INVALID_MEDIA_TYPE]: '유효하지 않은 미디어 타입입니다.',
  [ErrorCode.UNSUPPORTED_FILE_TYPE]: '지원하지 않는 파일 형식입니다.',
  [ErrorCode.MEDIA_NOT_FOUND]: '미디어를 찾을 수 없습니다.',
  [ErrorCode.IMAGE_LIMIT_EXCEEDED]: '이미지 개수 제한을 초과했습니다.',

  // 주문/결제
  [ErrorCode.ORDER_NOT_FOUND]: '주문을 찾을 수 없습니다.',
  [ErrorCode.ORDER_NOT_OWNED]: '주문 소유권이 없습니다.',
  [ErrorCode.INVALID_ORDER_STATUS]: '유효하지 않은 주문 상태입니다.',
  [ErrorCode.PAYMENT_NOT_FOUND]: '결제 정보를 찾을 수 없습니다.',
  [ErrorCode.PAYMENT_AMOUNT_MISMATCH]: '결제 금액이 일치하지 않습니다.',
  [ErrorCode.PAYMENT_ALREADY_APPROVED]: '이미 승인된 결제입니다.',
  [ErrorCode.PAYMENT_ALREADY_CANCELED]: '이미 취소된 결제입니다.',
  [ErrorCode.INVALID_PAYMENT_STATUS]: '유효하지 않은 결제 상태입니다.',

  // 상품
  [ErrorCode.PRODUCT_NOT_FOUND]: '상품을 찾을 수 없습니다.',
  [ErrorCode.PRODUCT_INACTIVE]: '비활성 상품입니다.',
  [ErrorCode.PRODUCT_TYPE_MISMATCH]: '상품 타입이 일치하지 않습니다.',
  [ErrorCode.INVALID_PRODUCT_OPTIONS]: '유효하지 않은 상품 옵션입니다.',
  [ErrorCode.PHOTO_COUNT_EXCEEDED]: '사진 개수 제한을 초과했습니다.',
  [ErrorCode.MEDIA_COUNT_EXCEEDED]: '미디어 개수 제한을 초과했습니다.',

  // 친구
  [ErrorCode.FRIEND_NOT_FOUND]: '친구를 찾을 수 없습니다.',
  [ErrorCode.FRIENDSHIP_NOT_FOUND]: '친구 관계를 찾을 수 없습니다.',
  [ErrorCode.ALREADY_FRIENDS]: '이미 친구 관계입니다.',
  [ErrorCode.CANNOT_ADD_SELF]: '자기 자신을 친구로 추가할 수 없습니다.',

  // 알림
  [ErrorCode.NOTIFICATION_NOT_FOUND]: '알림을 찾을 수 없습니다.',

  // 일반
  [ErrorCode.BAD_REQUEST]: '잘못된 요청입니다.',
  [ErrorCode.NOT_FOUND]: '리소스를 찾을 수 없습니다.',
  [ErrorCode.CONFLICT]: '충돌이 발생했습니다.',
  [ErrorCode.INTERNAL_SERVER_ERROR]: '서버 오류가 발생했습니다.',
  [ErrorCode.VALIDATION_ERROR]: '유효성 검증에 실패했습니다.',
};
