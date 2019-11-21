import fs from 'fs'
import path from 'path'
import express from 'express'
import uuid from 'uuid'
import url from 'url'
import morgan from 'morgan'
import request from 'superagent'
import crypto from 'crypto'
import cors from 'cors'
const { URL } = require('url')

const POST_HEADERS = {
  'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
}
const GET_HEADERS = {
  'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
}
const FOLLOWERS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve('data', 'followers.json'), 'utf8'))
  } catch (e) {
    return {}
  }
})()
const MESSAGES = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve('data', 'messages.json'), 'utf8'))
  } catch (e) {
    return {}
  }
})()

const PRIV_KEY = (() => {
  try {
    return fs.readFileSync(path.resolve('data', 'private.pem'), 'utf8')
  } catch (e) {
    return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  }
})()

const ACTIVITY_TYPES = [
  'Accept', 'Add', 'Announce', 'Arrive', 'Block', 'Create', 'Delete', 'Dislike', 'Flag', 'Follow',
  'Ignore', 'Invite', 'Join', 'Leave', 'Like', 'Listen', 'Move', 'Offer', 'Question', 'Reject',
  'Read', 'Remove', 'TentativeReject', 'TentativeAccept', 'Travel', 'Undo', 'Update', 'View'
]

const activitypub = express()

activitypub.use(morgan('dev'))

activitypub.use(cors())

activitypub.use(express.json({
  type: [
    'application/json',
    'application/ld+json',
    'application/activity+json'
  ]
}))

activitypub.use((req, res, next) => {
  console.log(req.headers)
  console.log(req.body)
  next()
})

activitypub.use((req, res, next) => {
  req.publicHost = url.format({
    protocol: req.get('x-forwarded-proto') || req.protocol,
    host: req.get('x-forwarded-host') || req.get('host')
  })
  next()
})

activitypub.get('/.well-known/webfinger', (req, res) => {
  const subject = req.query.resource
  const [, id] = subject.split(/[:@]/)
  const resource = {
    'subject': subject,
    'links': [
      {
        'rel': 'self',
        'type': 'application/activity+json',
        'href': `${req.publicHost}/${Buffer.from(id, 'hex').toString()}`
      }
    ]
  }
  res.send(resource)
})

const getFollowers = (host, id) => {
  const followers = FOLLOWERS[`${host}/${id}`] || []
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${host}/followers?subject=${id}`,
    'type': 'Collection',
    'totalItems': followers.length,
    'items': followers
  }
}

activitypub.get('/followers', (req, res) => res.send(getFollowers(req.publicHost, req.query.subject)))

const getMessage = (host, id) => {
  return MESSAGES[`${host}/m/${id}`]
}

activitypub.get('/m/:id', (req, res) => res.send(getMessage(req.publicHost, req.params.id)))

const sendMessage = async (from, to, message) => {
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

  const response = await request.post(to.inbox).send(message).set(POST_HEADERS).set({
    'Host': hostname,
    'Date': date,
    'Signature': header
  })
  return response
}

const saveMessage = message => {
  MESSAGES[message.id] = message
  fs.writeFileSync(
    path.resolve('data', 'messages.json'),
    JSON.stringify(MESSAGES, null, 2),
    'utf8'
  )
}

const verifyMessage = async headers => {
  const parts = headers['signature'].split(',').reduce((acc, curr) => {
    const [, key, value] = curr.split(/^([^=]+)=(.+)$/)
    return Object.assign(acc, { [key]: value.slice(1, -1) })
  }, {})
  const compare = parts.headers.split(' ').map(header => {
    if (header === '(request-target)') {
      return '(request-target): post /inbox'
    } else if (headers['x-forwarded-host'] && header === 'host') {
      return `host: ${headers['x-forwarded-host']}`
    } else {
      return `${header}: ${headers[header]}`
    }
  }).join('\n')
  const publicKey = (await request.get(parts.keyId).set(GET_HEADERS)).body.publicKey.publicKeyPem
  const verifier = crypto.createVerify(parts.algorithm.toUpperCase())
  verifier.update(compare)
  verifier.end()
  return verifier.verify(publicKey, Buffer.from(parts.signature, 'base64'))
}

const handleFollowAction = async (req, res) => {
  const action = req.body

  // add actor to followers list
  FOLLOWERS[action.object] || (FOLLOWERS[action.object] = [])
  FOLLOWERS[action.object].includes(action.actor) || FOLLOWERS[action.object].push(action.actor)
  fs.writeFileSync(
    path.resolve('data', 'followers.json'),
    JSON.stringify(FOLLOWERS, null, 2),
    'utf8'
  )

  // send signed accept message to inbox of action.actor
  const { body: actor } = await request.get(action.actor).set(GET_HEADERS)
  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'actor': action.object,
    'id': `${req.publicHost}/m/${uuid.v4()}`,
    'object': action,
    'type': 'Accept'
  }

  try {
    sendMessage({ id: action.object }, actor, accept)
    saveMessage(accept)
  } catch (e) {
    console.error('ERROR', e)
    FOLLOWERS[action.object].delete(action.actor)
  }
}

const handleUndoAction = (req, res) => {
  const undoneAction = req.body.object

  if (undoneAction.type !== 'Follow') {
    console.warn('Unhandled undo action type', undoneAction.type)
    return res.status(400).send()
  }

  if (FOLLOWERS[undoneAction.object]) {
    FOLLOWERS[undoneAction.object] = FOLLOWERS[undoneAction.object]
      .filter(follower => follower !== undoneAction.actor)
    fs.writeFileSync(
      path.resolve('data', 'followers.json'),
      JSON.stringify(FOLLOWERS, null, 2),
      'utf8'
    )
  }
}

const handleAction = async (req, res) => {
  const action = req.body

  if (!(await verifyMessage(req.headers))) {
    console.warn('Could not verify action')
    return res.status(400).send()
  }

  switch (action.type) {
    case 'Follow':
      handleFollowAction(req, res)
      break
    case 'Undo':
      handleUndoAction(req, res)
      break
    default:
      console.warn('Unhandled action type', action.type)
      return res.status(400).send()
  }

  res.status(201).send()
}

const handleNotification = (req, res) => {
  const actor = { id: `${req.publicHost}/${req.query.actor}` }
  const followers = getFollowers(req.publicHost, req.query.actor).items
  const notification = req.body
  const create = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${req.publicHost}/m/${uuid.v4()}`,
    'type': 'Create',
    'actor': actor.id,
    'to': ['https://www.w3.org/ns/activitystreams#Public'],
    'cc': followers,
    'object': {
      'id': `${req.publicHost}/m/${uuid.v4()}`,
      'type': 'Note',
      'name': notification.name,
      'url': notification.id,
      'content': notification.description,
      'attachment': notification
    }
  }
  followers.forEach(async followerId => {
    const { body: follower } = await request.get(followerId).set(GET_HEADERS)
    try {
      sendMessage(actor, follower, create)
      saveMessage(create.object)
      saveMessage(create)
    } catch (e) {
      console.error('ERROR', e)
    }
  })
  res.status(201).send()
}

activitypub.post('/inbox', (req, res) => {
  const { type } = req.body
  if (ACTIVITY_TYPES.includes(type)) {
    handleAction(req, res)
  } else {
    handleNotification(req, res)
  }
})

activitypub.get('/inbox', (req, res) => {
  const { actor } = req.query
  const id = `${req.publicHost}/${req.query.actor}`
  const messages = Object.values(MESSAGES)
    .filter(message => message.type === 'Create' && message.actor === id)
    .map(message => message.object)
  res.send({
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${req.publicHost}/inbox?actor=${actor}`,
    'type': 'Collection',
    'totalItems': messages.length,
    'items': messages
  })
})

export default activitypub
