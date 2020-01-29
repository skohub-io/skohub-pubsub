import { Client } from '@elastic/elasticsearch'

const elasticsearch = ({ node, index }) => {
  const client = new Client({ node })
  return {
    saveMessage: async message => message.type === 'Create' &&
      client.index({ index, body: message.object, type: '_doc' })
  }
}

export default elasticsearch
