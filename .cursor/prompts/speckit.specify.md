---
description: 새 기능 명세를 생성합니다.
---

## 기능 명세 생성 (speckit.specify)

사용자가 입력한 기능 설명을 바탕으로 상세 명세서를 작성합니다.

### 입력
```text
$ARGUMENTS
```

### 실행 단계

1. **브랜치 이름 생성**: 기능 설명에서 2-4 단어의 짧은 이름 추출 (예: user-auth, capsule-crud)

2. **기존 브랜치 확인**: 
   ```bash
   git fetch --all --prune
   git branch -a | grep -E '[0-9]+-<short-name>'
   ```

3. **specs 폴더 생성**:
   - 번호-기능명 형식으로 폴더 생성 (예: `specs/001-capsule-crud/`)
   - `spec.md` 파일 생성

4. **명세서 작성** (`templates/spec-template.md` 참고):
   - 기능 개요
   - 사용자 시나리오
   - 기능 요구사항 (테스트 가능한 형태로)
   - 성공 기준 (측정 가능, 기술 중립적)
   - 주요 엔티티 (데이터 관련 시)

5. **품질 검증**: 
   - 구현 세부사항 없이 WHAT과 WHY에 집중
   - [NEEDS CLARIFICATION] 마커는 최대 3개
   - 불명확한 부분은 합리적 기본값 적용

### 결과물
- `specs/XXX-feature-name/spec.md`
- Git 브랜치 생성 및 체크아웃

