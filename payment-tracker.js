import { readFileSync, writeFileSync, existsSync } from "fs"

const PAYMENTS_FILE = "pagamentos.json"

// Carregar pagamentos
export function loadPayments() {
  if (existsSync(PAYMENTS_FILE)) {
    return JSON.parse(readFileSync(PAYMENTS_FILE, "utf-8"))
  }
  return []
}

// Salvar pagamentos
export function savePayments(payments) {
  writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2))
}

// Adicionar novo pagamento pendente
export function addPendingPayment(accountId, buyerPhone, preferenceId, paymentLink) {
  const payments = loadPayments()
  const newPayment = {
    id: Date.now(),
    accountId,
    buyerPhone,
    preferenceId,
    paymentLink,
    status: "pending",
    createdAt: new Date().toISOString(),
  }
  payments.push(newPayment)
  savePayments(payments)
  return newPayment
}

// Atualizar status do pagamento
export function updatePaymentStatus(preferenceId, status) {
  const payments = loadPayments()
  const payment = payments.find((p) => p.preferenceId === preferenceId)
  if (payment) {
    payment.status = status
    payment.updatedAt = new Date().toISOString()
    savePayments(payments)
    return payment
  }
  return null
}

// Buscar pagamentos pendentes de um usuário
export function getPendingPayments(buyerPhone) {
  const payments = loadPayments()
  return payments.filter((p) => p.buyerPhone === buyerPhone && p.status === "pending")
}
