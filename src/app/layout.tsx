import type { Metadata } from "next";
import localFont from "next/font/local";
import { Fira_Code } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SanctionBanner } from "@/components/shell/SanctionBanner";
import { AppFooter } from "@/components/shell/AppFooter";
import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/shell/AppHeader";
import "./globals.css";

// Pretendard variable (OFL-1.1), weights 45–920 in one file.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAMEPLZ",
  description:
    "남이 만든 AI 결과물을 구경하다가 SAME을 누르면, 그걸 만든 프롬프트·에이전트·스킬을 그대로 받아요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${firaCode.variable}`}>
      <body>
        <AuthProvider>
          <Suspense fallback={<AppHeaderFallback />}>
            <AppHeader />
          </Suspense>
          <SanctionBanner />
          {children}
          <AppFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
