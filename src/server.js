import activitypub from './activitypub'
import mongodb from '../src/mongodb'

const { MONGO_HOST, MONGO_PORT, MONGO_DB, PORT } = process.env

mongodb({
  host: MONGO_HOST || 'localhost',
  port: MONGO_PORT || 27017,
  db: MONGO_DB || 'skohub'
}).then(db => activitypub(db).listen(PORT || 3000,
  () => console.log(`Inbox listening on port ${PORT || 3000}!`)))
