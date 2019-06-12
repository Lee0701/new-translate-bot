require('dotenv').config()

const http = require('http')
const Telegraf = require('telegraf')

const emojiFlags = require('emoji-flags')

const bot = new Telegraf(process.env.TOKEN)

const google = require('./translators/google-translator.js')
const papago = require('./translators/papago-translator.js')
const baidu = require('./translators/baidu-translator.js')

const modes = {
    "google": google,
    "papago": papago,
    "baidu": baidu,
}

let groups = {}
let history = {}

bot.command('atr', (ctx) => {
    const args = (ctx.update.message.text || '').split(/\s+/).slice(1)
    if(args.length >= 1) {
        if(args[0] == 'reload') {
            ctx.getChat().then(chat => {
                groups[chat.id] = parseConfig(chat.description)
                ctx.reply('Reloaded config.')
            })
        }
    }
})

bot.on('text', (ctx) => {
    const msg = ctx.message
    if(msg.text.startsWith('/')) return
    if(msg.text.startsWith('^')) return

    const callback = (result) => sendTranslatedMessage(ctx, result)

    if(!groups[msg.chat.id]) {
        ctx.getChat().then(chat => {
            groups[msg.chat.id] = parseConfig(chat.description)
            translate(msg, callback)
        })
    } else {
        translate(msg, callback)
    }
})

bot.on('edited_message', (ctx) => {
    const msg = ctx.editedMessage
    const key = getHistoryKey(msg)
    if(history[key]) {
        translate(msg, (result) => {
            bot.telegram.editMessageText(msg.chat.id, history[key], null, result)
        })
    }
})

bot.catch((err) => console.error(err))

bot.launch()

const parseConfig = (configText) => (configText || '').split('\n').filter((line) => line.startsWith('@tr ')).map((line) => line.slice(4).split(' '))

const translate = (msg, callback) => {
    const translatedMessages = {}
    const configs = groups[msg.chat.id]
    configs.forEach((config) => {
    const toLang = config[0]
        try {
            modes[config[1]](msg.text, 'auto', toLang, (result) => {
                translatedMessages[toLang] = (result == msg.text) ? '' : result
                if(configs.every(c => translatedMessages[c[0]] !== undefined)) callback(formatMessage(msg, configs.map(c => [c[0], translatedMessages[c[0]]])))
            })
        } catch(e) {
            translatedMessages[toLang] = ''
        }
    })
}

const formatName = (from) => from.first_name + (from.last_name ? ' ' + from.last_name : '')

const formatMessage = (msg, messages) => {
    return formatName(msg.from) + ': ' + messages.filter((entry) => entry[1] != '').map(entry => emojiFlags.countryCode(entry[0].split('_')[1]).emoji + ' ' + entry[1]).join(' ')
}
  
const sendTranslatedMessage = (ctx, translated) => {
    ctx.telegram.sendMessage(ctx.chat.id, translated).then(sent => {
        const key = getHistoryKey(ctx.message)
        history[key] = sent.message_id
        setTimeout(() => {
            delete history[key]
        }, 5*60*1000)
    })
}
  
const getHistoryKey = (msg) => msg.chat.id + '/' + msg.message_id
