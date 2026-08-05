import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  variant?: "cards" | "table";
  className?: string;
}

const skeletonRows = ["primera", "segunda", "tercera"] as const;
const skeletonColumns = ["primera", "segunda", "tercera", "cuarta"] as const;

export function PageSkeleton({
  variant = "cards",
  className,
}: PageSkeletonProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando contenido"
      className={cn("space-y-8", className)}
      role="status"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-full max-w-sm motion-reduce:animate-none" />
        <Skeleton className="h-4 w-full max-w-xl motion-reduce:animate-none" />
      </div>

      {variant === "table" ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div aria-hidden="true" className="min-w-144 p-4">
            <div className="grid grid-cols-4 gap-6 border-b pb-4">
              {skeletonColumns.map((column) => (
                <Skeleton
                  className="h-4 w-24 motion-reduce:animate-none"
                  key={column}
                />
              ))}
            </div>
            {skeletonRows.map((row) => (
              <div
                className="grid grid-cols-4 gap-6 border-b py-4 last:border-0"
                key={row}
              >
                <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
          {skeletonRows.map((card) => (
            <div className="space-y-4 rounded-xl border bg-card p-5" key={card}>
              <Skeleton className="size-10 motion-reduce:animate-none" />
              <Skeleton className="h-5 w-28 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-full motion-reduce:animate-none" />
              <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
