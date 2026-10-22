import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "./globals.css";
import { theme } from "@/theme";

export const metadata: Metadata = {
  title: "PCOME CRM",
  description: "PCOME CRM 웹 애플리케이션",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" {...mantineHtmlProps}>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
