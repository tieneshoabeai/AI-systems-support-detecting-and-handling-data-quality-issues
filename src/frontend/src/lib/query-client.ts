import { QueryClient } from '@tanstack/react-query'

export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
    mutations: { retry: false },
  },
})

export const clearSessionQueries = (client: QueryClient): void => {
  void client.cancelQueries()
  client.clear()
}
