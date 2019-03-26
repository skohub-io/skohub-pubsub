const http = require('http')

const publisherServer = http.createServer()

const linkHeadersCallback = (req, res) => {
  const { address, port } = publisherServer.address()
  console.log(req.url)
  const linkHeaders = [
    '<http://localhost:3000/hub>; rel="hub"',
    `<http://${address}:${port}${req.url}>; rel="self"`,
    `<http://localhost:3000/inbox?target=http://${address}:${port}${req.url}>; rel="http://www.w3.org/ns/ldp#inbox"`
  ]
  res.setHeader('Link', linkHeaders)
  res.end()
}
publisherServer.on('request', linkHeadersCallback)

publisherServer.listen(0, '127.0.0.1', async () => {
  console.log('Publisher listening', publisherServer.address())
})
