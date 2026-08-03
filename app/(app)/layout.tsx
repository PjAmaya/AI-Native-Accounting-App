import { Sidebar } from "@/components/nav/Sidebar";
import { ExceptionRail } from "@/components/rail/ExceptionRail";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-8">{children}</div>
      </main>
      <ExceptionRail />
    </div>
  );
}

export const dynamic = "force-dynamic";
