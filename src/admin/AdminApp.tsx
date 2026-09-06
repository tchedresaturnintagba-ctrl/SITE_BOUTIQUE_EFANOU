import { useEffect, useState, type FormEvent } from 'react'
import {
  Archive,
  ArrowLeft,
  Check,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  ShoppingBag,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  adminApi,
  ApiError,
  type ApiOrder,
  type ApiProduct,
  type DashboardData,
  type ProductInput,
} from '../api'
import './Admin.css'

type AdminTab = 'dashboard' | 'products' | 'orders'
type Category = { id: string; name: string; slug: string }

const emptyProduct = (categoryId = ''): ProductInput => ({
  categoryId,
  name: '',
  slug: '',
  sku: '',
  description: '',
  price: 0,
  oldPrice: null,
  stock: 0,
  color: '',
  colorHex: '#315f3c',
  imageKey: null,
  imageUrl: null,
  badge: null,
  status: 'draft',
  isFeatured: false,
})

const formatPrice = (price: number) => `${new Intl.NumberFormat('fr-FR').format(price)} FCFA`
const formatDate = (date: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
const statusLabels: Record<ApiOrder['status'], string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}
const paymentLabels: Record<ApiOrder['paymentStatus'], string> = {
  pending: 'À payer',
  paid: 'Payée',
  failed: 'Échouée',
  refunded: 'Remboursée',
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await adminApi.login(email, password)
      sessionStorage.setItem('horizon_admin_token', result.token)
      onLogin(result.token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connexion impossible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login">
      <section className="login-brand">
        <a href="/"><ArrowLeft size={18} /> Retour à la boutique</a>
        <div><span>Horizon <em>Efanou</em></span><p>Administration de la boutique</p></div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <p className="admin-kicker">Accès réservé</p>
          <h1>Bonjour, bienvenue.</h1>
          <p>Connectez-vous pour gérer le catalogue, les stocks et les commandes.</p>
          {error && <div className="admin-alert error"><TriangleAlert size={17} /> {error}</div>}
          <label>Adresse e-mail<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button type="submit" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        </form>
      </section>
    </main>
  )
}

function ProductEditor({ product, categories, onClose, onSave, onUpload }: {
  product: ApiProduct | null
  categories: Category[]
  onClose: () => void
  onSave: (input: ProductInput) => Promise<void>
  onUpload: (file: File) => Promise<string>
}) {
  const [draft, setDraft] = useState<ProductInput>(() => product ? {
    categoryId: product.categoryId,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    price: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    color: product.color,
    colorHex: product.colorHex,
    imageKey: product.imageKey,
    imageUrl: product.imageUrl,
    badge: product.badge,
    status: product.status,
    isFeatured: product.isFeatured,
  } : emptyProduct(categories[0]?.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(product?.imageUrl || '')

  const setField = <Key extends keyof ProductInput>(key: Key, value: ProductInput[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const selectImage = (file: File | null) => {
    setImageFile(file)
    if (!file) {
      setImagePreview(product?.imageUrl || '')
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.readAsDataURL(file)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const imageUrl = imageFile ? await onUpload(imageFile) : draft.imageUrl
      await onSave({
        ...draft,
        imageKey: imageFile ? null : draft.imageKey,
        imageUrl,
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="product-editor" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <header><div><p>{product ? 'Modification' : 'Nouveau produit'}</p><h2 id="product-editor-title">{product?.name || 'Ajouter un sac'}</h2></div><button className="admin-icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={21} /></button></header>
        <form onSubmit={submit}>
          {error && <div className="admin-alert error"><TriangleAlert size={17} /> {error}</div>}
          <div className="form-grid">
            <label className="field-wide">Nom du produit<input value={draft.name} onChange={(event) => { setField('name', event.target.value); if (!product) setField('slug', event.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) }} required /></label>
            <label>Référence (SKU)<input value={draft.sku} onChange={(event) => setField('sku', event.target.value.toUpperCase())} required /></label>
            <label>Catégorie<select value={draft.categoryId} onChange={(event) => setField('categoryId', event.target.value)} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="field-wide">Slug<input value={draft.slug} onChange={(event) => setField('slug', event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
            <label className="field-wide">Description<textarea rows={4} value={draft.description} onChange={(event) => setField('description', event.target.value)} required /></label>
            <label>Prix (FCFA)<input type="number" min="0" value={draft.price} onChange={(event) => setField('price', Number(event.target.value))} required /></label>
            <label>Ancien prix<input type="number" min="0" value={draft.oldPrice ?? ''} onChange={(event) => setField('oldPrice', event.target.value ? Number(event.target.value) : null)} /></label>
            <label>Stock<input type="number" min="0" value={draft.stock} onChange={(event) => setField('stock', Number(event.target.value))} required /></label>
            <label>Statut<select value={draft.status} onChange={(event) => setField('status', event.target.value as ProductInput['status'])}><option value="draft">Brouillon</option><option value="active">En vente</option><option value="archived">Archivé</option></select></label>
            <label>Couleur<input value={draft.color} onChange={(event) => setField('color', event.target.value)} required /></label>
            <label>Teinte<input type="color" value={draft.colorHex} onChange={(event) => setField('colorHex', event.target.value)} /></label>
            <label className="field-wide">Photo du produit<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0] || null)} required={!draft.imageUrl && !draft.imageKey} /></label>
            {imagePreview && <div className="product-image-preview field-wide"><img src={imagePreview} alt="Aperçu du produit" /></div>}
            <label>Badge<input value={draft.badge ?? ''} onChange={(event) => setField('badge', event.target.value || null)} placeholder="Nouveau" /></label>
            <label className="checkbox-field"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => setField('isFeatured', event.target.checked)} /> Mettre en avant</label>
          </div>
          <footer><button className="secondary-admin-button" type="button" onClick={onClose}>Annuler</button><button className="primary-admin-button" type="submit" disabled={saving}><Save size={17} /> {saving ? 'Enregistrement...' : 'Enregistrer'}</button></footer>
        </form>
      </section>
    </div>
  )
}

export default function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem('horizon_admin_token') || '')
  const [adminName, setAdminName] = useState('Administrateur')
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem('horizon_admin_token')))
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const logout = () => {
    sessionStorage.removeItem('horizon_admin_token')
    setToken('')
    setDashboard(null)
  }

  useEffect(() => {
    if (!token) return
    let active = true
    Promise.all([
      adminApi.me(token),
      adminApi.dashboard(token),
      adminApi.products(token),
      adminApi.orders(token),
      adminApi.categories(),
    ])
      .then(([profile, dashboardData, productData, orderData, categoryData]) => {
        if (!active) return
        setAdminName(profile.admin.name)
        setDashboard(dashboardData)
        setProducts(productData.products)
        setOrders(orderData.orders)
        setCategories(categoryData.categories)
      })
      .catch((caught) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) logout()
        else setError(caught instanceof Error ? caught.message : 'Chargement impossible.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (!token) return <Login onLogin={(nextToken) => { setLoading(true); setToken(nextToken) }} />
  if (loading) return <div className="admin-loading"><span>Horizon <em>Efanou</em></span><p>Chargement de l'administration...</p></div>

  const refreshProducts = async () => setProducts((await adminApi.products(token)).products)
  const refreshOrders = async () => setOrders((await adminApi.orders(token)).orders)
  const saveProduct = async (input: ProductInput) => {
    if (editingProduct) await adminApi.updateProduct(token, editingProduct.id, input)
    else await adminApi.createProduct(token, input)
    await refreshProducts()
  }
  const archiveProduct = async (product: ApiProduct) => {
    if (!window.confirm(`Archiver « ${product.name} » ?`)) return
    await adminApi.archiveProduct(token, product.id)
    await refreshProducts()
  }
  const updateOrder = async (id: string, changes: { status?: ApiOrder['status']; paymentStatus?: ApiOrder['paymentStatus'] }) => {
    await adminApi.updateOrder(token, id, changes)
    await Promise.all([refreshOrders(), adminApi.dashboard(token).then(setDashboard)])
  }
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="admin-logo"><span>Horizon <em>Efanou</em></span><p>Administration</p></div>
        <nav>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => { setTab('dashboard'); setMenuOpen(false) }}><LayoutDashboard size={19} /> Vue d'ensemble</button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => { setTab('products'); setMenuOpen(false) }}><Package size={19} /> Produits</button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => { setTab('orders'); setMenuOpen(false) }}><ShoppingBag size={19} /> Commandes{dashboard?.summary.pending ? <b>{dashboard.summary.pending}</b> : null}</button>
        </nav>
        <div className="sidebar-footer"><a href="/"><ArrowLeft size={17} /> Voir la boutique</a><button onClick={logout}><LogOut size={17} /> Déconnexion</button></div>
      </aside>
      {menuOpen && <button className="admin-menu-overlay" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
          <div><span>Connecté en tant que</span><strong>{adminName}</strong></div>
        </header>
        <div className="admin-content">
          {error && <div className="admin-alert error"><TriangleAlert size={17} /> {error}</div>}

          {tab === 'dashboard' && dashboard && (
            <section>
              <div className="admin-page-heading"><div><p className="admin-kicker">Aujourd'hui</p><h1>Vue d'ensemble</h1></div></div>
              <div className="metric-grid">
                <article><span><CircleDollarSign size={20} /></span><p>Chiffre d'affaires du mois</p><strong>{formatPrice(dashboard.summary.revenue)}</strong></article>
                <article><span><ShoppingBag size={20} /></span><p>Commandes du mois</p><strong>{dashboard.summary.orders}</strong></article>
                <article><span><Package size={20} /></span><p>Produits au catalogue</p><strong>{dashboard.summary.products}</strong></article>
                <article><span><TriangleAlert size={20} /></span><p>À traiter</p><strong>{dashboard.summary.pending}</strong></article>
              </div>
              <div className="dashboard-grid">
                <section className="admin-panel"><header><div><p>Activité</p><h2>Commandes récentes</h2></div><button onClick={() => setTab('orders')}>Tout voir</button></header><div className="compact-list">{dashboard.recentOrders.length ? dashboard.recentOrders.map((order) => <div key={order.id}><span><strong>{order.orderNumber}</strong><small>{order.customerName}</small></span><span><b className={`status ${order.status}`}>{statusLabels[order.status]}</b><small>{formatPrice(order.total)}</small></span></div>) : <p className="empty-admin-state">Aucune commande pour le moment.</p>}</div></section>
                <section className="admin-panel"><header><div><p>Inventaire</p><h2>Stocks faibles</h2></div></header><div className="compact-list">{dashboard.lowStock.length ? dashboard.lowStock.map((product) => <div key={product.id}><span><strong>{product.name}</strong><small>{product.sku}</small></span><b className="stock-alert">{product.stock} restant{product.stock > 1 ? 's' : ''}</b></div>) : <p className="empty-admin-state"><Check size={18} /> Tous les stocks sont suffisants.</p>}</div></section>
              </div>
            </section>
          )}

          {tab === 'products' && (
            <section>
              <div className="admin-page-heading"><div><p className="admin-kicker">Catalogue</p><h1>Produits</h1><span>{products.length} références enregistrées</span></div><button className="primary-admin-button" onClick={() => setEditingProduct(null)}><Plus size={17} /> Ajouter un produit</button></div>
              <div className="admin-toolbar"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par nom ou référence" /></label></div>
              <div className="admin-table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><div className="product-cell">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span><Package size={19} /></span>}<div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category}</td><td><strong>{formatPrice(product.price)}</strong></td><td><b className={product.stock <= 5 ? 'stock-alert' : ''}>{product.stock}</b></td><td><b className={`status ${product.status}`}>{product.status === 'active' ? 'En vente' : product.status === 'draft' ? 'Brouillon' : 'Archivé'}</b></td><td><div className="table-actions"><button onClick={() => setEditingProduct(product)} aria-label={`Modifier ${product.name}`}><Pencil size={17} /></button><button onClick={() => void archiveProduct(product)} aria-label={`Archiver ${product.name}`}><Archive size={17} /></button></div></td></tr>)}</tbody></table></div>
            </section>
          )}

          {tab === 'orders' && (
            <section>
              <div className="admin-page-heading"><div><p className="admin-kicker">Ventes</p><h1>Commandes</h1><span>{orders.length} commandes affichées</span></div></div>
              <div className="admin-table-wrap orders-table"><table><thead><tr><th>Commande</th><th>Client</th><th>Date</th><th>Total</th><th>Traitement</th><th>Paiement</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td><div className="customer-cell"><strong>{order.customerName}</strong><small>{order.customerPhone}</small></div></td><td>{formatDate(order.createdAt)}</td><td><strong>{formatPrice(order.total)}</strong></td><td><select className={`status-select ${order.status}`} value={order.status} onChange={(event) => void updateOrder(order.id, { status: event.target.value as ApiOrder['status'] })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><select className={`status-select ${order.paymentStatus}`} value={order.paymentStatus} onChange={(event) => void updateOrder(order.id, { paymentStatus: event.target.value as ApiOrder['paymentStatus'] })}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table>{orders.length === 0 && <div className="empty-admin-state large"><ShoppingBag size={28} /><p>Aucune commande n'a encore été enregistrée.</p></div>}</div>
            </section>
          )}
        </div>
      </main>

      {editingProduct !== undefined && <ProductEditor product={editingProduct} categories={categories} onClose={() => setEditingProduct(undefined)} onSave={saveProduct} onUpload={(file) => adminApi.uploadProductImage(token, file).then(({ imageUrl }) => imageUrl)} />}
    </div>
  )
}