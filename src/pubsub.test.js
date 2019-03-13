import request from 'supertest'
import pubsub from './pubsub'

describe('Test LDN inboxes', () => {
  test('requires target', async () => {
    const response = await request(pubsub).get('/inbox')
    console.log('CODE', response.statusCode)
    expect(response.statusCode).toBe(400)
  })

  test('has an inbox for a target', async () => {
    const response = await request(pubsub).get('/inbox').query({
      target: 'https://lobid.org/gnd/118696432'
    })
    expect(response.statusCode).toBe(200)
  })
})
