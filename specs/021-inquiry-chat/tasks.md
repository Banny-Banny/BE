# Tasks: 1:1 문의 (Inquiry - Chat)

1. 데이터 모델 확장
   - `customer_services` 컬럼 추가 및 메시지 테이블 마이그레이션 생성
   - `InquiryStatus`, `InquirySenderType` enum 정의

2. 관리자 HTTP API 구현
   - 리스트/상세/상태 변경/삭제/메시지 수정 엔드포인트
   - DTO 및 Swagger 문서화

3. WebSocket 게이트웨이 구현
   - `/admin-chat`, `/user-chat` 인증 연결
   - `join_room`, `send_message`, `receive_message`, `read_alert` 이벤트 처리

4. 모듈 통합
   - `AdminModule`에 컨트롤러/서비스/게이트웨이 등록
   - DB 엔티티/마이그레이션 연결

5. 품질 확인
   - 변경 파일 린트 확인
