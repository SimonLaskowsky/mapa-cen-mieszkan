import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RynkoRadar | Radar cen mieszkań w Polsce',
  description: 'Interaktywna mapa cen mieszkań w Polsce. Porównaj ceny ofertowe z realnymi transakcjami, śledź trendy w dzielnicach i znajdź okazje zanim znikną.',
  keywords: ['rynkoradar', 'ceny mieszkań', 'mapa cen', 'nieruchomości Warszawa', 'cena za metr', 'mieszkania Polska', 'radar okazji'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
