export const queryKeys = {
  conciliations: {
    all: ["conciliations"] as const,
    detail: (executionId: number) =>
      ["conciliations", "detail", executionId] as const,
    files: (executionId: number) =>
      ["conciliations", "detail", executionId, "files"] as const,
    preview: (executionId: number, fileId: number) =>
      ["conciliations", "detail", executionId, "files", fileId, "preview"] as const,
    selection: (executionId: number) =>
      ["conciliations", "detail", executionId, "selection"] as const,
    mapping: (executionId: number) =>
      ["conciliations", "detail", executionId, "mapping"] as const,
  },
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
