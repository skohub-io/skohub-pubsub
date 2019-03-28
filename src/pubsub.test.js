import request from 'supertest'
import http from 'http'
import querystring from 'querystring'
import nock from 'nock'
import WebSocket from 'ws'
import pubsub from './pubsub'

const callbackServer = http.createServer()
beforeAll(done => callbackServer.listen(0, done))
afterAll(done => callbackServer.close(done))

let pubsubServer
let pubsubApp
let linkHeaders = []
beforeEach(done => {
  pubsubApp = pubsub()
  pubsubServer = pubsubApp.listen(0, '127.0.0.1', () => {
    const { address, port } = pubsubServer.address()
    linkHeaders = [
      `<http://${address}:${port}/hub>; rel="hub"`,
      '<https://lobid.org/gnd/118696432>; rel="self"',
      `<http://${address}:${port}/inbox?target=https://lobid.org/gnd/118696432>; rel="http://www.w3.org/ns/ldp#inbox"`
    ]
    pubsubServer.on('upgrade', (req, socket, head) => {
      req.headers.host = `${address}:${port}`
      pubsubApp.wss.handleUpgrade(req, socket, head, ws => pubsubApp.wss.emit('connection', ws, req))
    })
    done()
  })
})
afterEach(done => pubsubServer.close(done))

// Mock request with valid link headers
nock('https://lobid.org')
  .persist()
  .get('/gnd/118696432')
  .reply(200, {}, { Link: () => linkHeaders.join(', ') })

// Mock request without link headers
nock('https://lobid.org')
  .persist()
  .get('/gnd/118520520')
  .reply(200, {})

describe('Test LDN inboxes', () => {
  test('requires target', async () => {
    const response = await request(pubsub()).get('/inbox')
    expect(response.statusCode).toBe(400)
  })

  test('has an inbox for a target', async () => {
    const response = await request.agent(pubsubServer).get('/inbox')
      .query({ target: 'https://lobid.org/gnd/118696432' })
    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.body).length).toBeGreaterThan(0)
  })

  test('accepts notifications for a target', async () => {
    const response = await request.agent(pubsubServer).post('/inbox')
      .query({ target: 'https://lobid.org/gnd/118696432' })
      .set('Content-Type', 'application/ld+json')
      .send({ foo: 'bar' })
    expect(response.statusCode).toBe(202)
  })

  test('rejects notifications for an invalid target', async () => {
    const response = await request.agent(pubsubServer).post('/inbox')
      .query({ target: 'https://lobid.org/gnd/118520520' })
      .set('Content-Type', 'application/ld+json')
      .send({ foo: 'bar' })
    expect(response.statusCode).toBe(400)
  })
})

describe('Test WebSub subscriptions', () => {
  test('accepts subscription request for a topic', async () => {
    const parameters = Object.entries({
      'hub.callback': `/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    const subscriptionRespone = await request.agent(pubsubServer).post('/hub')
      .send(parameters)
    expect(subscriptionRespone.statusCode).toBe(202)
  })

  test('requests callback URL to verify subscription', async (done) => {
    const verificationCallback = (req, res) => {
      const [ path, query ] = req.url.split('?')
      const challenge = querystring.parse(query)['hub.challenge']
      expect(path).toBe('/callback')
      expect(challenge).toBeDefined()
      res.end(challenge, 'utf-8')
      callbackServer.removeListener('request', verificationCallback)
      done()
    }
    callbackServer.on('request', verificationCallback)

    const parameters = Object.entries({
      'hub.callback': `http://localhost:${callbackServer.address().port}/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    await request.agent(pubsubServer).post('/hub').send(parameters)
  })

  test('receives notifications to callback URL', async (done) => {
    const verificationCallback = (req, res) => {
      if (req.method === 'GET') {
        const [ , query ] = req.url.split('?')
        const challenge = querystring.parse(query)['hub.challenge']
        res.end(challenge, 'utf-8')
        callbackServer.removeListener('request', verificationCallback)
      }
    }
    callbackServer.on('request', verificationCallback)

    const notification = { foo: 'bar' }
    const notificationCallback = (req, res) => {
      if (req.method === 'POST') {
        const data = []
        req.on('data', chunk => data.push(chunk))
        req.on('end', () => {
          expect(JSON.parse(Buffer.concat(data).toString())).toEqual(notification)
          done()
        })
        res.end()
        callbackServer.removeListener('request', notificationCallback)
      }
    }
    callbackServer.on('request', notificationCallback)

    const app = pubsub()
    const parameters = {
      'hub.callback': `http://localhost:${callbackServer.address().port}/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }
    const query = Object.entries(parameters)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    await request.agent(pubsubServer).post('/hub').send(query)

    setTimeout(async () => {
      await request.agent(pubsubServer).post('/inbox')
        .query({ target: 'https://lobid.org/gnd/118696432' })
        .set('Content-Type', 'application/ld+json')
        .send(notification)
    }, 0)
  })

  test('rejects subscription request for invalid topics', async () => {
    const parameters = Object.entries({
      'hub.callback': `/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118520520'
    }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    const subscriptionRespone = await request.agent(pubsubServer).post('/hub').send(parameters)
    expect(subscriptionRespone.statusCode).toBe(400)
  })

  test('rejects notifications for invalid targets', async () => {
    const response = await request.agent(pubsubServer).post('/inbox')
      .query({ target: 'https://lobid.org/gnd/118520520' })
      .set('Content-Type', 'application/ld+json')
      .send({ foo: 'bar' })
    expect(response.statusCode).toBe(400)
  })
})

describe('Test Websocket subscriptions', () => {
  test('accepts subscription requests for a topic', done => {
    const ws = new WebSocket(`http://localhost:${pubsubServer.address().port}`)
    ws.on('open', () => {
      ws.send(JSON.stringify({
        mode: 'subscribe',
        topic: 'https://lobid.org/gnd/118696432'
      }))
    })
    ws.on('message', message => {
      message = JSON.parse(message)
      expect(message.mode).toBe('confirm')
      expect(message.topic).toBe('https://lobid.org/gnd/118696432')
      ws.close()
      done()
    })
  })

  test('rejects subscription requests for an invalid topic', done => {
    const ws = new WebSocket(`http://localhost:${pubsubServer.address().port}`)
    ws.on('open', () => {
      ws.send(JSON.stringify({
        mode: 'subscribe',
        topic: 'https://lobid.org/gnd/118520520'
      }))
    })
    ws.on('message', message => {
      message = JSON.parse(message)
      expect(message.mode).toBe('reject')
      expect(message.topic).toBe('https://lobid.org/gnd/118520520')
      ws.close()
      done()
    })
  })

  test('receives notifications for subscribed topics', done => {
    const ws = new WebSocket(`http://localhost:${pubsubServer.address().port}`)
    const notification = { foo: 'bar' }
    ws.on('open', () => {
      ws.send(JSON.stringify({
        mode: 'subscribe',
        topic: 'https://lobid.org/gnd/118696432'
      }), async () => {
        await request.agent(pubsubServer).post('/inbox')
          .query({ target: 'https://lobid.org/gnd/118696432' })
          .set('Content-Type', 'application/ld+json')
          .send(notification)
      })
    })
    ws.on('message', message => {
      message = JSON.parse(message)
      if (message.mode === 'notification') {
        expect(message.data).toEqual(notification)
        ws.close()
        done()
      }
    })
  })
})
