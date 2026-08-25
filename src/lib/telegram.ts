export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing');
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN is missing' };
  }

  if (!chatId) {
    return { ok: false, error: 'chatId is empty' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId).trim(),
        text,
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error('Telegram API error:', data);
      return {
        ok: false,
        error: data?.description || `HTTP ${res.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('텔레그램 발송 오류:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
