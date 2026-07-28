const BLOCKED_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2q9VdmuAqZLh5a2uM8uFQ2nYh',
  'Es9vMFrzaCERmJfrF4H2FYD6ZQ7m3kVvCLzVhQ3N2u',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
]);
const NON_MEME_SYMBOL = /^(USDC|USDT|USD1|USDS|SOL|WSOL|BTC|WBTC|ETH|WETH|JUP|RAY|ORCA|JITOSOL|MSOL|BSOL|STSOL)$/i;

export function classifyToken(mint: string, symbol = '', name = '') {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return { allowed:false, reason:'invalid mint', tokenClass:'UNKNOWN' };
  if (BLOCKED_MINTS.has(mint)) return { allowed:false, reason:'known non-meme mint', tokenClass:'INFRASTRUCTURE' };
  if (NON_MEME_SYMBOL.test(symbol.trim())) return { allowed:false, reason:'non-meme symbol', tokenClass:'INFRASTRUCTURE' };
  if (/stablecoin|liquid staking|wrapped bitcoin|wrapped ether/i.test(name)) return { allowed:false, reason:'non-meme name', tokenClass:'INFRASTRUCTURE' };
  return { allowed:true, reason:'ok', tokenClass:'MEME' };
}
