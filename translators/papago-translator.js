
const request = require('request')

const crypto = require('crypto')
const {v4: uuidv4} = require('uuid')

const BASE_URL = 'https://papago.naver.com/apis/n2mt/translate'

let uuid = null
let key = ''

const updateKey = () => {
  key = process.env.PAPAGO_VERSION || 'v1.5.1_4dfe1d83c2'
  uuid = uuidv4()
}

module.exports = function(text, fromLang, language, callback) {
  const from = fromLang === 'zh_CN' ? 'zh-CN' : fromLang === 'zh_TW' || fromLang === 'zh_HK' ? 'zh-TW' : fromLang.split('_')[0]
  const to = language === 'zh_CN' ? 'zh-CN' : language === 'zh_TW' || language === 'zh_HK' ? 'zh-TW' : language.split('_')[0]

  const generateOptions = () => {
    const timestamp = new Date().getTime()
    const hmac = crypto.createHmac('md5', key)
    hmac.update(`${uuid}\n${BASE_URL}\n${timestamp}`)
    const token = hmac.digest('base64')
    const authorization = `PPG ${uuid}:${token}`
    const data = `source=${from}&target=${to}&text=` + encodeURIComponent(text)
  
    return {
      url: BASE_URL,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Authorization': authorization,
        'Timestamp': timestamp,
      },
      body: data,
    }
  }

  request(generateOptions(), (err, res, body) => {
    if(err) {
      console.error(err)
      callback(undefined)
    }
    else if(res.statusCode === 403) {
      updateKey()
      request(generateOptions(), (err, res, body) => {
        if(err) {
          console.error(err)
          callback(undefined)
        }
        else if(res.statusCode !== 200) callback(res.statusCode)
        else callback(JSON.parse(body).translatedText)
      })
    }
    else callback(JSON.parse(body).translatedText)
  })

}
