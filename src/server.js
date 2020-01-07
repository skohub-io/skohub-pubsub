import activitypub from './activitypub'
import filesystem from './filesystem'

activitypub(filesystem('data')).listen(process.env.PORT || 3000, () => {
  console.log(`Inbox listening on port ${process.env.PORT || 3000}!`)
})
