import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  try {
    await resend.emails.send({
      from: '구독 킬러 <onboarding@resend.dev>',
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error('이메일 발송 오류:', error);
  }
}
