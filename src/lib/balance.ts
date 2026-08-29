const MAX_BALANCE = 9_000_000_000_000_000;

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
