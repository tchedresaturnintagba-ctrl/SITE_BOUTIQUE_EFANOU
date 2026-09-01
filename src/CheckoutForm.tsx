import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, LoaderCircle, TriangleAlert } from 'lucide-react'
import { storefrontApi } from './api'

type CheckoutItem = { id: string; quantity: number }

export default function CheckoutForm({ items, onBack, onSuccess }: {
  items: CheckoutItem[]
  onBack: () => void
  onSuccess: (orderNumber: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orderNumber, setOrderNumber] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)

    try {
      const result = await storefrontApi.createOrder({
        customerName: String(form.get('customerName')),
        customerEmail: String(form.get('customerEmail')),
        customerPhone: String(form.get('customerPhone')),
        shippingAddress: {
          city: String(form.get('city')),
          commune: String(form.get('commune')),
          address: String(form.get('address')),
          landmark: String(form.get('landmark')),
        },
        paymentMethod: String(form.get('paymentMethod')) as 'mobile_money' | 'card' | 'cash_on_delivery',
        notes: String(form.get('notes')),
        items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
      })
      setOrderNumber(result.order.orderNumber)
      onSuccess(result.order.orderNumber)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer la commande.')
    } finally {
      setLoading(false)
    }
  }

  if (orderNumber) {
    return (
      <div className="checkout-success">
        <span><Check size={28} /></span>
        <h3>Commande enregistrée</h3>
        <p>Votre numéro de suivi est</p>
        <strong>{orderNumber}</strong>
        <small>Nous vous contacterons pour confirmer la livraison.</small>
      </div>
    )
  }

  return (
    <form className="checkout-form" onSubmit={submit}>
      <button className="checkout-back" type="button" onClick={onBack}><ArrowLeft size={16} /> Retour au panier</button>
      {error && <div className="checkout-error"><TriangleAlert size={17} /><span>{error}</span></div>}
      <fieldset>
        <legend>Vos coordonnées</legend>
        <label>Nom complet<input name="customerName" autoComplete="name" minLength={2} required /></label>
        <div className="checkout-row">
          <label>Téléphone<input name="customerPhone" type="tel" autoComplete="tel" minLength={8} required /></label>
          <label>E-mail <small>facultatif</small><input name="customerEmail" type="email" autoComplete="email" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Adresse de livraison</legend>
        <div className="checkout-row">
          <label>Ville<input name="city" defaultValue="Abidjan" required /></label>
          <label>Commune<input name="commune" required /></label>
        </div>
        <label>Adresse complète<textarea name="address" rows={3} minLength={5} required /></label>
        <label>Point de repère <small>facultatif</small><input name="landmark" /></label>
      </fieldset>
      <fieldset>
        <legend>Paiement</legend>
        <label className="checkout-radio"><input type="radio" name="paymentMethod" value="mobile_money" defaultChecked /><span><strong>Mobile Money</strong><small>Orange, MTN, Moov ou Wave</small></span></label>
        <label className="checkout-radio"><input type="radio" name="paymentMethod" value="cash_on_delivery" /><span><strong>À la livraison</strong><small>Paiement remis au livreur</small></span></label>
      </fieldset>
      <label>Note <small>facultatif</small><textarea name="notes" rows={2} /></label>
      <button className="checkout-submit" type="submit" disabled={loading}>
        {loading ? <><LoaderCircle className="spinning" size={18} /> Enregistrement...</> : 'Confirmer la commande'}
      </button>
      <p className="checkout-privacy">Vos données servent uniquement au traitement de cette commande.</p>
    </form>
  )
}