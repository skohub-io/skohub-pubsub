const FOLLOWERS = {}
const MESSAGES = {}

const inmemory = {
  getFollowers: object => FOLLOWERS[object] || [],
  addFollower: (object, actor) => {
    FOLLOWERS[object] || (FOLLOWERS[object] = [])
    FOLLOWERS[object].includes(actor) || FOLLOWERS[object].push(actor)
  },
  removeFollower: (object, actor) => {
    if (FOLLOWERS[object]) {
      FOLLOWERS[object] = FOLLOWERS[object].filter(follower => follower !== actor)
    }
  },
  getMessagesFor: actor => Object.values(MESSAGES)
    .filter(message => message.type === 'Create' && message.actor === actor)
    .map(message => message.object),
  getMessage: id => MESSAGES[id],
  saveMessage: message => (MESSAGES[message.id] = message)
}

export default inmemory
