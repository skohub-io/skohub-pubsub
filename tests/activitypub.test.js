import request from 'supertest'
import nock from 'nock'
import data from './data.json'

nock('https://openbiblio.social:443')
  .get('/users/literarymachine')
  .reply(...data.get['/users/literarymachine'].reply)
  .persist()

import activitypub from '../src/activitypub'

let server
beforeEach(done => (server = activitypub.listen(0, '127.0.0.1', () => done())))
afterEach(done => server.close(done))

describe('Webfinger', () => {
  const path = 'literarymachine/skos/w3id.org/class/hochschulfaecher/B399'
  const wfuser = Buffer.from(path).toString('hex')

  test('returns correct link for valid webfinger user', async () => {
    const { address, port } = server.address()
    const response = await request.agent(server).get('/.well-known/webfinger')
      .query({ resource: `acct:${wfuser}@${address}:${port}` })

    expect(response.body).toEqual({
      subject: `acct:${wfuser}@${address}:${port}`,
      links: [{
        rel: 'self',
        type: 'application/activity+json',
        href: `http://${address}:${port}/${path}`
      }]
    })
  })
})

describe('ActivityPub', () => {
  test('accepts valid follow requests', async (done) => {
    const scope = nock('https://openbiblio.social:443')
      .post('/users/literarymachine/inbox')
      .reply(201)

    await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send(data.post['/inbox'].message)

    setTimeout(() => {
      scope.isDone() && done()
    }, 10)
  })
})
