export const APP_PAGES = [
  "player",
  "browse",
  "search",
  "library",
  "queue",
  "devices",
] as const

export type AppPage = (typeof APP_PAGES)[number]

export const PAGE_LABELS: Record<AppPage, string> = {
  player: "Player",
  browse: "Browse",
  search: "Search",
  library: "Library",
  queue: "Queue",
  devices: "Devices",
}
