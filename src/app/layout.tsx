import type { Metadata } from 'next';
import ClickEffect from '@/components/ClickEffect';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mapa Cen Mieszkań | Ceny nieruchomości w Polsce',
  description: 'Interaktywna mapa cen mieszkań w Polsce. Sprawdź ceny za m² w swojej dzielnicy, śledź trendy i znajdź okazje.',
  keywords: ['ceny mieszkań', 'mapa cen', 'nieruchomości Warszawa', 'cena za metr', 'mieszkania Polska'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">
        <ClickEffect />
        {children}
      </body>
    </html>
  );
}
