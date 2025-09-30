import pkg from "whatsapp-web.js"
const { Client, LocalAuth, MessageMedia } = pkg
import qrcode from "qrcode-terminal"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { createPaymentLink } from "./mercadopago-service.js"
import { addPendingPayment } from "./payment-tracker.js"

// Configuração do admin
const ADMIN_NUMBER = "559285231368@c.us"

// Inicializar cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
})

// Carregar contas do arquivo
function loadAccounts() {
  if (existsSync("contas.json")) {
    return JSON.parse(readFileSync("contas.json", "utf-8"))
  }
  return []
}

// Salvar contas no arquivo
function saveAccounts(accounts) {
  writeFileSync("contas.json", JSON.stringify(accounts, null, 2))
}

// Estado temporário para adicionar contas
const addingAccount = new Map()

const waitingForStatus = new Map()

// QR Code para conectar
client.on("qr", (qr) => {
  console.log("\n🔐 Escaneie o QR Code abaixo com seu WhatsApp:\n")
  qrcode.generate(qr, { small: true })
  console.log("\n📱 Abra o WhatsApp > Configurações > Aparelhos conectados > Conectar aparelho\n")
})

// Quando conectar
client.on("ready", () => {
  console.log("✅ Bot conectado com sucesso!")
  console.log("🎮 Bot de Vendas Valorant está online!\n")
})

// Verificar se é admin
function isAdmin(from) {
  return from === ADMIN_NUMBER
}

// Formatar lista de contas
function formatAccountsList(accounts, showAll = false) {
  if (accounts.length === 0) {
    return "❌ Nenhuma conta disponível no momento."
  }

  let message = "🎮 *CONTAS VALORANT DISPONÍVEIS* 🎮\n\n"

  accounts.forEach((acc, index) => {
    message += `━━━━━━━━━━━━━━━━━━━\n`
    message += `📌 *ID:* ${acc.id}\n`
    message += `⭐ *ELO:* ${acc.elo}\n`
    message += `🔫 *Skins:* ${acc.skins}\n`
    message += `💰 *Preço:* R$ ${acc.price}\n`
    if (acc.image) {
      message += `📸 *Imagem:* Disponível\n`
    }

    if (showAll) {
      message += `📧 *Email:* ${acc.email || "Não informado"}\n`
      message += `🔑 *Senha:* ${acc.password || "Não informado"}\n`
    }

    if (acc.obs) {
      message += `📝 *Obs:* ${acc.obs}\n`
    }
    message += `━━━━━━━━━━━━━━━━━━━\n\n`
  })

  if (!showAll) {
    message += "\n💬 Para comprar, envie: *!comprar [ID]*\n"
    message += "Exemplo: !comprar 1"
  }

  return message
}

async function sendAccountDetails(chatId, account, showCredentials = false) {
  let message = "━━━━━━━━━━━━━━━━━━━\n"
  message += `📌 *ID:* ${account.id}\n`
  message += `⭐ *ELO:* ${account.elo}\n`
  message += `🔫 *Skins:* ${account.skins}\n`
  message += `💰 *Preço:* R$ ${account.price}\n`

  if (showCredentials) {
    message += `📧 *Email:* ${account.email || "Não informado"}\n`
    message += `🔑 *Senha:* ${account.password || "Não informado"}\n`
  }

  if (account.obs) {
    message += `📝 *Obs:* ${account.obs}\n`
  }
  message += `━━━━━━━━━━━━━━━━━━━`

  // Send image if available
  if (account.image) {
    try {
      const media = new MessageMedia(account.image.mimetype, account.image.data, `conta_${account.id}`)
      await client.sendMessage(chatId, media, { caption: message })
    } catch (error) {
      console.error("[v0] Error sending image:", error)
      await client.sendMessage(chatId, message + "\n\n⚠️ Erro ao carregar imagem")
    }
  } else {
    await client.sendMessage(chatId, message)
  }
}

// Processar mensagens
client.on("message", async (message) => {
  const from = message.from
  const body = message.body.trim()
  const isAdminUser = isAdmin(from)

  // Comando: !ajuda
  if (body.toLowerCase() === "!ajuda" || body.toLowerCase() === "!help") {
    let helpMessage = "📋 *COMANDOS DISPONÍVEIS*\n\n"
    helpMessage += "👥 *Para todos:*\n"
    helpMessage += "• !contas - Ver contas disponíveis\n"
    helpMessage += "• !comprar [ID] - Comprar uma conta\n"
    helpMessage += "• !ajuda - Ver este menu\n\n"

    if (isAdminUser) {
      helpMessage += "👑 *Admin apenas:*\n"
      helpMessage += "• !addconta - Adicionar nova conta\n"
      helpMessage += "• !addimagem [ID] - Adicionar imagem a uma conta\n"
      helpMessage += "• !removerconta [ID] - Remover conta\n"
      helpMessage += "• !listarcontas - Ver todas (com dados)\n"
      helpMessage += "• !broadcast - Enviar mídia para contatos\n"
    }

    await message.reply(helpMessage)
    return
  }

  // Comando: !contas (para todos)
  if (body.toLowerCase() === "!contas") {
    const accounts = loadAccounts()

    if (accounts.length === 0) {
      await message.reply("❌ Nenhuma conta disponível no momento.")
      return
    }

    await message.reply("🎮 *CONTAS VALORANT DISPONÍVEIS* 🎮\n\n")

    for (const account of accounts) {
      await sendAccountDetails(from, account, false)
      // Small delay to avoid spam detection
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    await client.sendMessage(from, "\n💬 Para comprar, envie: *!comprar [ID]*\nExemplo: !comprar 1")
    return
  }

  // Comando: !comprar [ID]
  if (body.toLowerCase().startsWith("!comprar")) {
    const accounts = loadAccounts()
    const parts = body.split(" ")

    if (parts.length < 2) {
      await message.reply("❌ Use: !comprar [ID]\nExemplo: !comprar 1")
      return
    }

    const accountId = Number.parseInt(parts[1])
    const account = accounts.find((acc) => acc.id === accountId)

    if (!account) {
      await message.reply("❌ Conta não encontrada! Use !contas para ver as disponíveis.")
      return
    }

    await message.reply("⏳ Gerando pagamento PIX...")

    const paymentResult = await createPaymentLink(account, from)

    if (!paymentResult.success) {
      await message.reply("❌ Erro ao gerar pagamento. Entre em contato com o vendedor:\nwa.me/5592999652961")
      return
    }

    addPendingPayment(account.id, from, paymentResult.paymentId, paymentResult.pixCode)

    await client.sendMessage(
      ADMIN_NUMBER,
      `🔔 *NOVA COMPRA INICIADA*\n\n` +
        `👤 Cliente: ${from.replace("@c.us", "")}\n` +
        `📌 Conta ID: ${account.id}\n` +
        `⭐ ELO: ${account.elo}\n` +
        `💰 Valor: R$ ${account.price}\n` +
        `🆔 Payment ID: ${paymentResult.paymentId}`,
    )

    await sendAccountDetails(from, account, false)

    let buyMessage = "\n✅ *PAGAMENTO PIX GERADO*\n\n"
    buyMessage += `🔐 *Pagamento 100% Seguro via PIX*\n\n`
    buyMessage += `⚠️ Após o pagamento ser aprovado, você receberá os dados da conta automaticamente!\n\n`
    buyMessage += `❓ Dúvidas? wa.me/5592999652961`

    await client.sendMessage(from, buyMessage)

    await client.sendMessage(
      from,
      `📋 *CÓDIGO PIX COPIA E COLA:*\n\n${paymentResult.pixCode}\n\n` +
        `👆 Copie o código acima e cole no seu app de pagamento\n\n` +
        `⏰ Aguardando pagamento...`,
    )

    const media = new MessageMedia("image/png", paymentResult.qrCodeBuffer.toString("base64"))
    await client.sendMessage(from, media, {
      caption:
        "📱 *QR CODE PIX*\n\n" +
        "Escaneie este QR Code com seu app de pagamento\n\n" +
        "✅ Pagamento instantâneo\n" +
        "🔒 100% seguro via Mercado Pago",
    })

    return
  }

  // ===== COMANDOS ADMIN =====
  if (!isAdminUser) return

  if (body.toLowerCase().startsWith("!addimagem")) {
    const parts = body.split(" ")

    if (parts.length < 2) {
      await message.reply("❌ Use: !addimagem [ID]\nExemplo: !addimagem 1")
      return
    }

    const accountId = Number.parseInt(parts[1])
    const accounts = loadAccounts()
    const account = accounts.find((acc) => acc.id === accountId)

    if (!account) {
      await message.reply("❌ Conta não encontrada!")
      return
    }

    addingAccount.set(from, { step: "image", accountId: accountId })
    await message.reply(
      `📸 *ADICIONAR IMAGEM À CONTA ${accountId}*\n\n` +
        `⭐ ELO: ${account.elo}\n\n` +
        `📤 Envie a *IMAGEM* da conta\n\n` +
        `⚠️ Formatos aceitos: JPG, PNG\n` +
        `💡 Envie "cancelar" para cancelar`,
    )
    return
  }

  if (body.toLowerCase() === "!broadcast") {
    waitingForStatus.set(from, { step: 1 })
    await message.reply(
      "📢 *ENVIAR MÍDIA EM BROADCAST*\n\n" +
        "⚠️ *IMPORTANTE:* O WhatsApp não permite bots enviarem status.\n" +
        "Esta função envia mídia em alta qualidade para contatos/grupos.\n\n" +
        "Passo 1/3\n" +
        "📤 Envie a *IMAGEM* ou *VÍDEO* que deseja enviar\n\n" +
        "⚠️ *Requisitos:*\n" +
        "• Imagens: JPG, PNG (alta qualidade)\n" +
        "• Vídeos: MP4, até 60 segundos\n" +
        "• Tamanho máximo: 16MB\n\n" +
        '💡 Envie "cancelar" para cancelar',
    )
    return
  }

  if (waitingForStatus.has(from)) {
    const state = waitingForStatus.get(from)

    if (body.toLowerCase() === "cancelar") {
      waitingForStatus.delete(from)
      await message.reply("❌ Broadcast cancelado.")
      return
    }
  }

  // Comando: !addconta (iniciar processo)
  if (body.toLowerCase() === "!addconta") {
    addingAccount.set(from, { step: 1 })
    await message.reply("➕ *ADICIONAR NOVA CONTA*\n\nPasso 1/7\n📝 Digite o *ELO* da conta:\nExemplo: Diamante 2")
    return
  }

  // Processo de adicionar conta
  if (addingAccount.has(from)) {
    const state = addingAccount.get(from)

    if (state.step === "image") {
      if (body.toLowerCase() === "cancelar") {
        addingAccount.delete(from)
        await message.reply("❌ Operação cancelada.")
        return
      }

      if (!message.hasMedia) {
        await message.reply("❌ Por favor, envie uma *imagem*\n\n" + '💡 Ou envie "cancelar" para cancelar')
        return
      }

      await message.reply("⏳ Processando imagem...")

      try {
        const media = await message.downloadMedia()

        if (!media || !media.mimetype.startsWith("image/")) {
          await message.reply("❌ Formato não suportado. Envie apenas imagens (JPG/PNG).")
          return
        }

        const accounts = loadAccounts()
        const accountIndex = accounts.findIndex((acc) => acc.id === state.accountId)

        if (accountIndex === -1) {
          await message.reply("❌ Conta não encontrada!")
          addingAccount.delete(from)
          return
        }

        accounts[accountIndex].image = {
          mimetype: media.mimetype,
          data: media.data,
        }

        saveAccounts(accounts)
        addingAccount.delete(from)

        await message.reply(
          `✅ *IMAGEM ADICIONADA COM SUCESSO!*\n\n` +
            `📌 Conta ID: ${state.accountId}\n` +
            `⭐ ELO: ${accounts[accountIndex].elo}`,
        )

        // Send preview
        await sendAccountDetails(from, accounts[accountIndex], true)
        return
      } catch (error) {
        console.error("[v0] Error processing image:", error)
        await message.reply("❌ Erro ao processar imagem. Tente novamente.")
        addingAccount.delete(from)
        return
      }
    }

    if (state.step === 1) {
      state.elo = body
      state.step = 2
      await message.reply(
        "Passo 2/7\n🔫 Digite as *SKINS* principais:\nExemplo: Reaver Vandal, Prime Phantom, Elderflame Operator",
      )
      return
    }

    if (state.step === 2) {
      state.skins = body
      state.step = 3
      await message.reply("Passo 3/7\n💰 Digite o *PREÇO*:\nExemplo: 150.00")
      return
    }

    if (state.step === 3) {
      state.price = body
      state.step = 4
      await message.reply('Passo 4/7\n📧 Digite o *EMAIL* da conta:\n(ou envie "pular" para adicionar depois)')
      return
    }

    if (state.step === 4) {
      state.email = body.toLowerCase() === "pular" ? "" : body
      state.step = 5
      await message.reply('Passo 5/7\n🔑 Digite a *SENHA* da conta:\n(ou envie "pular" para adicionar depois)')
      return
    }

    if (state.step === 5) {
      state.password = body.toLowerCase() === "pular" ? "" : body
      state.step = 6
      await message.reply('Passo 6/7\n📝 Digite *OBSERVAÇÕES* adicionais:\n(ou envie "pular" para continuar)')
      return
    }

    if (state.step === 6) {
      state.obs = body.toLowerCase() === "pular" ? "" : body
      state.step = 7
      await message.reply('Passo 7/7\n📸 Envie uma *IMAGEM* da conta:\n(ou envie "pular" para finalizar sem imagem)')
      return
    }

    if (state.step === 7) {
      let imageData = null

      if (body.toLowerCase() !== "pular") {
        if (!message.hasMedia) {
          await message.reply('❌ Por favor, envie uma *imagem* ou "pular" para continuar')
          return
        }

        await message.reply("⏳ Processando imagem...")

        try {
          const media = await message.downloadMedia()

          if (!media || !media.mimetype.startsWith("image/")) {
            await message.reply("❌ Formato não suportado. Envie apenas imagens (JPG/PNG).")
            return
          }

          imageData = {
            mimetype: media.mimetype,
            data: media.data,
          }
        } catch (error) {
          console.error("[v0] Error processing image:", error)
          await message.reply("❌ Erro ao processar imagem. Conta será salva sem imagem.")
        }
      }

      // Salvar conta
      const accounts = loadAccounts()
      const newId = accounts.length > 0 ? Math.max(...accounts.map((a) => a.id)) + 1 : 1

      const newAccount = {
        id: newId,
        elo: state.elo,
        skins: state.skins,
        price: state.price,
        email: state.email,
        password: state.password,
        obs: state.obs,
        addedAt: new Date().toISOString(),
      }

      if (imageData) {
        newAccount.image = imageData
      }

      accounts.push(newAccount)
      saveAccounts(accounts)
      addingAccount.delete(from)

      await message.reply("✅ *CONTA ADICIONADA COM SUCESSO!*\n")

      await sendAccountDetails(from, newAccount, true)
      return
    }
  }

  // Comando: !listarcontas (admin - mostra tudo)
  if (body.toLowerCase() === "!listarcontas") {
    const accounts = loadAccounts()

    if (accounts.length === 0) {
      await message.reply("❌ Nenhuma conta disponível no momento.")
      return
    }

    await message.reply("🎮 *TODAS AS CONTAS* 🎮\n\n")

    for (const account of accounts) {
      await sendAccountDetails(from, account, true)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return
  }

  // Comando: !removerconta [ID]
  if (body.toLowerCase().startsWith("!removerconta")) {
    const parts = body.split(" ")

    if (parts.length < 2) {
      await message.reply("❌ Use: !removerconta [ID]\nExemplo: !removerconta 1")
      return
    }

    const accountId = Number.parseInt(parts[1])
    const accounts = loadAccounts()
    const accountIndex = accounts.findIndex((acc) => acc.id === accountId)

    if (accountIndex === -1) {
      await message.reply("❌ Conta não encontrada!")
      return
    }

    const removedAccount = accounts[accountIndex]
    accounts.splice(accountIndex, 1)
    saveAccounts(accounts)

    await message.reply(`✅ Conta removida com sucesso!\n\n📌 ID: ${removedAccount.id}\n⭐ ELO: ${removedAccount.elo}`)
    return
  }
})

// Função para enviar mídia em broadcast
async function sendBroadcastMedia(media, caption, recipients) {
  try {
    console.log("[v0] Attempting to send broadcast...")
    console.log("[v0] Media type:", media.mimetype)
    console.log("[v0] Caption:", caption || "(no caption)")
    console.log("[v0] Recipients:", recipients.length)

    const results = []

    for (const recipient of recipients) {
      try {
        await client.sendMessage(recipient, media, {
          caption: caption || undefined,
        })
        results.push({ recipient, success: true })
        console.log(`[v0] Sent to ${recipient}`)
      } catch (error) {
        console.error(`[v0] Failed to send to ${recipient}:`, error.message)
        results.push({ recipient, success: false, error: error.message })
      }
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`[v0] Broadcast complete: ${successCount}/${recipients.length} sent`)

    return { success: true, results, successCount, totalCount: recipients.length }
  } catch (error) {
    console.error("[v0] Error sending broadcast:", error)
    return { success: false, error: error.message }
  }
}

// Inicializar bot
console.log("🚀 Iniciando bot...\n")
client.initialize()
