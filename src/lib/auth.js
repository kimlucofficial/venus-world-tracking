import { config } from '../config.js';

export function hasTeamPermission(interaction) {
  if (interaction.user.id === config.ownerId) return true;
  const roles = interaction.member?.roles;
  if (!roles?.cache) return false;
  return roles.cache.has(config.roleVteamId) || roles.cache.has(config.roleHelperId);
}

export async function requireTeamPermission(interaction) {
  if (hasTeamPermission(interaction)) return true;
  const payload = { content: '❌ Bạn không có quyền sử dụng chức năng này. Chỉ **VTeam** và **Helper** được phép.', ephemeral: true };
  if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
  else await interaction.reply(payload);
  return false;
}
