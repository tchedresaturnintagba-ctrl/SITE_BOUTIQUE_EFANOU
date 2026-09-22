import { config } from '../config.js'

type OrderNotification = {
  orderNumber: string
  total: number
  customerName: string
  customerPhone: string
  paymentMethod: string
  items: { name: string; quantity: number }[]
}

const PAYMENT_LABELS: Record<string, string> = {
  mixx_by_yas: 'Mixx by Yas',
  flooz: 'Flooz',
}

export async function sendOrderEmailNotification(order: OrderNotification) {
  if (!config.RESEND_API_KEY) {
    console.warn('Notification email ignorée : RESEND_API_KEY manquant.')
    return
  }

  const itemsList = order.items.map((item) => `<li>${item.quantity} x ${item.name}</li>`).join('')
  const html = `
    <h2>🛍️ Nouvelle commande ${order.orderNumber}</h2>
    <p><strong>Client :</strong> ${order.customerName} (${order.customerPhone})</p>
    <p><strong>Paiement :</strong> ${PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
    <p><strong>Total :</strong> ${order.total.toLocaleString('fr-FR')} FCFA</p>
    <ul>${itemsList}</ul>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.RESEND_FROM_EMAIL,
        to: config.ADMIN_NOTIFICATION_EMAIL,
        subject: `Nouvelle commande ${order.orderNumber}`,
        html,
      }),
    })

    if (!response.ok) {
      console.error('Échec de l’envoi de l’email de notification :', response.status, await response.text())
    }
  } catch (error) {
    console.error('Échec de l’envoi de l’email de notification :', error)
  }
}
