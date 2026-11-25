export type ResultReviewInput = { rating: number; comment: string }

// UI boundary for future integration. Only supply a result after server confirmation.
// save must reject on failure and resolve only when review + result are persisted.
export type ConfirmedProjectResult = {
  id: string
  save: (review: ResultReviewInput) => Promise<void>
  download?: () => Promise<void>
}
