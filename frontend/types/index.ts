export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export type Role = 'user' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

export type TaskOwner = Pick<User, 'id' | 'name' | 'email'>

export interface Task {
  id: number
  user_id: number
  title: string
  description: string | null
  due_date: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
  owner?: TaskOwner
}

export interface TaskPayload {
  title: string
  description: string | null
  due_date: string | null
  status: TaskStatus
}

export type SortColumn = 'due_date' | 'status' | 'title' | 'created_at'
export type SortDirection = 'asc' | 'desc'

export interface TaskQuery {
  search?: string
  status?: TaskStatus
  sort?: SortColumn
  direction?: SortDirection
  page?: number
  per_page?: number
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

/** The shape every API error comes back in — see ApiExceptionHandler.php. */
export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
