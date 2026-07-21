#!/usr/bin/env bun
import { bootstrap } from "./app/bootstrap"

try {
  await bootstrap()
} catch (error) {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  process.stderr.write(`Unable to start UmrooFM.\n${message}\n`)
  process.exitCode = 1
}
