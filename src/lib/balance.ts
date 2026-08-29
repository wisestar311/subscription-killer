const MAX_BALANCE = 9_000_000_000_000_000;

export type BalanceImportPayload = {
  token?: unknown;
  balance?: unknown;
  message?: unknown;
};

export function parseBalanceImportPayload(
  rawBody: string,
  contentType: string | null,
): BalanceImportPayload | null {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();

  if (mediaType === 'application/json') {
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as BalanceImportPayload)
        : null;
    } catch {
      return null;
    }
  }

  if (mediaType === 'application/x-www-form-urlencoded') {
    const trimmed = rawBody.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as BalanceImportPayload;
        }
      } catch {
        // 폼 데이터로 계속 처리
      }
    }

    const params = new URLSearchParams(rawBody);
    const nonEmpty = (value: string | null) => (value ? value : undefined);
    return {
      token: nonEmpty(params.get('token')),
      balance: nonEmpty(params.get('balance')),
      message: nonEmpty(params.get('message')),
    };
  }

  return rawBody ? { message: rawBody } : null;
}

export function normalizeBalance(value: unknown): number | null {
  const normalized =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/[,+\s₩원]/g, ''))
        : Number.NaN;

  if (!Number.isSafeInteger(normalized) || normalized < 0 || normalized > MAX_BALANCE) {
    return null;
  }

  return normalized;
}

export function parseBalanceFromMessage(message: string): number | null {
  const patterns = [
    /(?:현재\s*)?잔액\s*[:：]?\s*(?:KRW\s*)?[₩￦]?\s*([0-9][0-9,]*)\s*원?/i,
    /(?:출금\s*가능|출금가능)(?:\s*금액)?\s*[:：]?\s*(?:KRW\s*)?[₩￦]?\s*([0-9][0-9,]*)\s*원?/i,
    /(?:가용\s*잔액|available\s+balance)\s*[:：]?\s*(?:KRW\s*)?[₩￦]?\s*([0-9][0-9,]*)\s*원?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return normalizeBalance(match[1]);
  }

  return null;
}
