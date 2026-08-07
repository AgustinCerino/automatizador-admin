import { Skeleton } from "@/components/ui/skeleton";

const steps = ["source", "configuration", "validation", "result"] as const;

export function WorkspaceSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando transformación"
      className="space-y-6"
      role="status"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-48 motion-reduce:animate-none" />
        <Skeleton className="h-9 w-72 motion-reduce:animate-none" />
        <Skeleton className="h-5 w-56 motion-reduce:animate-none" />
      </div>
      <div className="grid gap-3 md:grid-cols-4" aria-hidden="true">
        {steps.map((step) => (
          <Skeleton className="h-20 motion-reduce:animate-none" key={step} />
        ))}
      </div>
      <Skeleton className="h-32 w-full motion-reduce:animate-none" />
      <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
        {steps.map((step) => (
          <Skeleton className="h-56 motion-reduce:animate-none" key={step} />
        ))}
      </div>
    </section>
  );
}
