import type { RendererLifecycle } from "./renderer-lifecycle"

export interface FatalHandlerOptions {
  lifecycle: RendererLifecycle
  report: (error: unknown) => void
}

export interface FatalErrorActionOptions extends FatalHandlerOptions {
  markFailed: () => void
}

export function handleFatalError(
  error: unknown,
  { lifecycle, report, markFailed }: FatalErrorActionOptions,
): void {
  lifecycle.shutdown()
  report(error)
  markFailed()
}

export function installFatalHandlers({
  lifecycle,
  report,
}: FatalHandlerOptions): () => void {
  const handleFatal = (error: unknown) => {
    handleFatalError(error, {
      lifecycle,
      report,
      markFailed: () => {
        process.exitCode = 1
      },
    })
  }

  process.once("uncaughtException", handleFatal)
  process.once("unhandledRejection", handleFatal)

  return () => {
    process.off("uncaughtException", handleFatal)
    process.off("unhandledRejection", handleFatal)
  }
}
