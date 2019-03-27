import express from 'express'
import request from 'superagent'
import crypto from 'crypto'
import parseLinkHeader from 'parse-link-header'
import WebSocket from 'ws'

const DEFAULT_LEASE = 7
const LDP_INBOX = 'http://www.w3.org/ns/ldp#inbox'
const webSubSubscriptions = {}
const webSocketSubscriptions = {}

const pubsub = express()

pubsub.use(express.json({ type: ['application/ld+json', 'application/json'] }))
pubsub.use(express.urlencoded({ extended: true }))

const validateTarget = async target => {
  if (!target) {
    throw new Error('Target required')
  }
  const linkHeaderResponse = await request.get(target)
  const linkHeader = parseLinkHeader(linkHeaderResponse.headers.link)
  if (
    !linkHeader ||
    !linkHeader[LDP_INBOX] ||
    linkHeader[LDP_INBOX].url !== `http://localhost:3000/inbox?target=${target}`
  ) {
    throw new Error('Invalid link headers for target URL')
  }
}

pubsub.get('/inbox', async (req, res) => {
  try {
    await validateTarget(req.query.target)
  } catch (e) {
    return res.status(400).send(e.message)
  }
  res.status(200).send({
    '@context': 'http://www.w3.org/ns/ldp',
    '@id': `${req.protocol}://${req.get('host')}${req.url}`,
    'contains': []
  })
})

pubsub.post('/inbox', async (req, res) => {
  const target = req.query.target
  try {
    if (req.headers['content-type'] !== 'application/ld+json') {
      throw new Error('Invalid Content-Type')
    }
    await validateTarget(target)
  } catch (e) {
    return res.status(400).send(e.message)
  }

  res.status(202).send()

  Object.keys(webSubSubscriptions[target] || {}).forEach(callback => {
    request.post(callback).send(req.body).then(res => res, err => err)
  })
  Object.keys(webSocketSubscriptions[target] || {}).forEach(addr => {
    webSocketSubscriptions[target][addr](JSON.stringify({
      mode: 'notification',
      data: req.body
    }))
  })
})

const validateRequest = async (callback, mode, topic, lease = DEFAULT_LEASE) => {
  if (!callback || !/subscribe|unsubscribe/.test(mode) || !topic) {
    throw new Error('Invalid request')
  }
  const linkHeaderResponse = await request.get(topic)
  const linkHeader = parseLinkHeader(linkHeaderResponse.headers.link)
  if (
    !linkHeader ||
    !linkHeader.hub ||
    !linkHeader.self ||
    linkHeader.hub.url !== 'http://localhost:3000/hub' ||
    linkHeader.self.url !== topic
  ) {
    throw new Error('Invalid topic or hub URL')
  }
}

const verifyRequest = async (callback, mode, topic, lease = DEFAULT_LEASE) => {
  const challenge = crypto.randomBytes(64).toString('hex')
  const callbackResponse = await request.get(callback)
    .query(`hub.mode=${mode}`)
    .query(`hub.topic=${topic}`)
    .query(`hub.challenge=${challenge}`)
    .query(`hub.lease_seconds=${lease}`)

  if (callbackResponse.text !== challenge) {
    throw new Error('Invalid challenge in response')
  }
}

pubsub.post('/hub', async (req, res) => {
  if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
    return res.status(400).send()
  }

  const {
    'hub.callback': callback,
    'hub.mode': mode,
    'hub.topic': topic,
    'hub.lease_seconds': lease
  } = req.body

  try {
    await validateRequest(callback, mode, topic, lease)
  } catch (e) {
    return res.status(400).send(e.message)
  }

  res.status(202).send()

  try {
    await verifyRequest(callback, mode, topic, lease)
  } catch (e) {
    return // discard subscription request
  }

  if (mode === 'subscribe') {
    webSubSubscriptions[topic] = webSubSubscriptions[topic] || {}
    webSubSubscriptions[topic][callback] = lease
  } else {
    delete webSubSubscriptions[topic][callback]
  }
})

const wss = new WebSocket.Server({ noServer: true })
wss.on('connection', (ws, req) => {
  ws.on('message', async message => {
    const { mode, topic } = JSON.parse(message)
    const callback = notification => ws.send(notification)
    try {
      await validateRequest(callback, mode, topic)
    } catch (e) {
      return // discard subscription request
    }
    if (mode === 'subscribe') {
      webSocketSubscriptions[topic] = webSocketSubscriptions[topic] || {}
      webSocketSubscriptions[topic][req.connection.remoteAddress] = callback
      ws.send(JSON.stringify({ mode: 'confirm', topic }))
    } else {
      ws.close()
      delete webSocketSubscriptions[topic][req.connection.remoteAddress]
    }
  })
})

pubsub.wss = wss

export default pubsub
