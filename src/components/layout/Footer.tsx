// src/components/layout/Footer.tsx
export default function Footer() {
  return (
    <footer className="bg-slate-100 border-t text-center p-4 text-sm text-slate-600">
      © {new Date().getFullYear()} Automotive Services Finder. All rights reserved.
    </footer>
  );
}