import { PageSkeleton } from "@/components/feedback/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-svh w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageSkeleton />
    </main>
  );
}
