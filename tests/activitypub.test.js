import request from 'supertest'
import nock from 'nock'
import data from './data.json'
import activitypub from '../src/activitypub'

let server
beforeEach(done => (server = activitypub.listen(0, '127.0.0.1', () => done())))
afterEach(done => server.close(done))

describe('Webfinger', () => {
  const actor = 'literarymachine/skos/w3id.org/class/hochschulfaecher/B56'
  const wfuser = Buffer.from(actor).toString('hex')

  test('returns correct link for valid webfinger user', async () => {
    const { address, port } = server.address()
    const response = await request.agent(server).get('/.well-known/webfinger')
      .query({ resource: `acct:${wfuser}@${address}:${port}` })

    expect(response.body).toEqual({
      subject: `acct:${wfuser}@${address}:${port}`,
      links: [{
        rel: 'self',
        type: 'application/activity+json',
        href: `http://${address}:${port}/${actor}`
      }]
    })
  })
})

describe('ActivityPub', () => {
  const timeout = async ms => new Promise(resolve => setTimeout(resolve, ms))
  nock('https://openbiblio.social:443')
    .get('/users/literarymachine')
    .reply(...data.get['/users/literarymachine'].reply)
    .persist()

  test('accepts valid follow requests', async (done) => {
    const acceptScope = nock('https://openbiblio.social:443')
      .post('/users/literarymachine/inbox')
      .reply(201)

    await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send(data.post['/inbox'].message)

    // confirm ACCEPT message confirming FOLLOW activity has been received
    await timeout(10)
    acceptScope.done()
    done()
  })

  test('distributes notifications to followers', async (done) => {
    const actor = 'literarymachine/skos/w3id.org/class/hochschulfaecher/B56'
    const acceptScope = nock('https://openbiblio.social:443')
      .post('/users/literarymachine/inbox')
      .reply(201)

    await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send(data.post['/inbox'].message)

    await timeout(10)
    acceptScope.done()

    const noteScope = nock('https://openbiblio.social:443')
      .post('/users/literarymachine/inbox')
      .reply(201)
    await request.agent(server).post('/inbox')
      .query({ actor })
      .set({
        'Content-type': 'application/json',
        'x-forwarded-host': 'test.skohub.io',
        'x-forwarded-proto': 'https'
      })
      .send({
        name: 'Hello, world',
        id: 'http://example.org',
        'description': 'Lorem ipsum dolor sit amet'
      })

    // confirm NOTE message has been received in inbox
    await timeout(10)
    noteScope.done()
    done()
  })

  test('unverified actions are rejected', async() => {
    const response = await request.agent(server).post('/inbox')
      .set(Object.assign({}, data.post['/inbox'].headers, {
        signature: "keyId=\"https://openbiblio.social/users/literarymachine#main-key\",algorithm=\"rsa-sha256\",headers=\"(request-target) host date digest content-type\",signature=\"foobar\""
      }))
      .send(data.post['/inbox'].message)
    expect(response.status).toBe(400)
  })

  test('unsupported actions are rejected', async() => {
    const response = await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send(Object.assign({}, data.post['/inbox'].message, { type: 'Add' }))
    expect(response.status).toBe(400)
  })

  test('new followers are added to followers list', async () => {
    const actor = 'literarymachine/skos/w3id.org/class/hochschulfaecher/B56'
    const acceptScope = nock('https://openbiblio.social:443')
      .post('/users/literarymachine/inbox')
      .reply(201)

    await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send(data.post['/inbox'].message)

    await timeout(10)
    acceptScope.done()

    const response = await request.agent(server).get('/followers')
      .set({
        'Content-type': 'application/json',
        'x-forwarded-host': 'test.skohub.io',
        'x-forwarded-proto': 'https'
      })
      .query({ subject: actor })

    expect(response.body.items).toEqual([
      'https://openbiblio.social/users/literarymachine'
    ])
  })

  test('undone followers are removed from followers list', async () => {
    const actor = 'literarymachine/skos/w3id.org/class/hochschulfaecher/B56'
    const acceptScope = nock('https://openbiblio.social:443')
      .post('/users/literarymachine/inbox')
      .reply(201)

    await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send(data.post['/inbox'].message)

    await timeout(10)
    acceptScope.done()

    await request.agent(server).post('/inbox')
      .set(data.post['/inbox'].headers)
      .send({
        type: 'Undo',
        object: data.post['/inbox'].message
      })

    const response = await request.agent(server).get('/followers')
      .set({
        'Content-type': 'application/json',
        'x-forwarded-host': 'test.skohub.io',
        'x-forwarded-proto': 'https'
      })
      .query({ subject: actor })

    expect(response.body.items).toEqual([

    ])
  })
})
