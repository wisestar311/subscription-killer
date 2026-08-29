import type { DeliveryResult } from './email';

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<DeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'Telegram Bot Token이 없습니다.' };
  if (!chatId.trim()) return { ok: false, error: 'Telegram Chat ID가 없습니다.' };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId).trim(),
        text,
        disable_web_page_preview: true,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: { message_id?: number }; description?: string }
      | null;
    if (!response.ok || !result?.ok) {
      console.error('Telegram API error:', result);
      return { ok: false, error: result?.description || `Telegram HTTP ${response.status}` };
    }

    return { ok: true, providerId: String(result.result?.message_id ?? '') || undefined };
  } catch (error) {
    console.error('텔레그램 발송 오류:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '알 수 없는 텔레그램 발송 오류',
    };
  }
}
