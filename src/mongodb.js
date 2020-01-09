import { MongoClient, Server } from 'mongodb'

const mongodb = async config => {
  const client = new MongoClient(new Server(config.host, config.port))
  await client.connect()
  await client.db(config.db).createIndex('followers', { object: 1 }, { unique: true })
  await client.db(config.db).createIndex('messages', { id: 1 }, { unique: true })

  return {
    getFollowers: async object => ((await client.db(config.db).collection('followers')
      .findOne({ object })) || { followers: [] }).followers,
    addFollower: async (object, actor) => client.db(config.db).collection('followers')
      .updateOne({ object }, { $setOnInsert: { object }, $addToSet: { followers: actor } }, { upsert: true }),
    removeFollower: async (object, actor) => client.db(config.db).collection('followers')
      .updateOne({ object }, { $pull: { followers: actor } }),
    getMessagesFor: async actor => ((await client.db(config.db).collection('messages')
      .find({ actor, type: 'Create' }).toArray()) || []).map(message => message.object),
    getMessage: async id => client.db(config.db).collection('messages')
      .findOne({ id }),
    saveMessage: async message => client.db(config.db).collection('messages')
      .replaceOne({ id: message.id }, message, { upsert: true })
  }
}

export default mongodb
