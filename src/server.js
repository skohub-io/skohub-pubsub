import activitypub from './activitypub'

activitypub.listen(process.env.PORT || 3000, () => {
  console.log(`Inbox listening on port ${process.env.PORT || 3000}!`)
})
