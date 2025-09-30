import { MercadoPagoConfig, Payment } from "mercadopago"
import { MERCADO_PAGO_CONFIG } from "./config.js"
import QRCode from "qrcode"

// Inicializar cliente do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: MERCADO_PAGO_CONFIG.accessToken,
})

export async function createPaymentLink(account, buyerPhone) {
  try {
    const payment = new Payment(client)

    const body = {
      transaction_amount: Number.parseFloat(account.price),
      description: `Conta Valorant - ${account.elo} | Skins: ${account.skins}`,
      payment_method_id: "pix",
      payer: {
        email: "cliente@email.com",
        first_name: "Cliente",
        last_name: "Valorant",
        identification: {
          type: "CPF",
          number: "12345678909",
        },
      },
      notification_url: "https://seu-webhook-url.com/webhook",
      metadata: {
        account_id: account.id,
        buyer_phone: buyerPhone,
      },
    }

    const result = await payment.create({ body })

    // Extrair dados do PIX
    const pixCode = result.point_of_interaction?.transaction_data?.qr_code
    const pixBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64

    if (!pixCode) {
      throw new Error("Código PIX não gerado")
    }

    // Gerar QR Code como buffer de imagem
    const qrCodeBuffer = await QRCode.toBuffer(pixCode, {
      width: 400,
      margin: 2,
    })

    return {
      success: true,
      pixCode: pixCode,
      pixBase64: pixBase64,
      qrCodeBuffer: qrCodeBuffer,
      paymentId: result.id,
      expirationDate: result.date_of_expiration,
    }
  } catch (error) {
    console.error("[v0] Erro ao criar pagamento PIX:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}
