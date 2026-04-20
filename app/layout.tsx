import type { Metadata } from "next"
import { Geist, Shrikhand, Instrument_Serif } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const shrikhand = Shrikhand({
  variable: "--font-shrikhand",
  subsets: ["latin"],
  weight: "400",
})

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
})

export const metadata: Metadata = {
  title: "Jamboree",
  description: "Swear Jar Jamboree 2026 — organizer dashboard.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${shrikhand.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
