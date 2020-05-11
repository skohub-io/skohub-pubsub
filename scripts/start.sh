#!/bin/bash
#
###
# Provides:       skohub-pubsub
# Required-Start: $elasticsearch $mongodb
# Description:    Script to start the skohub-pubsub server.
#                 Use as standalone or in combination with
#                 /etc/init.d/skohub-pubsub.sh.
####

# config
PORT=3000 # the port skohub runs at
ES_NODE=http://localhost:9200 # where your elasticsearch runs
INDEX_NAME=skohub
NAME=skohub-pubsub
NODE_VERSION="v12.16.1"

if [ -n "$(lsof -i:$PORT)" ]; then
   echo "There is already a process running on port $PORT with an unexpected PID. Cancelling starting."
   exit 1
fi

# install and use proper node version
export NVM_DIR="$HOME/.nvm"
[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh # loads nvm
nvm install $NODE_VERSION # makes also sure to use the proper version

cd $HOME/git/$NAME/scripts

###
# nothing to change from here
###
# ensure elasticsearch index exists
curl -XPUT $ES_NODE/skohub

# start skohub-pubsub
MONGO_DB=$INDEX_NAME ES_INDEX=$INDEX_NAME ES_NODE=$ES_NODE PORT=$PORT npm start >> ../logs/$NAME.log 2>&1 &

# getting the process id of the skohub server and create a pidfile
PID=$(echo $!)
sleep 5 # wait before all processes are started
PID_OF_SKOHUB_PUBSUB="$(pgrep -P $(pgrep -P $PID))"
if [ $PID_OF_SKOHUB_PUBSUB ]; then
      echo $PID_OF_SKOHUB_PUBSUB > $NAME.pid
   else
      echo "Couldn' start $NAME"
      exit 1
   fi
exit 0
