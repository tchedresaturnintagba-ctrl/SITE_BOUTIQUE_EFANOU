import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  Heart,
  Leaf,
  Menu,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import heroImage from '../WhatsApp Image 2026-07-24 at 07.57.53.jpeg'
import classicImage from '../WhatsApp Image 2026-07-24 at 07.57.53 (1).jpeg'
import familyImage from '../WhatsApp Image 2026-07-24 at 07.57.53 (2).jpeg'
import urbanImage from '../WhatsApp Image 2026-07-24 at 07.57.54.jpeg'
import compactImage from '../WhatsApp Image 2026-07-24 at 07.59.02.jpeg'
import deliveryImage from '../WhatsApp Image 2026-07-24 at 07.59.03.jpeg'
import picnicImage from '../WhatsApp Image 2026-07-24 at 07.59.43.jpeg'
import AdminApp from './admin/AdminApp'
import { storefrontApi } from './api'
import CheckoutForm from './CheckoutForm'
import './App.css'

type Category = 'Tous' | 'Repas' | 'Livraison' | 'Pique-nique'

type Product = {
  id: string
  name: string
  category: Exclude<Category, 'Tous'>
  price: number
  oldPrice?: number
  image: string
  badge?: string
  color: string
  colorHex: string
  description: string
}

type CartItem = Product & { quantity: number }

const products: Product[] = [
  { id: 'local-classic', name: 'Le Classique', category: 'Repas', price: 12500, oldPrice: 15000, image: classicImage, badge: 'Bestseller', color: 'Vert forêt', colorHex: '#315f3c', description: 'Format quotidien, doublure isolante et poche frontale pratique.' },
  { id: 'local-family', name: 'Le Familial', category: 'Pique-nique', price: 19000, image: familyImage, badge: 'Nouveau', color: 'Beige naturel', colorHex: '#cfb998', description: 'Un grand volume pour partager repas, boissons et goûters.' },
  { id: 'local-urban', name: "L'Urbain", category: 'Repas', price: 14500, image: urbanImage, color: 'Noir profond', colorHex: '#292b2c', description: 'Une silhouette sobre pensée pour le bureau et les déplacements.' },
  { id: 'local-compact', name: 'Le Compact', category: 'Repas', price: 9500, image: compactImage, badge: 'Petit prix', color: 'Bleu lagon', colorHex: '#58aab4', description: 'Léger et facile à porter, sans compromis sur la fraîcheur.' },
  { id: 'local-delivery', name: 'Le Coursier', category: 'Livraison', price: 28000, image: deliveryImage, color: 'Noir carbone', colorHex: '#292b2c', description: 'Maintien renforcé et grande capacité pour vos livraisons.' },
  { id: 'local-picnic', name: 'La Virée', category: 'Pique-nique', price: 22000, image: picnicImage, color: 'Orange solaire', colorHex: '#d9772b', description: 'Un sac généreux conçu pour les sorties et les longues journées.' },
]

const productImages: Record<string, string> = {
  classic: classicImage,
  family: familyImage,
  urban: urbanImage,
  compact: compactImage,
  delivery: deliveryImage,
  picnic: picnicImage,
}

const categories: Category[] = ['Tous', 'Repas', 'Livraison', 'Pique-nique']
const formatPrice = (price: number) => `${new Intl.NumberFormat('fr-FR').format(price)} FCFA`

function StorefrontApp() {
  const [category, setCategory] = useState<Category>('Tous')
  const [query, setQuery] = useState('')
  const [catalogue, setCatalogue] = useState(products)
  const [cart, setCart] = useState<CartItem[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const visibleProducts = catalogue.filter((product) =>
    (category === 'Tous' || product.category === category) &&
    product.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    let active = true
    storefrontApi.products()
      .then(({ products: apiProducts }) => {
        if (!active) return
        const nextProducts = apiProducts.flatMap((product) => {
          if (!['Repas', 'Livraison', 'Pique-nique'].includes(product.category)) return []
          return [{
            id: product.id,
            name: product.name,
            category: product.category as Exclude<Category, 'Tous'>,
            price: product.price,
            oldPrice: product.oldPrice ?? undefined,
            image: product.imageUrl || productImages[product.imageKey || ''] || heroImage,
            badge: product.badge ?? undefined,
            color: product.color,
            colorHex: product.colorHex,
            description: product.description,
          }]
        })
        if (nextProducts.length) setCatalogue(nextProducts)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    document.body.classList.toggle('no-scroll', cartOpen || menuOpen)
    return () => document.body.classList.remove('no-scroll')
  }, [cartOpen, menuOpen])

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }]
    })
    setNotice(`${product.name} ajouté au panier`)
  }

  const changeQuantity = (id: string, amount: number) => {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item)
      .filter((item) => item.quantity > 0),
    )
  }

  const closePanels = () => {
    setCartOpen(false)
    setMenuOpen(false)
    setCheckoutOpen(false)
  }

  return (
    <div className="site-shell">
      <div className="announcement">
        <p><Truck size={15} /> Livraison offerte à partir de 35 000 FCFA</p>
        <span>Abidjan & livraison nationale</span>
      </div>

      <header className="site-header">
        <a className="brand" href="#accueil" aria-label="Horizon Efanou, accueil">
          <span className="brand-main">Horizon <em>Efanou</em></span>
          <span className="brand-tagline">Fraîcheur · Style · Partout</span>
        </a>
        <nav className="desktop-nav" aria-label="Navigation principale">
          <a href="#boutique">Boutique</a>
          <a href="#histoire">Notre histoire</a>
          <a href="#engagements">Nos engagements</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="header-actions">
          <a className="icon-button desktop-only" href="#boutique" aria-label="Rechercher"><Search size={20} /></a>
          <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Ouvrir le panier, ${itemCount} article(s)`}>
            <ShoppingBag size={20} /><span className="desktop-only">Panier</span>
            {itemCount > 0 && <b>{itemCount}</b>}
          </button>
          <button className="icon-button menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu size={23} /></button>
        </div>
      </header>

      <main>
        <section className="hero-section" id="accueil">
          <img className="hero-image" src={heroImage} alt="Collection de sacs isothermes Horizon Efanou" />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow"><Snowflake size={16} /> Collection 2026</p>
            <h1>Le frais vous suit partout.</h1>
            <p className="hero-copy">Des sacs isothermes élégants, solides et pensés pour accompagner votre quotidien sous le soleil.</p>
            <a className="primary-button" href="#boutique">Découvrir la collection <ArrowRight size={18} /></a>
          </div>
          <div className="hero-note"><span>Jusqu'à</span><strong>8 h</strong><span>de fraîcheur</span></div>
        </section>

        <section className="promise-strip" aria-label="Nos garanties">
          <div><Snowflake size={21} /><span><strong>Fraîcheur longue durée</strong>Isolation multicouche</span></div>
          <div><ShieldCheck size={21} /><span><strong>Qualité sélectionnée</strong>Matériaux résistants</span></div>
          <div><PackageCheck size={21} /><span><strong>Livraison soignée</strong>Partout en Côte d'Ivoire</span></div>
        </section>

        <section className="shop-section" id="boutique">
          <div className="section-heading">
            <div><p className="eyebrow gold"><Sparkles size={15} /> Nos essentiels</p><h2>À chacun son sac</h2></div>
            <p>Du déjeuner au bureau aux grandes livraisons, choisissez le format qui suit votre rythme.</p>
          </div>
          <div className="shop-tools">
            <div className="category-tabs" role="group" aria-label="Filtrer par catégorie">
              {categories.map((item) => (
                <button className={category === item ? 'active' : ''} key={item} type="button" onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
            <label className="search-field"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un modèle" aria-label="Rechercher un modèle" /></label>
          </div>

          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image-wrap">
                  <img src={product.image} alt={`Sac isotherme ${product.name}`} />
                  {product.badge && <span className="product-badge">{product.badge}</span>}
                  <button className={`favorite-button ${favorites.includes(product.id) ? 'selected' : ''}`} type="button" onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} aria-label="Ajouter aux favoris">
                    <Heart size={19} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="product-info">
                  <p className="product-category">{product.category}</p>
                  <h3>{product.name}</h3>
                  <p className="product-description">{product.description}</p>
                  <p className="product-color"><span style={{ background: product.colorHex }} />{product.color}</p>
                  <div className="product-footer">
                    <p className="product-price"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</p>
                    <button className="add-button" type="button" onClick={() => addToCart(product)} aria-label={`Ajouter ${product.name} au panier`}><Plus size={20} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visibleProducts.length === 0 && (
            <div className="empty-results"><Search size={28} /><h3>Aucun modèle trouvé</h3><button type="button" onClick={() => { setQuery(''); setCategory('Tous') }}>Voir tous les sacs</button></div>
          )}
        </section>

        <section className="story-section" id="histoire">
          <div className="story-image-wrap"><img src={familyImage} alt="Sac isotherme Horizon Efanou prêt pour une sortie" /><span><Leaf size={17} /> Pensé pour durer</span></div>
          <div className="story-copy">
            <p className="eyebrow gold">L'esprit Horizon Efanou</p>
            <h2>Le pratique peut aussi être beau.</h2>
            <p>Horizon Efanou sélectionne des sacs isothermes utiles, élégants et adaptés à nos vies actives. Pour le bureau, l'école, le marché ou une échappée en famille, votre repas reste protégé avec style.</p>
            <div className="story-points" id="engagements">
              <span><Check size={17} /> Faciles à nettoyer</span>
              <span><Check size={17} /> Réutilisables au quotidien</span>
              <span><Check size={17} /> Formats pour tous les besoins</span>
            </div>
            <a className="text-link" href="#boutique">Trouver mon sac <ArrowRight size={17} /></a>
          </div>
        </section>

        <section className="newsletter" id="contact">
          <div><p className="eyebrow"><Sparkles size={15} /> Le cercle Efanou</p><h2>Un peu de fraîcheur dans votre boîte mail.</h2><p>Nouveautés, conseils et offres privées, sans surcharge.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); setNotice('Merci ! Votre inscription est enregistrée.'); event.currentTarget.reset() }}>
            <label><span className="sr-only">Votre adresse e-mail</span><input type="email" name="email" placeholder="Votre adresse e-mail" required /></label>
            <button type="submit">Je m'inscris <ArrowRight size={17} /></button>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <a className="brand light" href="#accueil"><span className="brand-main">Horizon <em>Efanou</em></span><span className="brand-tagline">Fraîcheur · Style · Partout</span></a>
          <p>Les sacs isothermes qui prennent soin de vos repas et de votre style.</p>
        </div>
        <div className="footer-column"><h3>Explorer</h3><a href="#boutique">La boutique</a><a href="#histoire">Notre histoire</a><a href="#engagements">Nos engagements</a></div>
        <div className="footer-column"><h3>Besoin d'aide ?</h3><a href="mailto:bonjour@horizon-efanou.com">Nous écrire</a><a href="#contact">Livraison & retours</a><a href="#contact">Questions fréquentes</a></div>
        <div className="footer-column"><h3>Nous retrouver</h3><a href="tel:+2250000000000"><Phone size={15} /> +225 00 00 00 00 00</a><a href="#contact">Instagram</a></div>
        <div className="footer-bottom"><span>© 2026 Horizon Efanou</span><span>Paiement sécurisé · Mobile Money · Carte bancaire</span></div>
      </footer>

      {(cartOpen || menuOpen) && <button className="page-overlay" type="button" aria-label="Fermer" onClick={closePanels} />}

      <aside className={`cart-drawer ${cartOpen ? 'open' : ''}`} aria-hidden={!cartOpen}>
        <div className="drawer-header"><div><p>{checkoutOpen ? 'Finaliser la commande' : 'Votre panier'}</p><span>{itemCount} article{itemCount > 1 ? 's' : ''}</span></div><button className="icon-button" type="button" onClick={closePanels} aria-label="Fermer le panier"><X size={22} /></button></div>
        <div className="drawer-content">
          {checkoutOpen ? (
            <CheckoutForm items={cart} onBack={() => setCheckoutOpen(false)} onSuccess={(orderNumber) => { setCart([]); setNotice(`Commande ${orderNumber} enregistrée`) }} />
          ) : cart.length === 0 ? (
            <div className="empty-cart"><ShoppingBag size={35} /><h3>Votre panier est vide</h3><p>Découvrez le sac qui accompagnera vos prochaines journées.</p><button type="button" onClick={() => setCartOpen(false)}>Voir la collection</button></div>
          ) : cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <img src={item.image} alt="" />
              <div className="cart-item-details"><div><h3>{item.name}</h3><p>{formatPrice(item.price)}</p></div><div className="quantity-control"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Retirer un article"><Minus size={14} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Ajouter un article"><Plus size={14} /></button></div></div>
              <button className="remove-button" type="button" onClick={() => setCart((current) => current.filter((product) => product.id !== item.id))} aria-label="Supprimer l'article"><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && !checkoutOpen && <div className="drawer-footer"><div><span>Sous-total</span><strong>{formatPrice(total)}</strong></div><p>Livraison calculée à l'étape suivante.</p><button type="button" onClick={() => setCheckoutOpen(true)}>Commander <ArrowRight size={18} /></button></div>}
      </aside>

      <aside className={`mobile-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="drawer-header"><span className="brand-main">Horizon <em>Efanou</em></span><button className="icon-button" type="button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X size={22} /></button></div>
        <nav>
          <a href="#boutique" onClick={() => setMenuOpen(false)}>Boutique <ArrowRight size={18} /></a>
          <a href="#histoire" onClick={() => setMenuOpen(false)}>Notre histoire <ArrowRight size={18} /></a>
          <a href="#engagements" onClick={() => setMenuOpen(false)}>Nos engagements <ArrowRight size={18} /></a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact <ArrowRight size={18} /></a>
        </nav>
        <div className="mobile-menu-note"><Phone size={18} /><span>Une question ?<strong>+225 00 00 00 00 00</strong></span></div>
      </aside>

      {notice && <div className="toast" role="status"><Check size={18} /> {notice}</div>}
    </div>
  )
}

function App() {
  return window.location.pathname.startsWith('/admin') ? <AdminApp /> : <StorefrontApp />
}

export default App