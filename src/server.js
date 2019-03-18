import pubsub from './pubsub'

pubsub.listen(3000, () => {
  console.log('Publish-subscribe server listening on port 3000!')
})
