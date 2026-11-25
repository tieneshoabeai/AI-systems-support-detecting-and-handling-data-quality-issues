export type CurrentUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'analyst'
  status: 'active' | 'blocked'
  avatarUrl: string | null
}
