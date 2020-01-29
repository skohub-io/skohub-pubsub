import mongodb from './mongodb'
import elasticsearch from './elasticsearch'

const indexingdb = async ({ MONGO_HOST, MONGO_PORT, MONGO_DB, ES_NODE, ES_INDEX }) => {
  const mdb = await mongodb({ host: MONGO_HOST, port: MONGO_PORT, db: MONGO_DB })
  const es = elasticsearch({ node: ES_NODE, index: ES_INDEX })
  return {
    getFollowers: mdb.getFollowers,
    addFollower: mdb.addFollower,
    removeFollower: mdb.removeFollower,
    getMessagesFor: mdb.getMessagesFor,
    getMessage: mdb.getMessage,
    saveMessage: async message => Promise.all([
      mdb.saveMessage(message),
      es.saveMessage(message)
    ])
  }
}

export default indexingdb
