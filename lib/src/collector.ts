import type { Collector, Message } from './types'

interface QueuedMessage {
  msg: Message
  logged: boolean
}

function display(_msg: Message) {

}

export function createCollector(): Collector {
  const queue: QueuedMessage[] = []

  return {
    log: (msg) => {
      display(msg)
      queue.push({ msg, logged: true })
    },
    submit: (msg) => {
      queue.push({ msg, logged: false })
    },
    collect: () => {},
  }
}
