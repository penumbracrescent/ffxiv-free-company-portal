// Update this default with expansion support, or configure FFXIV_LEVEL_CAP on the bot.
const configured=Number(process.env.FFXIV_LEVEL_CAP||100);
export const LEVEL_CAP=Number.isInteger(configured)&&configured>=1&&configured<=200?configured:100;
