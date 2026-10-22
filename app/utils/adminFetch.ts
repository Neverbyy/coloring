export const ADMIN_SEARCH_DELAY_MS = 500

export function adminFetch<T>(request: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
  return $fetch<T>(request, {
    ...options,
    onResponseError({ response }) {
      if (response.status === 401) void useAdminStore().expire()
    }
  }) as Promise<T>
}
