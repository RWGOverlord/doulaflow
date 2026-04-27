// src/app/layout.tsx
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "DoulaFlow",
  description: "Doula practice management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}