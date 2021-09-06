import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";
import { format, parseISO } from 'date-fns'


const discordBot = new Discord.Client();
const  discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
      resolve(channel as TextChannel);
    });
  })
}



const buildMessage = (sale: any, usd: any) => (
  new Discord.MessageEmbed()
	.setColor('#FFC069')
	.setTitle(sale.asset.name + ' was sold!')
	.setURL(sale.asset.permalink)
  .setDescription(`${sale.asset.description.split('.')[0]}. This Pixl was sold on ${format(new Date(sale?.created_date), "yyyy-MM-dd HH:mm")} UTC.`)
	.setThumbnail(sale.asset.image_url)
	.addFields(
		{ name: 'Sold For', inline: true, value: `${ethers.utils.formatEther(sale.total_price)} ${ethers.constants.EtherSymbol} ($${usd})`},
		{ name: 'Buyer', inline: true, value: `[${sale?.winner_account?.address.substring(0, 8)}](https://opensea.io/accounts/${sale?.winner_account?.address})`}
	)
)

async function main() {
  const channel = await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  const settings = { 
    method: "GET",
    headers: {
      "X-API-KEY": process.env.OPEN_SEA_API_KEY
    }
  };

  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + new URLSearchParams({
      offset: '0',
      limit: '100',
      event_type: 'successful',
      only_opensea: 'false',
      occurred_after: hoursAgo.toString(), 
      collection_slug: process.env.COLLECTION_SLUG!
  }), settings).then((resp) => resp.json());

  await Promise.all(
    openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
      const formattedTokenPrice = ethers.utils.formatEther(sale.total_price.toString());
      const usd = (Number(formattedTokenPrice) * sale.payment_token.usd_price).toFixed(2);
      const message = buildMessage(sale, usd);
      return channel.send(message)
    })
  );   
}

main()
  .then((res) =>{ 
    console.warn(res)
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
