import { Sidebar } from "@/components/shared/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#F8FAFC' }}>
        {children}
      </main>
    </div>
  );
}
