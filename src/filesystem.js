import fs from 'fs'
import path from 'path'

const filesystem = dir => {
  const FOLLOWERS = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.resolve(dir, 'followers.json'), 'utf8'))
    } catch (e) {
      return {}
    }
  })()
  const MESSAGES = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.resolve(dir, 'messages.json'), 'utf8'))
    } catch (e) {
      return {}
    }
  })()

  const writeFollowers = () => fs.writeFileSync(
    path.resolve(dir, 'followers.json'),
    JSON.stringify(FOLLOWERS, null, 2),
    'utf8'
  )

  const writeMessages = () => fs.writeFileSync(
    path.resolve(dir, 'messages.json'),
    JSON.stringify(MESSAGES, null, 2),
    'utf8'
  )

  return {
    getFollowers: object => FOLLOWERS[object] || [],
    addFollower: (object, actor) => {
      FOLLOWERS[object] || (FOLLOWERS[object] = [])
      FOLLOWERS[object].includes(actor) || FOLLOWERS[object].push(actor)
      writeFollowers()
    },
    removeFollower: (object, actor) => {
      if (FOLLOWERS[object]) {
        FOLLOWERS[object] = FOLLOWERS[object].filter(follower => follower !== actor)
        writeFollowers()
      }
    },
    getMessagesFor: actor => Object.values(MESSAGES)
      .filter(message => message.type === 'Create' && message.actor === actor)
      .map(message => message.object),
    getMessage: id => MESSAGES[id],
    saveMessage: message => (MESSAGES[message.id] = message) && writeMessages()
  }
}

export default filesystem
