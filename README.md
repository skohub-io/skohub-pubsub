# skohub-pubsub

Basic setup:

    $ git clone https://github.com/hbz/skohub-pubsub.git
    $ cd skohub-pubsub
    $ npm install
    $ npm test
    $ npm start

Start the publisher, take a note of the `$address` and `$port` to provide a valid
topic URL in the next step below:

    $ node src/publisher.js http://localhost:3000/hub http://localhost:3000/inbox

Start the subscriber, subscribing to a publisher topic URL (the $address and $port from
above) and a random path:

    $ node src/subscriber.js http://localhost:3000/hub http://$address:$port/some/random/path

Send a notification to the hub and see it logged by the subscriber:

    $ curl "localhost:3000/inbox?target=http://$address:$port/some/random/path" \
    -H "Content-Type: application/ld+json" \
    -d '{"foo": "bar"}'

Also, try to notify the hub with a slightly different topic (e.g.
http://$address:$port/another/random/path) - see the subscriber logging nothing.
