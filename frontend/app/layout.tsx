import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { auth } from '@/lib/auth';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'RAG Quiz',
  description: 'Upload a doc. Get notes, quizzes, and chat — organized by subject.',
  keywords: ['RAG', 'AI', 'quiz', 'Gemini', 'LangChain', 'NestJS', 'Next.js'],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        <AuthProvider session={session}>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
