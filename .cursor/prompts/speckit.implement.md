---
description: 태스크 목록을 순서대로 실행하여 기능을 구현합니다.
---

## 구현 실행 (speckit.implement)

tasks.md의 태스크들을 순서대로 실행합니다.

### 입력
```text
$ARGUMENTS
```

### 실행 단계

1. **체크리스트 확인** (있는 경우):
   - 모든 체크리스트 완료 여부 확인
   - 미완료 시 사용자 확인 요청

2. **컨텍스트 로드**:
   - `tasks.md`: 태스크 목록
   - `plan.md`: 기술 스택, 구조
   - `data-model.md`: 엔티티
   - `contracts/`: API 스펙

3. **프로젝트 설정 검증**:
   - `.gitignore` 확인/생성
   - 기술 스택별 ignore 파일 설정

4. **Phase별 실행**:
   - Setup → Foundational → User Stories → Polish
   - 순차 태스크: 순서대로 실행
   - 병렬 태스크 [P]: 동시 실행 가능

5. **진행 추적**:
   - 완료된 태스크는 `[X]`로 표시
   - 실패 시 명확한 에러 메시지
   - 각 Phase 완료 후 검증

### 구현 규칙

- **NestJS 컨벤션** 준수
- **TypeScript 타입** 명시
- **린트 에러 0개** 유지
- **빌드 성공** 필수

### 완료 검증

- 모든 태스크 완료 확인
- 명세와 구현 일치 확인
- 테스트 통과 확인
- `npm run build` 성공

