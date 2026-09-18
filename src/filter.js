const ACKNOWLEDGEMENTS = /^(dạ|vâng|ok|okay|cảm ơn|em cảm ơn|mình cảm ơn|thanks|thank you)(\s+(ạ|nhé|nha))?[!. ]*$/iu;

export function classifyMessage(message) {
  if (message.isBot) return { kind: 'ignore', reason: 'bot' };
  const content = (message.content || '').trim();
  if (!content) return { kind: 'ignore', reason: 'empty' };
  const meaningful = content.replace(/\[[^\]]+\]/g, '').replace(/[\p{P}\p{S}\s]/gu, '');
  if (!meaningful) return { kind: 'ignore', reason: 'emoji_or_symbol_only' };
  if (ACKNOWLEDGEMENTS.test(content)) return { kind: 'ignore', reason: 'acknowledgement' };
  const roles = new Set((message.authorRoles || []).map(role => role.toLowerCase()));
  if (message.isModerator || roles.has('ta') || roles.has('mod') || roles.has('coach') || roles.has('admin')) {
    return { kind: 'official_source_candidate', reason: 'trusted_role' };
  }
  return { kind: 'candidate', reason: 'human_content' };
}
