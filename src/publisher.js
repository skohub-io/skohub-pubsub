const http = require('http')

const publisherServer = http.createServer()

const linkHeadersCallback = (req, res) => {
  const { address, port } = publisherServer.address()
  const linkHeaders = [
    `<${process.argv[2]}>; rel="hub"`,
    `<http://${address}:${port}${req.url}>; rel="self"`,
    `<${process.argv[3]}?target=http://${address}:${port}${req.url}>; rel="http://www.w3.org/ns/ldp#inbox"`
  ]
  res.setHeader('Link', linkHeaders.join(', '))
  res.end()
}
publisherServer.on('request', linkHeadersCallback)

if (process.argv.length !== 4) {
  console.error('Usage: node publisher.js hub inbox')
  process.exit(1)
}

publisherServer.listen(0, '127.0.0.1', async () => {
  console.log('Publisher listening', publisherServer.address())
})
