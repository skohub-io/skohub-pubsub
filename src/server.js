import activitypub from './activitypub'
import indexingdb from '../src/indexingdb'

const {
  MONGO_HOST = 'localhost',
  MONGO_PORT = 27017,
  MONGO_DB = 'skohub',
  ES_NODE = 'http://localhost:9200',
  ES_INDEX = 'skohub',
  PORT
} = process.env

indexingdb({ MONGO_HOST, MONGO_PORT, MONGO_DB, ES_NODE, ES_INDEX })
  .then(db => activitypub(db).listen(PORT || 3000,
    () => console.log(`Inbox listening on port ${PORT || 3000}!`)))
