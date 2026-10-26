import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'OpenStax Poker',description:'Poker sessions, player results, and payments.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
