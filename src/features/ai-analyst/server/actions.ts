'use server'

import { createClient } from '@/lib/supabase/server'

interface SaveConversationInput {
  plantId: string
  title?: string
}

interface SaveMessageInput {
  conversationId: string
  role: 'user' | 'assistant'
  content: string
}

const MAX_CONVERSATIONS_PER_PLANT = 20
const RETENTION_DAYS = 14
const MAX_MESSAGES_PER_CONVERSATION = 50

/**
 * Creates a new conversation for the authenticated user.
 * Runs opportunistic cleanup: deletes old conversations beyond limits.
 * Returns null if user is not authenticated (demo mode).
 */
export async function saveConversation(input: SaveConversationInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No persistence in demo mode
  if (!user) return null

  // Opportunistic cleanup: delete conversations older than retention period
  await supabase
    .from('agent_conversations')
    .delete()
    .eq('user_id', user.id)
    .eq('plant_id', input.plantId)
    .lt('last_message_at', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString())

  // Check count and delete oldest if over limit
  const { count } = await supabase
    .from('agent_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('plant_id', input.plantId)

  if (count && count >= MAX_CONVERSATIONS_PER_PLANT) {
    const { data: oldest } = await supabase
      .from('agent_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('plant_id', input.plantId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (oldest) {
      await supabase.from('agent_conversations').delete().eq('id', oldest.id)
    }
  }

  // Create new conversation
  const { data, error } = await supabase
    .from('agent_conversations')
    .insert({
      user_id: user.id,
      plant_id: input.plantId,
      title: input.title ?? 'Nueva conversacion',
      message_count: 0,
    })
    .select('id')
    .single()

  if (error) return null
  return data.id as string
}

/**
 * Saves a message to a conversation.
 * Returns null if user is not authenticated (demo mode).
 */
export async function saveMessage(input: SaveMessageInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Check message count limit
  const { count } = await supabase
    .from('agent_messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', input.conversationId)

  if (count && count >= MAX_MESSAGES_PER_CONVERSATION) {
    return null
  }

  const { error } = await supabase
    .from('agent_messages')
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
    })

  if (error) return null

  // Update conversation metadata
  await supabase
    .from('agent_conversations')
    .update({
      message_count: (count ?? 0) + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', input.conversationId)

  return true
}

/**
 * Loads a conversation with its messages.
 * Returns null if not authenticated or conversation not found.
 */
export async function loadConversation(conversationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [convResult, msgsResult] = await Promise.all([
    supabase
      .from('agent_conversations')
      .select('id, plant_id, title, message_count, created_at')
      .eq('id', conversationId)
      .single(),
    supabase
      .from('agent_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])

  if (convResult.error || !convResult.data) return null

  return {
    conversation: convResult.data,
    messages: msgsResult.data ?? [],
  }
}

/**
 * Lists conversations for the current user on a specific plant.
 * Returns empty array if not authenticated.
 */
export async function listConversations(plantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from('agent_conversations')
    .select('id, title, message_count, last_message_at, created_at')
    .eq('user_id', user.id)
    .eq('plant_id', plantId)
    .order('last_message_at', { ascending: false })
    .limit(MAX_CONVERSATIONS_PER_PLANT)

  return data ?? []
}
