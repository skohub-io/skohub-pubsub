# skohub-pubsub

```
$ git clone https://github.com/hbz/skohub-pubsub.git
$ npm install
$ npm test
$ npm start
$ curl -i localhost:3000/inbox
HTTP/1.1 400 Bad Request
$ curl -i "localhost:3000/inbox?target=https://lobid.org/gnd/118696432"
HTTP/1.1 200 OK
```
