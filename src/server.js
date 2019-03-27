import pubsub from './pubsub'

const server = pubsub.listen(3000, () => {
  console.log('Publish-subscribe server listening on port 3000!')
})

server.on('upgrade', (request, socket, head) => pubsub.wss.handleUpgrade(
  request, socket, head, ws => pubsub.wss.emit('connection', ws, request)
))
