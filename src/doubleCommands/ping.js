module.exports = {
  name: 'ping',
  async execute(message) {
    const start = Date.now();
    const sent = await message.reply('...');
    const roundTrip = Date.now() - start;
    const wsPing = Math.round(message.client.ws.ping);

    await sent.edit(`\`${roundTrip}ms (${wsPing}ms rest)\``);
  },
};
