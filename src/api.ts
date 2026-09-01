const API_URL = import.meta.env.VITE_API_URL || '/api'

export type ApiProduct = {
  id: string
  categoryId: string
  category: string
  name: string
  slug: string
  sku: string
  description: string
  price: number
  oldPrice: number | null
  stock: number
  color: string
  colorHex: string
  imageKey: string | null
  imageUrl: string | null
  badge: string | null
  status: 'draft' | 'active' | 'archived'
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

export type ProductInput = Omit<ApiProduct, 'id' | 'category' | 'createdAt' | 'updatedAt'>

export type ApiOrder = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  shippingAddress: { city: string; commune: string; address: string; landmark?: string }
  notes: string | null
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
  paymentMethod: 'mobile_money' | 'card' | 'cash_on_delivery'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  subtotal: number
  shippingFee: number
  total: number
  createdAt: string
  items: Array<{ id: string; productId: string; name: string; unitPrice: number; quantity: number; lineTotal: number }>
}

export type DashboardData = {
  summary: { revenue: number; orders: number; products: number; pending: number }
  recentOrders: ApiOrder[]
  lowStock: Array<{ id: string; name: string; sku: string; stock: number }>
}

type RequestOptions = RequestInit & { token?: string }

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function apiRequest<Response>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (response.status === 204) return undefined as Response

  const payload = await response.json().catch(() => ({})) as { message?: string }
  if (!response.ok) {
    throw new ApiError(payload.message || 'Une erreur est survenue.', response.status)
  }
  return payload as Response
}

export const storefrontApi = {
  products: () => apiRequest<{ products: ApiProduct[] }>('/products'),
  createOrder: (order: {
    customerName: string
    customerEmail?: string
    customerPhone: string
    shippingAddress: { city: string; commune: string; address: string; landmark?: string }
    paymentMethod: 'mobile_money' | 'card' | 'cash_on_delivery'
    notes?: string
    items: Array<{ productId: string; quantity: number }>
  }) => apiRequest<{ order: { id: string; orderNumber: string; total: number; status: string } }>('/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),
}

export const adminApi = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; admin: { id: string; email: string; name: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) =>
    apiRequest<{ admin: { id: string; email: string; name: string } }>('/auth/me', { token }),
  dashboard: (token: string) =>
    apiRequest<DashboardData>('/admin/dashboard', { token }),
  products: (token: string) =>
    apiRequest<{ products: ApiProduct[] }>('/admin/products', { token }),
  categories: () =>
    apiRequest<{ categories: Array<{ id: string; name: string; slug: string }> }>('/categories'),
  createProduct: (token: string, product: ProductInput) =>
    apiRequest<{ product: ApiProduct }>('/admin/products', { method: 'POST', token, body: JSON.stringify(product) }),
  updateProduct: (token: string, id: string, product: ProductInput) =>
    apiRequest<{ product: ApiProduct }>(`/admin/products/${id}`, { method: 'PUT', token, body: JSON.stringify(product) }),
  archiveProduct: (token: string, id: string) =>
    apiRequest<void>(`/admin/products/${id}`, { method: 'DELETE', token }),
  orders: (token: string) =>
    apiRequest<{ orders: ApiOrder[] }>('/admin/orders', { token }),
  updateOrder: (token: string, id: string, changes: { status?: ApiOrder['status']; paymentStatus?: ApiOrder['paymentStatus'] }) =>
    apiRequest<{ order: ApiOrder }>(`/admin/orders/${id}`, { method: 'PATCH', token, body: JSON.stringify(changes) }),
}