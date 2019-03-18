# skohub-pubsub

```
$ git clone https://github.com/hbz/skohub-pubsub.git
$ cd skohub-pubsub
$ npm install
$ npm test
$ npm start
$ curl -i localhost:3000/inbox
HTTP/1.1 400 Bad Request
$ curl -i "localhost:3000/inbox?target=https://lobid.org/gnd/118696432"
HTTP/1.1 200 OK
```

```
To test pubsub interactively, start the server in one terminal:

    $ npm start

Start the subscriber in another one:

    $ node src/subscriber.js http://localhost:3000/hub https://lobid.org/gnd/118696432

Send a notification to the hub and see it logged by the subscriber:

    $ curl "localhost:3000/inbox?target=https://lobid.org/gnd/118696432" \
    > -H "Content-Type: application/ld+json" \
    > -d '{"foo": "bar"}'
```
