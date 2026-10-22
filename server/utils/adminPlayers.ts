import { users } from '../db/schema'

export const adminPlayerFields = {
  id: users.id,
  username: users.username,
  country: users.country,
  createdAt: users.createdAt
}

export function toAdminPlayer(row: { id: string, username: string, country: string, createdAt: Date }): AdminPlayer {
  return { ...row, createdAt: row.createdAt.toISOString() }
}
