import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowDev-AI | 可视化多 Agent 代码审查与自动化单测平台",
  description: "基于 Web 可视化节点流的多 Agent 代码审查与自动化单测生成平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
