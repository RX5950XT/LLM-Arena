export const DEFAULT_API_URL = 'https://openrouter.ai/api/v1'

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export const SUPPORTED_TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json'
]
export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export const MIN_ARENA_SLOTS = 2
export const MAX_ARENA_SLOTS = 4
export const MIN_DEBATE_ROUNDS = 1
export const MAX_DEBATE_ROUNDS = 10
export const DEFAULT_DEBATE_ROUNDS = 3
