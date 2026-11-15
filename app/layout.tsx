import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Task planner',
  description: 'Schedule tasks and track weekly progress.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
