import { z } from "zod"

const SERVICE_NAME = "dev.umroo.vinylcli"
const SESSION_NAME = "spotify-session-v1"

const storedAuthSessionSchema = z.object({
  accountId: z.string().min(1),
  refreshToken: z.string().min(1),
  authorizedAt: z.iso.datetime(),
})

export type StoredAuthSession = z.infer<
  typeof storedAuthSessionSchema
>

export interface SecretStore {
  getSession: () => Promise<StoredAuthSession | null>
  setSession: (session: StoredAuthSession) => Promise<void>
  deleteSession: () => Promise<void>
}

export interface SecretsApi {
  get: (options: {
    service: string
    name: string
  }) => Promise<string | null>
  set: (options: {
    service: string
    name: string
    value: string
  }) => Promise<void>
  delete: (options: {
    service: string
    name: string
  }) => Promise<boolean>
}

export class SecretStoreUnavailableError extends Error {
  constructor() {
    super("The operating-system credential store is unavailable")
    this.name = "SecretStoreUnavailableError"
  }
}

export class SecretStoreCorruptError extends Error {
  constructor() {
    super("Stored Spotify credentials are invalid")
    this.name = "SecretStoreCorruptError"
  }
}

export class BunSecretStore implements SecretStore {
  private readonly secrets: SecretsApi

  constructor({
    secrets = Bun.secrets,
  }: {
    secrets?: SecretsApi
  } = {}) {
    this.secrets = secrets
  }

  async getSession(): Promise<StoredAuthSession | null> {
    let serialized: string | null
    try {
      serialized = await this.secrets.get({
        service: SERVICE_NAME,
        name: SESSION_NAME,
      })
    } catch {
      throw new SecretStoreUnavailableError()
    }

    if (serialized === null) {
      return null
    }

    try {
      return storedAuthSessionSchema.parse(JSON.parse(serialized))
    } catch {
      throw new SecretStoreCorruptError()
    }
  }

  async setSession(session: StoredAuthSession): Promise<void> {
    const validated = storedAuthSessionSchema.parse(session)
    try {
      await this.secrets.set({
        service: SERVICE_NAME,
        name: SESSION_NAME,
        value: JSON.stringify(validated),
      })
    } catch {
      throw new SecretStoreUnavailableError()
    }
  }

  async deleteSession(): Promise<void> {
    try {
      await this.secrets.delete({
        service: SERVICE_NAME,
        name: SESSION_NAME,
      })
    } catch {
      throw new SecretStoreUnavailableError()
    }
  }
}

export class MemorySecretStore implements SecretStore {
  private session: StoredAuthSession | null

  constructor(session: StoredAuthSession | null = null) {
    this.session = session === null ? null : { ...session }
  }

  getSession(): Promise<StoredAuthSession | null> {
    return Promise.resolve(
      this.session === null ? null : { ...this.session },
    )
  }

  setSession(session: StoredAuthSession): Promise<void> {
    this.session = { ...session }
    return Promise.resolve()
  }

  deleteSession(): Promise<void> {
    this.session = null
    return Promise.resolve()
  }
}

