'use client'

import type { AgentContext } from '../types'
import { AgentFAB } from './AgentFAB'
import { AgentPanel } from './AgentPanel'

interface Props {
  context?: AgentContext
}

export function AgentProvider({ context }: Props) {
  return (
    <>
      <AgentFAB />
      <AgentPanel context={context} />
    </>
  )
}
