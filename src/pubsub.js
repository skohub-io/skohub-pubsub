import express from 'express'
import request from 'superagent'
import crypto from 'crypto'
import parseLinkHeader from 'parse-link-header'
import WebSocket from 'ws'
import url from 'url'
import contentType from 'content-type'

const DEFAULT_LEASE = 7
const LDP_INBOX = 'http://www.w3.org/ns/ldp#inbox'

const validateTarget = async (publicHost, target) => {
  if (!target) {
    throw new Error('Target required')
  }
  const linkHeaderResponse = await request.get(target)
  const linkHeader = parseLinkHeader(linkHeaderResponse.headers.link)
  if (
    !linkHeader ||
    !linkHeader[LDP_INBOX] ||
    linkHeader[LDP_INBOX].url !== `${publicHost}/inbox?target=${target}`
  ) {
    throw new Error('Invalid link headers for target URL')
  }
}

const validateRequest = async (publicHost, callback, mode, topic, lease = DEFAULT_LEASE) => {
  if (!callback || !/subscribe|unsubscribe/.test(mode) || !topic) {
    throw new Error('Invalid request')
  }
  const linkHeaderResponse = await request.get(topic)
  const linkHeader = parseLinkHeader(linkHeaderResponse.headers.link)
  if (
    !linkHeader ||
    !linkHeader.hub ||
    !linkHeader.self ||
    linkHeader.hub.url !== `${publicHost}/hub` ||
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

const pubsub = db => {
  const app = express()
  const webSubSubscriptions = db ? db.webSubSubscriptions : {}
  const webSocketSubscriptions = db ? db.webSocketSubscriptions : {}

  app.use(express.json({ type: ['application/ld+json', 'application/json'] }))
  app.use(express.urlencoded({ extended: true }))

  app.use((req, res, next) => {
    req.publicHost = url.format({
      protocol: req.get('x-forwarded-proto') || req.protocol,
      host: req.get('x-forwarded-host') || req.get('host')
    })
    next()
  })

  app.get('/inbox', async (req, res) => {
    try {
      await validateTarget(req.publicHost, req.query.target)
    } catch (e) {
      return res.status(400).send(e.message)
    }
    res.header('Content-Type', 'application/ld+json')
    res.status(200).send({
      '@context': 'http://www.w3.org/ns/ldp',
      '@id': `${req.publicHost}${req.url}`,
      'contains': []
    })
  })

  app.options('/inbox', async (req, res) => {
    try {
      await validateTarget(req.publicHost, req.query.target)
    } catch (e) {
      return res.status(400).send(e.message)
    }
    res.header('Accept-Post', 'application/ld+json')
    res.status(200).send()
  })

  app.post('/inbox', async (req, res) => {
    const target = req.query.target
    const { type } = contentType.parse(req)
    try {
      if (type !== 'application/ld+json') {
        throw new Error('Invalid Content-Type')
      }
      await validateTarget(req.publicHost, target)
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

  app.post('/hub', async (req, res) => {
    if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
      return res.status(400).send('Unsupported Content-Type')
    }

    const {
      'hub.callback': callback,
      'hub.mode': mode,
      'hub.topic': topic,
      'hub.lease_seconds': lease
    } = req.body

    try {
      await validateRequest(req.publicHost, callback, mode, topic, lease)
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
    req.publicHost = url.format({
      protocol: req.headers['x-forwarded-proto'] || req.protocol || 'http',
      host: req.headers['x-forwarded-host'] || req.headers['host']
    })
    ws.on('message', async message => {
      const { mode, topic } = JSON.parse(message)
      const callback = notification => ws.send(notification)
      try {
        await validateRequest(req.publicHost, callback, mode, topic)
      } catch (e) {
        ws.send(JSON.stringify({ mode: 'reject', topic }))
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
  app.wss = wss

  return app
}

export default pubsub
