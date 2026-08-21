export const queryKeys = {
  executions: {
    all: ["executions"] as const,
    byProcess: (processId: number) =>
      ["executions", "by-process", processId] as const,
    detail: (executionId: number) =>
      ["executions", "detail", executionId] as const,
  },
  processes: {
    all: ["processes"] as const,
    detail: (processId: number) =>
      ["processes", "detail", processId] as const,
    list: () => ["processes", "list"] as const,
  },
  system: {
    all: ["system"] as const,
    health: ["system", "health"] as const,
  },
  transformations: {
    all: ["transformations"] as const,
    detail: (executionId: number) =>
      ["transformations", "detail", executionId] as const,
    summary: (executionId: number) =>
      ["transformations", "detail", executionId, "summary"] as const,
    configuration: (executionId: number) =>
      ["transformations", "detail", executionId, "configuration"] as const,
    result: (executionId: number) =>
      ["transformations", "detail", executionId, "result"] as const,
    sourceFiles: (executionId: number) =>
      ["transformations", "detail", executionId, "source-files"] as const,
    sourceStructure: (
      executionId: number,
      sourceFileId: number,
      sheet: string | null,
      headerRow: number,
    ) =>
      [
        "transformations",
        "detail",
        executionId,
        "source-files",
        sourceFileId,
        "structure",
        sheet,
        headerRow,
      ] as const,
  },
} as const;
