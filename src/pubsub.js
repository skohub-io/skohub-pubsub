import express from 'express'

const pubsub = express()

pubsub.get('/inbox', (req, res) => {
  req.query.target ? res.status(200).send() : res.status(400).send()
})

export default pubsub
