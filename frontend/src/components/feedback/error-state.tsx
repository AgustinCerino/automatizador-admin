import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  description: string;
  retry?: () => void;
  headingLevel?: 1 | 2;
  className?: string;
}

export function ErrorState({
  title,
  description,
  retry,
  headingLevel = 2,
  className,
}: ErrorStateProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-xl border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
      >
        <CircleAlert className="size-6" />
      </div>
      <Heading className="text-lg font-semibold text-foreground">
        {title}
      </Heading>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {retry ? (
        <Button className="mt-6" onClick={retry} type="button">
          Reintentar
        </Button>
      ) : null}
    </section>
  );
}
