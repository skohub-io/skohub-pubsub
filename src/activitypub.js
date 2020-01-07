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

const activitypub = db => {
  const POST_HEADERS = {
    'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  }
  const GET_HEADERS = {
    'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  }
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

  const app = express()

  app.use(morgan('dev'))

  app.use(cors())

  app.use(express.json({
    type: [
      'application/json',
      'application/ld+json',
      'application/activity+json'
    ]
  }))

  app.use((req, res, next) => {
    console.log(req.headers)
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

  app.get('/followers', (req, res) => {
    const followers = db.getFollowers(`${req.publicHost}/${req.query.subject}`)
    res.send({
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `${req.publicHost}/followers?subject=${req.query.subject}`,
      'type': 'Collection',
      'totalItems': followers.length,
      'items': followers
    })
  })

  app.get('/m/:id', (req, res) => res.send(db.getMessage(`${req.publicHost}/m/${req.params.id}`)))

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
    db.addFollower(action.object, action.actor)

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
      db.saveMessage(accept)
    } catch (e) {
      console.error('ERROR', e)
      db.removeFollower(action.object, action.actor)
    }
  }

  const handleUndoAction = (req, res) => {
    const undoneAction = req.body.object

    if (undoneAction.type !== 'Follow') {
      console.warn('Unhandled undo action type', undoneAction.type)
      return res.status(400).send()
    }

    if (db.getFollowers(undoneAction.object)) {
      db.removeFollower(undoneAction.object, undoneAction.actor)
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
    const followers = db.getFollowers(actor.id)
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
        'content': `<p>${notification.name}: <a href="${notification.id}" rel="nofollow noopener" target="_blank">${notification.id}</a></p>`,
        'attachment': notification
      }
    }
    db.saveMessage(create.object)
    db.saveMessage(create)
    followers.forEach(async followerId => {
      const { body: follower } = await request.get(followerId).set(GET_HEADERS)
      try {
        sendMessage(actor, follower, create)
      } catch (e) {
        console.error('ERROR', e)
      }
    })
    res.status(201).location(create.object.id).send()
  }

  app.post('/inbox', (req, res) => {
    const { type } = req.body
    if (ACTIVITY_TYPES.includes(type)) {
      handleAction(req, res)
    } else {
      handleNotification(req, res)
    }
  })

  app.get('/inbox', (req, res) => {
    const { actor } = req.query
    const messages = db.getMessagesFor(`${req.publicHost}/${actor}`)
    res.set('content-type', 'application/ld+json').send({
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `${req.publicHost}/inbox?actor=${actor}`,
      'type': 'Collection',
      'totalItems': messages.length,
      'items': messages
    })
  })

  return app
}

export default activitypub
