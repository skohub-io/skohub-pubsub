# skohub-pubsub

This part provides the [SkoHub](http://skohub.io) core infrastructure, setting up basic inboxes for
subjects plus the ability of subscribing to push notifications for those inboxes. For usage and implementation details see the [blog post](https://blog.lobid.org/2020/06/25/skohub-pubsub.html).
Dependencies:

- elasticsearch 6.8
- mongodb
- node-version >= v12.16.1

Basic setup:

    $ git clone https://github.com/hbz/skohub-pubsub.git
    $ cd skohub-pubsub
    $ npm install
    $ npm test
    $ PORT=3000 npm start

This will start the ActivityPub server on the specified `PORT`. It accepts
[`FOLLOW`](https://www.w3.org/TR/activitypub/#follow-activity-inbox) messages sent to the `/inbox`.
All other [activity types](https://www.w3.org/TR/activitystreams-vocabulary/#activity-types) are
currently ignored.

Non-activity objects sent to `/inbox?actor=username/repo/some/classification/path`[^1] are
distributed as `NOTE` objects to the corresponding followers. The original notifications are
delivered as an [attachment](https://www.w3.org/TR/activitystreams-vocabulary/#dfn-attachment) of
the note.

Some actions may need certificates. These must reside in the `data` directory
named as `private.pem` and `public.pem`.

[^1]: Actor names are considered relative to the hostname of the server.

# elasticsearch
You need to run a properly configured `elasticsearch` instance by
setting `cluster.name: skohub`. See the provided [elasticsearch.yml](scripts/etc/elasticsearch/elasticsearch.yml).
