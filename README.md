# 구독 킬러

매월 반복되는 지출을 캘린더로 관리하고, 최소 필요 지출과 현재 잔액을 비교하는 Next.js 앱입니다. 결제 이틀 전 이메일·Telegram 알림과 iPhone 메시지를 통한 잔액 자동 업데이트를 지원합니다.

## 주요 기능

- 이메일 매직 링크 로그인
- 월간 지출 캘린더와 월말 결제일 자동 보정
- 지출별 전용 상세·수정 화면
- 이번 달 최소 필요 지출, 현재 잔액, 예정 지출 후 잔액 표시
- iOS 단축어를 통한 은행 문자 잔액 자동 반영
- 이메일·Telegram 결제 알림과 중복 발송 방지
- 사용자별 Supabase Row Level Security

## 로컬 실행

Node.js 22 이상을 권장합니다.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

`.env.local.example`의 다음 값을 채웁니다.

| 이름 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | cron 및 잔액 webhook 전용 서버 키 |
| `RESEND_API_KEY` | Resend API 키 |
| `RESEND_FROM_EMAIL` | 검증된 도메인의 발신자, 예: `구독 킬러 <notifications@example.com>` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API 토큰 |
| `CRON_SECRET` | 16자 이상의 무작위 문자열 |

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`은 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다.

## 데이터베이스 설정

Supabase SQL Editor에서 아래 파일을 순서대로 실행합니다.

1. `supabase/migrations/202608290000_initial_schema.sql`
2. `supabase/migrations/202608290001_expenditure_schedule.sql`
3. `supabase/migrations/202608290002_annual_schedule.sql`

두 번째 migration은 현재 잔액 필드와 알림 발송 이력, 동시·중복 발송을 막는 claim 함수를 추가합니다. 세 번째 migration은 월간·연간 결제 주기와 구독 만료일을 추가합니다. 기존 `subscriptions`와 `profiles` 데이터는 유지됩니다.

Supabase Authentication의 URL Configuration에는 로컬 및 배포 주소의 `/auth/callback`을 Redirect URL로 등록합니다.

## iPhone 메시지 잔액 연동

웹 브라우저는 iPhone 메시지를 직접 읽을 수 없습니다. 이 앱은 iOS 단축어의 개인용 자동화를 수신 endpoint로 연결합니다.

1. 앱의 `설정 → 연동 토큰 만들기`를 누릅니다.
2. iPhone의 단축어 앱에서 `자동화 → 메시지를 받을 때`를 선택합니다.
3. 은행 발신자를 지정하고 `URL 콘텐츠 가져오기` 동작을 추가합니다.
4. 앱 설정 화면에 표시된 URL과 JSON 본문을 복사합니다.
5. 메서드를 `POST`, 요청 본문을 `JSON`으로 설정하고 `message` 값에는 수신한 메시지인 `단축어 입력`을 지정합니다.

문자에는 `잔액`, `출금가능금액`, `가용 잔액` 또는 `Available balance`가 포함되어야 합니다. 앱은 문자 원문을 저장하지 않고 추출한 숫자와 업데이트 시각만 저장합니다. 토큰은 생성 직후 한 번만 표시되며 서버에는 SHA-256 해시만 저장됩니다.

은행의 문자 형식이 지원되지 않으면 단축어에서 직접 잔액 숫자를 추출해 다음 본문으로 전송할 수도 있습니다.

```json
{
  "token": "설정에서 생성한 토큰",
  "balance": 1234567
}
```

## 알림 cron

`vercel.json`은 매일 `00:00 UTC` 즉 한국 시간 오전 9시에 `/api/cron/notify`를 호출합니다. Vercel 프로젝트에 `CRON_SECRET`을 설정하면 Authorization 헤더가 자동으로 추가됩니다.

- 결제일이 없는 달의 29~31일 일정은 해당 달의 말일로 조정됩니다.
- 이메일과 Telegram 채널은 각각 발송 이력을 저장합니다.
- 동일한 일정·결제일·채널은 한 번만 발송하며 실패 건은 5분 뒤 재시도할 수 있습니다.
- Resend 발신 주소는 반드시 검증된 사용자 도메인을 사용해야 합니다.

## 검증

```bash
npm run check
npm run build
npm audit --omit=dev
```

`npm run check`는 ESLint, TypeScript 및 날짜·잔액 파서 단위 테스트를 실행합니다.

## 배포

1. Supabase migration을 적용합니다.
2. Vercel에서 저장소를 Import합니다.
3. 모든 환경 변수를 Production에 등록합니다.
4. Supabase Redirect URL에 배포 도메인을 추가합니다.
5. 배포 후 Vercel Cron Jobs와 함수 로그에서 첫 실행을 확인합니다.
