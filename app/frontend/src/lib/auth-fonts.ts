import { Fraunces, Manrope } from 'next/font/google';

export const authDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-auth-display',
  display: 'swap',
});

export const authSans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-auth-sans',
  display: 'swap',
});
