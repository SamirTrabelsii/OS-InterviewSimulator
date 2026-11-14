import { Atkinson_Hyperlegible, JetBrains_Mono, Pixelify_Sans, Silkscreen } from "next/font/google";

// Servies par l'application au build (next/font), jamais par un CDN au runtime.
// Pixel : titres, HUD, boutons. Lecture et code : jamais en police pixel.
export const fontPixel = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-pixel", display: "swap" });
export const fontUi = Pixelify_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
export const fontRead = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-read", display: "swap" });
export const fontCode = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });
