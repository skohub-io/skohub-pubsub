import { MongoClient, Server } from 'mongodb'

const mongodb = async ({ host, port, db }) => {
  const client = new MongoClient(new Server(host, port))
  await client.connect()
  await client.db(db).createIndex('followers', { object: 1 }, { unique: true })
  await client.db(db).createIndex('messages', { id: 1 }, { unique: true })

  return {
    getFollowers: async object => ((await client.db(db).collection('followers')
      .findOne({ object })) || { followers: [] }).followers,
    addFollower: async (object, actor) => client.db(db).collection('followers')
      .updateOne({ object }, { $setOnInsert: { object }, $addToSet: { followers: actor } }, { upsert: true }),
    removeFollower: async (object, actor) => client.db(db).collection('followers')
      .updateOne({ object }, { $pull: { followers: actor } }),
    getMessagesFor: async actor => ((await client.db(db).collection('messages')
      .find({ actor, type: 'Create' }).toArray()) || []).map(message => message.object),
    getMessage: async id => client.db(db).collection('messages')
      .findOne({ id }),
    saveMessage: async message => client.db(db).collection('messages')
      .replaceOne({ id: message.id }, message, { upsert: true })
  }
}

export default mongodb
