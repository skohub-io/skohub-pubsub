# Build

![https://github.com/hbz/skohub-pubsub/actions?query=workflow%3ABuild](https://github.com/hbz/skohub-pubsub/workflows/Build/badge.svg?branch=master)

# skohub-pubsub

This part provides the [SkoHub](http://skohub.io) core infrastructure, setting up basic inboxes for
subjects plus the ability of subscribing to push notifications for those inboxes. For usage and implementation details see the [blog post](https://blog.lobid.org/2020/06/25/skohub-pubsub.html).
Dependencies:

- elasticsearch 6.8
- mongodb
- node-version >= v12.16.1

Basic setup:

    $ git clone https://github.com/skohub-io/skohub-pubsub.git
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

## elasticsearch
You need to run a properly configured `elasticsearch` instance by
setting `cluster.name: skohub`. See the provided [elasticsearch.yml](scripts/etc/elasticsearch/elasticsearch.yml). Also, in some contexts, it's mandatory to initialize elasticsearch
with a proper [index-mapping](scripts/elasticsearch-mappings.json).

## start scripts
You may want to use the start script in `scripts/start.sh`. This script ensures the proper
installation of skohub-pubsub and the configuration of elasticsearch. There also reside
further scripts to manage the starting/stopping of the skohub-pubsub via init and to
monitor the processes with `monit`.

## Credits

The project to create a stable beta version of SkoHub has been funded by the North-Rhine Westphalian Library Service Centre (hbz) and carried out in cooperation with [graphthinking GmbH](https://graphthinking.com/) in 2019/2020.

<a target="_blank" href="https://www.hbz-nrw.de"><img src="https://skohub-io.github.io/skohub.io/img/hbz-logo.svg" width="120px"></a>
