import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'T2Dev Monetization Center',
  description: 'Private multi-application GAMOB monetization dashboard',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
      nosnippet: true,
    },
  },
  icons: { icon: '/favicon.png' }
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
