import type { Metadata } from "next";
import "./globals.css";
import "./crafting-progress.css";
import "./calculators.css";

export function generateMetadata(): Metadata {
  const portalName = String(process.env.PORTAL_NAME || "Free Company").trim() || "Free Company";
  return {
    title: portalName,
    description: `A self-hosted FFXIV Free Company portal for ${portalName}.`
  };
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="legal-footer">
          <p>This unofficial community project is not affiliated with or endorsed by Square Enix.</p>
          <p>FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. FINAL FANTASY XIV materials are © SQUARE ENIX.</p>
          <a href="/legal">Legal, privacy, content, and third-party notices</a>
        </footer>
      </body>
    </html>
  );
}
