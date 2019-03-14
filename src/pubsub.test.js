import request from 'supertest'
import http from 'http'
import querystring from 'querystring'
import pubsub from './pubsub'

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
      'hub.callback': `/foo`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    const subscriptionRespone = await request(pubsub).post('/hub').send(parameters)
    expect(subscriptionRespone.statusCode).toBe(202)
  })

  test('requests callback URL to verify subscription', async (done) => {
    const callbackServer = http.createServer((req, res) => {
      const [ path, query ] = req.url.split('?')
      const challenge = querystring.parse(query)['hub.challenge']
      expect(path).toBe('/callback')
      expect(challenge).toBeDefined()
      res.end(challenge, 'utf-8')
      callbackServer.close(() => done())
    }).listen(0)

    const parameters = Object.entries({
      'hub.callback': `http://localhost:${callbackServer.address().port}/callback`,
      'hub.mode': 'subscribe',
      'hub.topic': 'https://lobid.org/gnd/118696432'
    }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&')
    await request(pubsub).post('/hub').send(parameters)
  })
})
