import pubsub from './pubsub'

const app = pubsub()
const server = app.listen(3000, () => {
  console.log('Publish-subscribe server listening on port 3000!')
})

server.on('upgrade', (req, socket, head) => app.wss.handleUpgrade(
  req, socket, head, ws => app.wss.emit('connection', ws, req)
))
