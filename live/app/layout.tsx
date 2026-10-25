import type { Metadata } from 'next';
import './globals.css';
import './front-redesign.css';
import './polish.css';
export const metadata:Metadata={title:'Felt Club Poker OS',description:'Poker sessions, player results, and payments.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}
