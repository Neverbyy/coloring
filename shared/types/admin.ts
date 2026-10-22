export interface SessionAdmin {
  id: string
  username: string
  role: 'admin'
}

export interface AdminPlayer {
  id: string
  username: string
  country: string
  createdAt: string
}

export interface AdminPlayerPage {
  items: AdminPlayer[]
  page: number
  pageCount: number
  total: number
}
