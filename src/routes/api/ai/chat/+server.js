import { handleChatRequest } from '$lib/server/ai/chat.js'

export const POST = ({ request }) => handleChatRequest(request)
