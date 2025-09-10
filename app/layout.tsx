import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import InAppNotificationManager from '@/components/in-app-notification'
import PawgrammerBanner from '@/components/pawgrammer-banner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Job Application Tracker',
  description: 'Track and manage your job applications',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PawgrammerBanner />
        {children}
        <Toaster />
        <InAppNotificationManager />
      </body>
    </html>
  )
}