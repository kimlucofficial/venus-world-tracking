import 'dotenv/config';

const required = ['DISCORD_BOT_TOKEN', 'DATABASE_URL', 'CLIENT_ID', 'GUILD_ID', 'OWNER_ID', 'ROLE_VTEAM_ID', 'ROLE_HELPER_ID', 'TRACKER_CHANNEL_ID'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

export const config = {
  token: process.env.DISCORD_BOT_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  ownerId: process.env.OWNER_ID,
  roleVteamId: process.env.ROLE_VTEAM_ID,
  roleHelperId: process.env.ROLE_HELPER_ID,
  trackerChannelId: process.env.TRACKER_CHANNEL_ID,
  voteChannelId: process.env.TRACKER_CHANNEL_ID,
  timezone: process.env.TIMEZONE || 'Australia/Melbourne',
  emojis: {
    complete: '<a:1357882491800911983:1553623193082794058>',
    yes: '<a:Manao18:1553623507810918410>',
    no: '<:15819kuromiquestion:1532387134122754258>'
  }
};
