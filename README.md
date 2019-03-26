# skohub-pubsub

Basic setup:

    $ git clone https://github.com/hbz/skohub-pubsub.git
    $ cd skohub-pubsub
    $ npm install
    $ npm test
    $ npm start
    $ curl -i localhost:3000/inbox
    HTTP/1.1 400 Bad Request
    $ curl -i "localhost:3000/inbox?target=https://lobid.org/gnd/118696432"
    HTTP/1.1 200 OK

To test pubsub interactively, start the server in one terminal:

    $ npm start

Start the publisher, take a note of the $address and $port to provide a valid
URL in the next step below:

    $ node src/publisher.js

Start the subscriber, subscribing a publisher URL (the $address and $port from
above) and a $topic (where $topic may be e.g `https://lobid.org/gnd/118696432`):

    $ node src/subscriber.js http://localhost:3000/hub http://$address:$port/$topic

Send a notification to the hub and see it logged by the subscriber:

    $ curl "localhost:3000/inbox?target=https://lobid.org/gnd/118696432" \
    -H "Content-Type: application/ld+json" \
    -d '{"foo": "bar"}'

Also, try to notify the hub with a slightly different topic (e.g.
https://lobid.org/gnd/118696431) - see the subscriber logging nothing.
