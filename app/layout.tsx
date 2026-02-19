import type { Metadata } from "next";
import { Phudu } from "next/font/google";
import "./globals.css";

const phudu = Phudu({
  subsets: ["latin"],
  variable: "--font-phudu",
});

export const metadata: Metadata = {
  title: "StickerJournal Dashboard",
  description: "Capture and browse memories with stickers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className={`${phudu.variable} antialiased`}>{children}</body>
    </html>
  );
}
