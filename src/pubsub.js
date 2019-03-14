import express from 'express'

const pubsub = express()

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

export default pubsub
