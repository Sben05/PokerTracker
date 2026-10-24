import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'PokerBank — The House Ledger',description:'Good games. Clear balances. A beautifully simple ledger for your poker nights.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
