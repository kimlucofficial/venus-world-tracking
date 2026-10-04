import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from './config.js';
import { initDatabase } from './db.js';
import { commands } from './commands.js';
import { handleCommand, handleButton, closeExpiredVotes } from './handlers.js';

const client = new Client({ intents:[GatewayIntentBits.Guilds] });

client.once('ready', async ()=>{
  console.log(`[Venus Tracker] Logged in as ${client.user.tag}`);
  await initDatabase();
  const rest = new REST({version:'10'}).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId,config.guildId),{body:commands});
  console.log(`[Venus Tracker] Registered ${commands.length} guild commands.`);
  if(!process.env.VOTE_CHANNEL_ID) console.warn('[Venus Tracker] VOTE_CHANNEL_ID is empty; votes will temporarily use TRACKER_CHANNEL_ID.');
  await closeExpiredVotes(client).catch(console.error);
  setInterval(()=>closeExpiredVotes(client).catch(console.error),60_000);
});

client.on('interactionCreate', async interaction=>{
  try{
    if(interaction.isChatInputCommand()) await handleCommand(interaction,client);
    else if(interaction.isButton()) await handleButton(interaction,client);
  }catch(err){
    console.error(err);
    const payload={content:'❌ Có lỗi xảy ra khi xử lý thao tác. Kiểm tra Railway logs.',ephemeral:true};
    if(interaction.replied||interaction.deferred) await interaction.followUp(payload).catch(()=>{}); else await interaction.reply(payload).catch(()=>{});
  }
});

process.on('unhandledRejection',console.error);
process.on('uncaughtException',console.error);
client.login(config.token);
