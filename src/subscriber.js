const http = require('http')
const querystring = require('querystring')
const request = require('superagent')

const callbackServer = http.createServer()

const verificationCallback = (req, res) => {
  if (req.method === 'GET') {
    const [ , query ] = req.url.split('?')
    const challenge = querystring.parse(query)['hub.challenge']
    res.end(challenge, 'utf-8')
  }
}
callbackServer.on('request', verificationCallback)

const notificationCallback = (req, res) => {
  if (req.method === 'POST') {
    const data = []
    req.on('data', chunk => data.push(chunk))
    req.on('end', () => console.log('received', Buffer.concat(data).toString()))
    res.end()
  }
}
callbackServer.on('request', notificationCallback)

if (process.argv.length !== 4) {
  console.error('Usage: node subscriber.js hub topic')
  process.exit(1)
}

callbackServer.listen(0, async () => {
  console.log('Subscriber listening', callbackServer.address())
  const { address, port } = callbackServer.address()
  const parameters = {
    'hub.callback': `http://${address}:${port}/callback`,
    'hub.mode': 'subscribe',
    'hub.topic': process.argv[3]
  }
  const query = Object.entries(parameters)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
  try {
    await request.post(process.argv[2]).send(query)
  } catch (e) {
    console.error('Could not connect to hub', process.argv[2])
    process.exit(1)
  }
})
