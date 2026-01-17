# Tasks: 캡슐 스키마 분리 및 유저 name 컬럼

1. 신규 엔티티(`TimeCapsule`, `EasterEgg`) 및 enum(`CapsuleType`) 추가
2. 마이그레이션 작성: 테이블 생성/데이터 이관/기존 컬럼 제거/`users.name` 추가
3. 캡슐/대기실/주문 관련 서비스 로직을 타입별 테이블로 리팩터링
4. DTO/쿼리 수정 및 기존 API 응답 유지 검증
5. 린트 및 주요 시나리오 smoke 테스트 정리
