import express from 'express'
import request from 'superagent'
import crypto from 'crypto'

const DEFAULT_LEASE_SECONDS = 7

const pubsub = express()

pubsub.use(express.urlencoded({ extended: true }))

pubsub.get('/inbox', (req, res) => {
  if (!req.query.target) {
    return res.status(400).send()
  }
  res.status(200).send({
    '@context': 'http://www.w3.org/ns/ldp',
    '@id': `${req.protocol}://${req.get('host')}${req.url}`,
    'contains': []
  })
})

pubsub.post('/inbox', (req, res) => {
  if (!req.query.target || req.headers['content-type'] !== 'application/ld+json') {
    return res.status(400).send()
  }
  res.status(202).send()
})

pubsub.post('/hub', async (req, res) => {
  if (
    req.headers['content-type'] !== 'application/x-www-form-urlencoded' ||
    !req.body['hub.callback'] ||
    !req.body['hub.mode'] ||
    !req.body['hub.topic']
  ) {
    return res.status(400).send()
  }
  res.status(202).send()

  const challenge = crypto.randomBytes(64).toString('hex')

  try {
    await request.get(req.body['hub.callback'])
      .query(`hub.mode=${req.body['hub.mode']}`)
      .query(`hub.topic=${req.body['hub.topic']}`)
      .query(`hub.challenge=${challenge}`)
      .query(`hub.lease_seconds=${req.body['hub.lease_seconds'] || DEFAULT_LEASE_SECONDS}`)
    // TODO: save subscription
  } catch (e) {
    // TODO: cancel subscription request
  }
})

export default pubsub
