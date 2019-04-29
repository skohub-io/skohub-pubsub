import pubsub from './pubsub'

const app = pubsub()
const server = app.listen(3000, () => {
  console.log('Publish-subscribe server listening on port 3000!')
})

server.on('upgrade', (request, socket, head) => app.wss.handleUpgrade(
  request, socket, head, ws => app.wss.emit('connection', ws, request)
))
