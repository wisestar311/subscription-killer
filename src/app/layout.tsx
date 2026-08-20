import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '구독 킬러',
  description: '안 쓰는 구독을 정리하고 돈을 아끼세요',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
