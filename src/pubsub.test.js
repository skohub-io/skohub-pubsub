import request from 'supertest'
import http from 'http'
import querystring from 'querystring'
import pubsub from './pubsub'

const callbackServer = http.createServer()
beforeAll((done) => callbackServer.listen(0, done))
afterAll((done) => callbackServer.close(done))

describe('Test LDN inboxes', () => {
  test('requires target', async () => {
    const response = await request(pubsub).get('/inbox')
    expect(response.statusCode).toBe(400)
  })

  test('has an inbox for a target', async () => {
    const response = await request(pubsub).get('/inbox')
      .query({ target: 'https://lobid.org/gnd/118696432' })
    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.body).length).toBeGreaterThan(0)
  })

  test('accepts notifications for a target', async () => {
    const response = await request(pubsub).post('/inbox')
      .query({ target: 'https://lobid.org/gnd/118696432' })
      .set('Content-Type', 'application/ld+json')
      .send({ foo: 'bar' })
    expect(response.statusCode).toBe(202)
  })
})

describe('Test WebSub subscriptions', () => {
  test('accepts subscription request for a topic', async () => {
    const parameters = Object.entries({
      'hub.callback': `/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    const subscriptionRespone = await request(pubsub).post('/hub').send(parameters)
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
    await request(pubsub).post('/hub').send(parameters)
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
        req.on('data', chunk => expect(JSON.parse(chunk)).toEqual(notification))
        req.on('end', done)
        res.end()
        callbackServer.removeListener('request', notificationCallback)
      }
    }
    callbackServer.on('request', notificationCallback)

    const parameters = {
      'hub.callback': `http://localhost:${callbackServer.address().port}/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }
    const query = Object.entries(parameters)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    await request(pubsub).post('/hub').send(query)

    setTimeout(async () => {
      await request(pubsub).post('/inbox')
        .query({ target: 'https://lobid.org/gnd/118696432' })
        .set('Content-Type', 'application/ld+json')
        .send(notification)
    }, 0)
  })
})
