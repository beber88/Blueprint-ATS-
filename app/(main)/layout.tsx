import { Sidebar } from "@/components/shared/sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </main>
    </div>
  );
}
