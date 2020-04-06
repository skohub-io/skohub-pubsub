#! /bin/sh
#
### BEGIN INIT INFO
# Provides:          skohub-pubsub
# Required-Start:    $elasticsearch $mongodb
# Required-Stop:     $elasticsearch $mongodb
# Should-Start:      $monit
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: skohub-pubsub as a node server
# Description:       skohub-pubsub as a node server available over the
#                    network.
### END INIT INFO

# this file should be placed into /etc/init.d/
### if you copy it to init.d:
# set the home directory to your skohub-pubsub installation as an absolute path:
HOME_=$HOME
### END copy to init.d

PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
HOME_SKOHUB=$HOME_/git/skohub-pubsub/scripts/
DAEMON_START_SCRIPT=$HOME_SKOHUB/start.sh
NAME=skohub-pubsub
PID_FILE=$HOME_SKOHUB/$NAME.pid
DESC="skohub-pubsub as a node server"
RUN_AS_USER=lod

###
# nothing to change after this line
###

if [ -s $PID_FILE ]; then
   PID=$(cat $PID_FILE)
fi
test -x $DAEMON_START_SCRIPT || exit 0


set -e

do_start()
{
   echo -n "Starting $DESC: "
   start-stop-daemon --start --quiet --chuid $RUN_AS_USER --exec $DAEMON_START_SCRIPT
   echo "$NAME is running as a node server with PID $(cat $PID_FILE)."
}

do_stop()
{
   echo -n "Stopping the PID $PID of $DESC: "
   start-stop-daemon --stop --signal TERM --oknodo --quiet --pid $PID
   rm -f $PID_FILE
   echo "$NAME is stopped and pidfile $PID_FILE is removed."
}

case "$1" in
   start)
      do_start
   ;;
   stop)
      do_stop
   ;;
   restart)
      do_stop
      case "$?" in
         0|1)
            do_start
            case "$?" in
                0)
                   echo "Restarted succesfully"
                ;;
                1|*)
                   echo "Failed to restart: old process is still or failed to running"
                   exit 1
                ;;
            esac
        ;;
        *)
           # Failed to stop
           echo "Failed to stop: old process is still or failed to running"
           exit 1
        ;;
    esac
   ;;
   status)
      if [ $PID ]; then
         if [ -d /proc/$PID ]; then
            echo "Process is running with PID $PID."
            exit 0
         else
            # No such PID_FILE, or executables don't match
            echo "Process is not running, but pidfile existed. Going to remove pidfile..."
            rm -f $PID_FILE
            exit 1
         fi
      else
         echo "Process is not running"
         exit 1
      fi
   ;;
  *)
   N=/etc/init.d/$NAME
   echo "Usage: $N {start|stop|restart|status}" >&2
   exit 1
   ;;
esac

exit 0
