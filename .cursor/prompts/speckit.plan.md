---
description: 기능 명세를 기반으로 구현 계획을 수립합니다.
---

## 구현 계획 수립 (speckit.plan)

기능 명세(spec.md)를 분석하여 기술적 구현 계획을 작성합니다.

### 입력
```text
$ARGUMENTS
```

### 실행 단계

1. **컨텍스트 로드**:
   - `specs/*/spec.md` 읽기
   - `memory/constitution.md` 읽기
   - 기술 스택 확인 (NestJS, TypeORM, PostgreSQL)

2. **Phase 0 - 리서치**:
   - 불명확한 기술적 결정사항 조사
   - 의존성 및 베스트 프랙티스 확인
   - `research.md` 작성

3. **Phase 1 - 설계**:
   - `data-model.md`: 엔티티, 필드, 관계 정의
   - `contracts/api-spec.json`: OpenAPI 스펙
   - `quickstart.md`: 빠른 시작 가이드

4. **Constitution 체크**:
   - 모듈 기반 아키텍처 준수
   - 타입 안전성 확보
   - 보안 요구사항 반영

### 결과물
- `specs/XXX-feature-name/plan.md`
- `specs/XXX-feature-name/research.md`
- `specs/XXX-feature-name/data-model.md`
- `specs/XXX-feature-name/contracts/`

