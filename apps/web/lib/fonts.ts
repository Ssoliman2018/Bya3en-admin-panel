import { Cairo, Poppins } from 'next/font/google';

/**
 * Neon Souq typography (BRD §4)
 * Arabic UI → Cairo · Latin/numbers → Poppins
 */
const sans = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-sans',
  fallback: ['Segoe UI', 'Tahoma', 'system-ui', 'sans-serif'],
  preload: true,
  weight: ['400', '500', '600', '700', '800'],
});

const heading = Poppins({
  subsets: ['latin'],
  variable: '--font-heading',
  fallback: ['Cairo', 'system-ui', 'sans-serif'],
  preload: true,
  weight: ['500', '600', '700', '800'],
});

export { sans, heading };
