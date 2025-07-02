// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import { Inter } from "next/font/google";
import AppProviders from "@/components/providers/AppProviders";
import Header from "@/components/layout/Header";
// import Footer from "@/components/layout/Footer";
import { Sheet } from "@/components/ui/sheet";
import { CartSheet } from "@/components/cart/CartSheet";

const inter = Inter({ variable: "--font-geist-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Automotive Services Finder",
  description: "Find automotive services and parts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const HEADER_HEIGHT_CLASS = "pt-16"; // Or your specific class, e.g., "pt-[68px]"

  return (
    <html lang="en">
      {/* <body className={`${inter.className} flex flex-col min-h-screen bg-slate-50`}>
       */}
      <body className={`${inter.className} flex flex-col min-h-screen bg-green-100`}>
        <AppProviders>
           <Sheet>
            <div className="flex flex-col min-h-screen">
              <Header /> {/* Fixed header, out of normal flow */}
              <CartSheet />
              {/* main content area, flex-grow allows it to take remaining space */}
              {/* pt-16 (HEADER_HEIGHT_CLASS) pushes content down to avoid fixed Header */}
              {/* flex flex-col allows children like ShopDetailsPageWrapper to use flex-1 */}
              <main className={`flex-grow flex flex-col ${HEADER_HEIGHT_CLASS}`}> 
                {children}
              </main>
              {/* <Footer /> */}
            </div>
          </Sheet>
        </AppProviders>
      </body>
    </html>
  );
}
// // src/app/layout.tsx
// import type { Metadata } from "next";
// import "./globals.css";

// import { Inter } from "next/font/google";
// import AppProviders from "@/components/providers/AppProviders"; // Import the wrapper
// import Header from "@/components/layout/Header";
// import Footer from "@/components/layout/Footer";
// import { Sheet } from "@/components/ui/sheet"; // Import Sheet
// import { CartSheet } from "@/components/cart/CartSheet"; // Our cart content component

// const inter = Inter({ variable: "--font-geist-inter", subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Automotive Services Finder", // Simplified title example
//   description: "Find automotive services and parts.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   const HEADER_HEIGHT_CLASS = "pt-16";
//   return (
//     <html lang="en">
//       <body className={`${inter.className} flex flex-col min-h-screen bg-slate-50`}>
//         <AppProviders> {/* Use the AppProviders wrapper */}
//            <Sheet> {/* Wrap the section where Trigger and Content will live */}
//             <div className="flex flex-col min-h-screen">
//               <Header />
//               <CartSheet /> {/* This is the content that will appear in the sheet/drawer */}
//               <main className={`flex-grow ${HEADER_HEIGHT_CLASS }`}> 
//                 {children}
//               </main>
//               {/* <Footer /> */}
//             </div>
//           </Sheet>
//         </AppProviders>
//       </body>
//     </html>
//   );
// }
// // import type { Metadata } from "next";

// // import "./globals.css";

// // import { Inter } from "next/font/google"; 

// // import QueryProvider from "@/components/providers/QueryProvider";
// // import Header from "@/components/layout/Header";
// // import Footer from "@/components/layout/Footer";
// // import { SimpleLocationProvider } from "@/contexts/SimpleLocationContext";
// // import { CartProvider } from '@/contexts/CartContext';

// // const inter = Inter({ variable: "--font-geist-inter",subsets: ["latin"] });

// // export const metadata: Metadata = {
// //   title: "Automotive Services Finder - 6th October",
// //   description: "Find the best automotive services and maintenance shops in 6th of October City.",
// // };

// // export default function RootLayout({
// //   children,
// // }: Readonly<{
// //   children: React.ReactNode;
// // }>) {
// //   return (
// //     <html lang="en">
// //       <body className={`${inter.className} flex flex-col min-h-screen bg-slate-50`}>
// //         <QueryProvider>
// //           <SimpleLocationProvider>
// //             <CartProvider>
// //           <Header />
// //           <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8">
// //             {children}
// //           </main>
// //           <Footer />
// //           </CartProvider>
// //           </SimpleLocationProvider>
// //         </QueryProvider>
// //       </body>
// //     </html>
// //   );
// // }
