import { ChatClient } from './chat-client'
import { getPersona, getRegion } from '@/lib/personas'

export const dynamic = 'force-dynamic'

export default function CopilotPage() {
  return <ChatClient persona={getPersona()} region={getRegion()} />
}
