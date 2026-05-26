import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Juliana Delmonte · Nutrição Comportamental",
  description:
    "Nutrição comportamental para quem está cansado de começar de novo toda segunda-feira.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
