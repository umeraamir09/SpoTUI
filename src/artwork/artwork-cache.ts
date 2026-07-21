export interface ArtworkCacheOptions<T> {
  maxWeight?: number
  weigh?: (value: T) => number
}

interface CacheEntry<T> {
  value: T
  weight: number
}

export class ArtworkCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>()
  private readonly maxWeight: number
  private readonly weigh: (value: T) => number
  private totalWeight = 0

  constructor(
    private readonly capacity: number,
    {
      maxWeight = Number.POSITIVE_INFINITY,
      weigh = () => 1,
    }: ArtworkCacheOptions<T> = {},
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Artwork cache capacity must be positive")
    }
    if (maxWeight <= 0 || Number.isNaN(maxWeight)) {
      throw new Error("Artwork cache weight must be positive")
    }
    this.maxWeight = maxWeight
    this.weigh = weigh
  }

  get size(): number {
    return this.entries.size
  }

  get weight(): number {
    return this.totalWeight
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (entry === undefined) {
      return undefined
    }

    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T): void {
    const weight = this.weigh(value)
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("Artwork cache entry weight must be finite and positive")
    }

    const previous = this.entries.get(key)
    if (previous !== undefined) {
      this.totalWeight -= previous.weight
      this.entries.delete(key)
    }
    if (weight > this.maxWeight) {
      return
    }

    this.entries.set(key, { value, weight })
    this.totalWeight += weight

    while (
      this.entries.size > this.capacity ||
      this.totalWeight > this.maxWeight
    ) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) {
        return
      }
      const entry = this.entries.get(oldest)
      if (entry !== undefined) {
        this.totalWeight -= entry.weight
      }
      this.entries.delete(oldest)
    }
  }

  clear(): void {
    this.entries.clear()
    this.totalWeight = 0
  }
}
