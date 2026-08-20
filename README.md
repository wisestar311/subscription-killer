# 구독 킬러 (Subscription Killer)

안 쓰는 구독 서비스를 관리하고, 결제일 2일 전에 이메일 + 텔레그램으로 알림을 보내는 웹앱입니다.

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example` 파일을 복사해서 `.env.local`로 만들고 값을 채워주세요.

```bash
cp .env.local.example .env.local
```

필요한 값:
- Supabase URL / Anon Key / Service Role Key
- Resend API Key
- Telegram Bot Token
- CRON_SECRET (아무 긴 문자열)

### 3. Supabase 테이블 생성

Supabase SQL Editor에서 아래를 실행하세요.

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  price integer not null,
  billing_day integer not null check (billing_day between 1 and 31),
  cancel_url text,
  is_active boolean default true,
  last_used_month text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "본인 데이터만 접근"
  on subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_chat_id text,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "본인만 접근"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

### 4. 로컬 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 5. 배포 (Vercel)

1. GitHub에 올리기
2. Vercel에서 Import
3. Environment Variables 모두 등록
4. Deploy

## 주요 기능

- 이메일 매직링크 로그인
- 구독 추가 / 수정 / 삭제
- 이번 달 / 다음 달 총액 표시
- 사용 여부 토글
- 결제일 2일 전 이메일 + 텔레그램 알림
