import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type DeliveryResult =
  | { ok: true; providerId?: string }
  | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  text,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
}): Promise<DeliveryResult> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !from) {
    return { ok: false, error: 'Resend 발송 환경 변수가 없습니다.' };
  }

  try {
    const { data, error } = await resend.emails.send(
      { from, to, subject, text },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (error) return { ok: false, error: error.message };
    return { ok: true, providerId: data?.id };
  } catch (error) {
    console.error('이메일 발송 오류:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '알 수 없는 이메일 발송 오류',
    };
  }
}
