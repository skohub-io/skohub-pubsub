import fs from 'fs'
import path from 'path'
import express from 'express'
import uuid from 'uuid'
import url from 'url'
import morgan from 'morgan'

const INBOX = []
const FOLLOWERS = {}
const PRIV_KEY = fs.readFileSync(path.resolve('data', 'private.pem'), 'utf8')
const PUB_KEY = fs.readFileSync(path.resolve('data', 'public.pem'), 'utf8')

console.log(PRIV_KEY, PUB_KEY)

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

app.get('/u/:id', (req, res) => {
  const id = req.params.id
  const actor = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    'id': `${req.publicHost}/u/${id}`,
    'type': 'Person',
    'preferredUsername': id,
    'inbox': `${req.publicHost}/inbox`,
    'followers': `${req.publicHost}/u/${id}/followers`,
    'publicKey': {
      'id': `${req.publicHost}/u/${id}#main-key`,
      'owner': `${req.publicHost}/u/${id}`,
      'publicKeyPem': PUB_KEY
    }
  }
  res.send(actor)
})

app.listen(3000, function() {
  console.log('Inbox listening on port 3000!')
})
