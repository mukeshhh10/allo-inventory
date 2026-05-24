import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory and reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav style={{background:"rgba(10,10,15,0.85)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--border)",position:"sticky",top:0,zIndex:50}}>
          <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <a href="/" style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:800,color:"var(--text)",textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:28,height:28,borderRadius:6,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800}}>A</span>
              allo<span style={{color:"var(--text-muted)",fontWeight:400}}>/inventory</span>
            </a>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <a href="/" style={{color:"var(--text-muted)",textDecoration:"none",fontSize:14,padding:"6px 12px",borderRadius:6}}>Products</a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
