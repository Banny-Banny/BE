---
description: 구현 계획을 실행 가능한 태스크로 분해합니다.
---

## 태스크 분해 (speckit.tasks)

구현 계획을 순서화된 실행 가능한 태스크 목록으로 변환합니다.

### 입력
```text
$ARGUMENTS
```

### 실행 단계

1. **설계 문서 로드**:
   - `plan.md`: 기술 스택, 아키텍처
   - `spec.md`: 사용자 스토리 (우선순위)
   - `data-model.md`: 엔티티
   - `contracts/`: API 스펙

2. **태스크 생성**:
   - 사용자 스토리별 그룹핑
   - 의존성 순서 정렬
   - 병렬 실행 가능 태스크 표시 [P]

### 태스크 형식 (필수)

```markdown
- [ ] T001 [P] [US1] 설명 with 파일 경로
```

- `- [ ]`: 체크박스 (필수)
- `T001`: 태스크 ID (순차)
- `[P]`: 병렬 실행 가능 (선택)
- `[US1]`: 사용자 스토리 라벨 (스토리 단계에서 필수)
- 설명 + 파일 경로

### Phase 구조

- **Phase 1**: Setup (프로젝트 초기화)
- **Phase 2**: Foundational (공통 전제조건)
- **Phase 3+**: User Stories (우선순위순)
- **Final Phase**: Polish (최종 정리)

### 결과물
- `specs/XXX-feature-name/tasks.md`

