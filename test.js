const ethers = require('ethers');

const UniswapTrader = require('./uniswapTrader/v2/uniswapTrader')

require('dotenv').config()

// const testToken1 = '0x27859e40aa41d6b8188874474415b961514bc7b9'
const testToken0 = '0x12c974e8e51a57b14c452d5b454e391b87f1ec6c'
const testToken1 = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase()

const WALLET_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const WALLET_SECRET = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const {
    TEST_RPC_URL,
    UNISWAP_SWAP_ROUTER_ADDRESS_V2,
    UNISWAP_FACTORY_ADDRESS_V2
} = process.env

const provider = new ethers.providers.JsonRpcProvider(TEST_RPC_URL);
const wallet = new ethers.Wallet(WALLET_SECRET)
const signer = wallet.connect(provider)
// signer.sendTransaction({
//     to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
//     value: ethers.utils.parseUnits('0.2', 18)
// })

const traderParams = {
    address0: testToken0,
    address1: testToken1,
    TEST_RPC_URL,
    WALLET_ADDRESS,
    WALLET_SECRET,
    UNISWAP_SWAP_ROUTER_ADDRESS: UNISWAP_SWAP_ROUTER_ADDRESS_V2,
    UNISWAP_FACTORY_ADDRESS: UNISWAP_FACTORY_ADDRESS_V2,
    amountIn: '0.01'
}

const trader = new UniswapTrader(traderParams);

trader.doSwap()
    .then(r => {
        console.log(JSON.stringify(r))
        console.log('Logs: ', r.logs[0])
        console.log('Events: ', r.events[0])
    })

