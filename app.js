const fs = require('fs');
const UniswapTrader = require('./uniswapTrader/v2/uniswapTrader')
const TelegramBot = require('node-telegram-bot-api');

require('dotenv').config()

const DEXGURU_API_KEY = process.env.DEXGURU_API_KEY;
const SCHEDULE_MINUTES = 0.3
const TX_INTERVAL_MINUTES = 15
const filePath = './wallets.tsv'

const filteredTokens = [
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0x4fabb145d64652a948d72533023f6e7a623c7c53',
    '0x0000000000085d4780B73119b644AE5ecd22b376',
    '0x8e870d67f660d95d5be530380d0ec0bd388289e1',
    '0x0c10bf8fcb7bf5412187a595ab97a3609160b5c6',
    '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
    '0x8e870d67f660d95d5be530380d0ec0bd388289e1',
    '0x6b175474e89094c44da98b954eedeac495271d0f'
];

const reservedTokens = ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'];

let tokens = [];

const bot = new TelegramBot(process.env.TELEGRAM_API);
const group_id = process.env.GROUP_ID;

const sdk = require('api')('@dexguru/v1.0#1dkyili2750ru');
sdk.auth(DEXGURU_API_KEY);

const getWallets = async () => {
    const res = []
    try {
        const data = fs.readFileSync(filePath, 'utf8');
    
        // Process the TSV data
        const rows = data.split('\n');
        rows.forEach(row => {
          const [wallet, lastTx] = row.split('\t');
          if (wallet !== '') res.push({ [wallet]: lastTx || '' });
        });
        return res;
      } catch (err) {
        return res;
      }
}

const getTokens = async () => {
    try {
        const data = fs.readFileSync('tokens.txt', 'utf8');
    
        // Process the TSV data
        const tokensList = data.replace(/\n/g,'').split(',');
        tokens = tokensList;
        // return tokensList;
      } catch (err) {
        return [];
      }
}

const updateWallets = async (data) => {
    try {
        const rows = data.map(obj => {
          const [key, value] = Object.entries(obj)[0];
          return `${key}\t${value}`;
        });
    
        const textData = rows.join('\n');
    
        fs.writeFileSync(filePath, textData, 'utf8');
    } catch (err) {
        console.error('Error:', err);
    }
}

const updateTokens = async (data) => {
    try {
        const textData = data.join(',\n');
    
        fs.writeFileSync('tokens.txt', textData, 'utf8');
    } catch (err) {
        console.error('Error:', err);
    }
}

const swapMessage = (params) => {
    const {
        wallet,
        tokenIn,
        tokenOut,
        swapStatus
    } = params;

    if (swapStatus === 1) {
        if (reservedTokens.includes(tokenOut['address'])) return `📥 Repeat to *${wallet}* Swap [${tokenOut['symbol'].replace(/[\/\\\-\.~'`]/g, '')}](https://info.uniswap.org/#/tokens/${tokenOut['address']}) for [${tokenIn['symbol'].replace(/[\/\\\-\.~'`]/g, '')}](https://info.uniswap.org/#/tokens/${tokenIn['address']})\n`;
        else return `📤 Repeat to *${wallet}* Swap [${tokenIn['symbol'].replace(/[\/\\\-\.~'`]/g, '')}](https://info.uniswap.org/#/tokens/${tokenIn['address']}) for [${tokenOut['symbol'].replace(/[\/\\\-\.~'`]/g, '')}](https://info.uniswap.org/#/tokens/${tokenOut['address']})\n`
    }
    // if (swapStatus === 404  && tokenOut['address'] === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') return `🚫 We don't have WETH tokens for this swap\n`;
    // if (swapStatus === 405) return `🔁 We don't have pool for [${tokenIn['symbol']}](https://info.uniswap.org/#/tokens/${tokenIn['address']}) and [${tokenOut['symbol']}](https://info.uniswap.org/#/tokens/${tokenOut['address']})\n`;
    // if (swapStatus === 406) return `📈 No liquidity in pool for [${tokenIn['symbol']}](https://info.uniswap.org/#/tokens/${tokenIn['address']}) and [${tokenOut['symbol']}](https://info.uniswap.org/#/tokens/${tokenOut['address']})\n`;
}

const doSwap = async (tokens) => {

    const {
        MAINNET_RPC_URL,
        WALLET_ADDRESS,
        WALLET_SECRET,
        UNISWAP_SWAP_ROUTER_ADDRESS_V2: UNISWAP_SWAP_ROUTER_ADDRESS,
        UNISWAP_FACTORY_ADDRESS_V2: UNISWAP_FACTORY_ADDRESS
    } = process.env
    
    const traderParams = {
        address0: tokens.tokenOut,
        address1: tokens.tokenIn,
        TEST_RPC_URL: MAINNET_RPC_URL,
        WALLET_ADDRESS,
        WALLET_SECRET,
        UNISWAP_SWAP_ROUTER_ADDRESS,
        UNISWAP_FACTORY_ADDRESS,
        filteredTokens
    }
    const trader = new UniswapTrader(traderParams);
    
    const result = await trader.doSwap();
    return result;
}

const testWallet = async (wallet) => {
    const address = Object.keys(wallet)[0];
    const now = new Date();
    const subtractedDate = new Date(now.getTime() - TX_INTERVAL_MINUTES * 60000);
    const begin_timestamp = Math.floor(subtractedDate.getTime() / 1000);

    let message = '';

    const params = {
        sort_by: 'timestamp',
        order: 'asc',
        limit: '100',
        offset: '0',
        begin_timestamp: begin_timestamp,
        chain_id: '1',
        wallet_address: address
    };
    
    const get_swaps = await sdk.get_wallet_swaps_v1_chain__chain_id__wallets__wallet_address__transactions_swaps_get(params);
    if (get_swaps.status === 200 && get_swaps?.data?.total > 0) {
        const promisses = get_swaps.data.data.map(async (swap) => {
            const { 
                tokens_in,
                tokens_out,
                amm
            } = swap;
            const tokenIn = tokens_in[0].address;
            if (!tokens.includes(tokenIn)) {
                const tokenOut = tokens_out[0].address;
                if (!filteredTokens.includes(tokenOut) || !filteredTokens.includes(tokenIn)) {
                    const { status } = await doSwap({tokenIn, tokenOut});
                    console.log(amm, tokens_out[0]['symbol'], tokens_out[0]['address'], tokens_in[0]['symbol'], tokens_in[0]['address'], status);
                    message = swapMessage({
                        wallet: address,
                        tokenIn: tokens_in[0],
                        tokenOut: tokens_out[0],
                        swapStatus: status
                    });
                    if (status === 1 && !reservedTokens.includes(tokenIn))
                        tokens.push(tokenIn)
                    else if (status === 1 && reservedTokens.includes(tokenOut)) {
                        const index = tokens.indexOf(tokenIn);
                        tokens = tokens.splice(index, 1);
                    }
                }
            } else {
                console.log(`Address ${address} Token ${tokenIn} skipped`);
            }
        });
        await Promise.allSettled(promisses);
    } else {
        if (get_swaps.status !== 200) console.error('Status: ' + get_swaps.status);
        if (get_swaps.data.total === 0) console.error(`No swaps for ${address} found during last ${TX_INTERVAL_MINUTES} mins`);
    }

    return {
        message
    };
}

const callTestWallet = async () => {
    const wallets = await getWallets();
    const lastTokensListLength = tokens.length;
    await getTokens();
    // const tokensList = await getTokens();
    // tokens = tokensList;
    // const updatedWallets = [];
    let circleMessages = '';
    for (const wallet of wallets) {
      try {
        const test = await testWallet(wallet, tokens);
        if (test?.message && test?.message.length > 0) circleMessages += test.message;
      } catch (err) {
        console.error(err);
      }
    }
    if (circleMessages.length > 0 && circleMessages !== '') {
        bot.sendMessage(group_id, circleMessages, {parse_mode: 'MarkdownV2'});
        if (tokens.length !== lastTokensListLength) 
            await updateTokens(tokens);
    }

    console.log('Circle\n\n');
};
  
  // Call the function immediately
  callTestWallet();
  
  // Call the function every minute
  setInterval(callTestWallet, 1000*60*SCHEDULE_MINUTES);
