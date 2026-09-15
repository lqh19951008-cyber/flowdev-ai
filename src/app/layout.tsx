import type { Metadata } from "next";
import "./globals.css";
import { HeroUIProvider } from "@/components/providers/HeroUIProvider";

export const metadata: Metadata = {
  title: "FlowDev-AI | 企业研发效能与代码门禁管控中台",
  description: "基于 HeroUI 与 Kahn DAG 拓扑编排的轻量高效代码门禁管控系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col transition-colors duration-200">
        <HeroUIProvider>
          {children}
        </HeroUIProvider>
      </body>
    </html>
  );
}
