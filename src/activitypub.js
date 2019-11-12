import fs from 'fs'
import path from 'path'
import express from 'express'
import uuid from 'uuid'
import url from 'url'
import morgan from 'morgan'
import request from 'superagent'
import crypto from 'crypto'
const { URL } = require('url')

const INBOX = []
const FOLLOWERS = {}
const POST_HEADERS = {
  'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
}
const GET_HEADERS = {
  'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
}
const PRIV_KEY = fs.readFileSync(path.resolve('data', 'private.pem'), 'utf8')
const PUB_KEY = fs.readFileSync(path.resolve('data', 'public.pem'), 'utf8')

const app = express()

app.use(morgan('dev'))

app.use(express.json({
  type: [
    'application/json',
    'application/ld+json',
    'application/activity+json'
  ]
}))

app.use((req, res, next) => {
  console.log(req.body)
  next()
})

app.use((req, res, next) => {
  req.publicHost = url.format({
    protocol: req.get('x-forwarded-proto') || req.protocol,
    host: req.get('x-forwarded-host') || req.get('host')
  })
  next()
})

app.get('/.well-known/webfinger', (req, res) => {
  const subject = req.query.resource
  const [,id,] = subject.split(/[:@]/)
  const resource = {
    'subject': subject,
    'links': [
      {
        'rel': 'self',
        'type': 'application/activity+json',
        'href': `${req.publicHost}/u/${id}`
      }
    ]
  }
  res.send(resource)
})

const getActor = (host, id) => ({
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1'
  ],
  'id': `${host}/u/${id}`,
  'type': 'Person',
  'preferredUsername': id,
  'inbox': `${host}/inbox`,
  'followers': `${host}/u/${id}/followers`,
  'publicKey': {
    'id': `${host}/u/${id}#main-key`,
    'owner': `${host}/u/${id}`,
    'publicKeyPem': PUB_KEY
  }
})

app.get('/u/:id', (req, res) => res.send(getActor(req.publicHost, req.params.id)))

const getFollowers = (host, id) => {
  const followers = FOLLOWERS[`${host}/u/${id}`] ? [...FOLLOWERS[`${host}/u/${id}`]] : []
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${host}/u/${id}/followers`,
    'type': 'Collection',
    'totalItems': followers.length,
    'items': followers
  }
}

app.get('/u/:id/followers', (req, res) => res.send(getFollowers(req.publicHost, req.params.id)))

const sendMessage = (from, to, message) => {
  const date = (new Date()).toUTCString()
  const { pathname, hostname } = new URL(to.inbox)
  const signer = crypto.createSign('SHA256')
  signer.update([
    `(request-target): post ${pathname}`,
    `host: ${hostname}`,
    `date: ${date}`
  ].join('\n'))
  signer.end()
  const signature = signer.sign(PRIV_KEY).toString('base64')
  const header = [
    `keyId="${from.id}#main-key"`,
    `headers="(request-target) host date"`,
    `signature="${signature}"`
  ].join(',')

  return request.post(to.inbox).send(message).set(POST_HEADERS).set({
    'Host': hostname,
    'Date': date,
    'Signature': header
  })
}

const verifyMessage = async headers => {
  const parts = headers['signature'].split(',').reduce((acc, curr) => {
    const [, key, value,] = curr.split(/^([^=]+)=(.+)$/)
    return Object.assign(acc, { [key]: value.slice(1, -1) })
  }, {})
  const compare = parts.headers.split(' ').map(header =>
    header === '(request-target)'
      ? '(request-target): post /inbox'
      : `${header}: ${headers[header]}`
  ).join('\n')
  const publicKey = (await request.get(parts.keyId).set(GET_HEADERS)).body.publicKey.publicKeyPem
  const verifier = crypto.createVerify(parts.algorithm.toUpperCase())
  verifier.update(compare)
  verifier.end()
  return verifier.verify(publicKey, Buffer.from(parts.signature, 'base64'))
}

app.post('/inbox', async (req, res) => {
  const action = req.body
  const verified = await verifyMessage(req.headers)

  if (!verified) {
    console.warn('Could not verify message')
    return res.send()
  }

  if (action.type !== 'Follow') {
    console.warn('Unhandled action type', action.type)
    return res.send()
  }

  // add actor to followers list
  FOLLOWERS[action.object] || (FOLLOWERS[action.object] = new Set())
  FOLLOWERS[action.object].add(action.actor)

  res.status(201).send()

  // send signed accept message to inbox of action.actor
  const { body: actor } = await request.get(action.actor).set(GET_HEADERS)
  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'actor': action.object,
    'id': `${req.publicHost}/${uuid.v4()}`,
    'object': action,
    'type': 'Accept'
  }

  try {
    const resp = await sendMessage({id: action.object}, actor, accept)
    console.log('SUCCESS', resp.status)
  } catch (e) {
    console.error('ERROR', e)
    FOLLOWERS[action.object].delete(action.actor)
    return res.status(500).send()
  }

})

app.listen(3000, function() {
  console.log('Inbox listening on port 3000!')
})
