const { ethers } = require('ethers')
// Uniswap
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json')
const { abi: UniswapV3Factory } = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
const { abi: SwapRouterABI} = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json')
// const { abi: UniswapV2Pair} = require('@uniswap/v2-core/build/UniswapV2Pair.json')
// helpers
const { getPoolImmutables, getPoolState, getTokenBalance, getTokenDecimals } = require('./helpers')
// ERC20 ETH ABI settings
const ERC20ABI = require('../abi.json')

require('dotenv').config()

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

class UniswapTrader {
  constructor(params) {
    const {
      address0,
      address1,
      TEST_RPC_URL,
      WALLET_ADDRESS,
      WALLET_SECRET,
      UNISWAP_SWAP_ROUTER_ADDRESS,
      UNISWAP_FACTORY_ADDRESS,
      amountIn = '0.01'
    } = params;

    this.WALLET_ADDRESS = WALLET_ADDRESS;
    this.WALLET_SECRET = WALLET_SECRET;

    this.address0 = address0;
    this.address1 = address1;
    this.amountIn = amountIn;
    this.filteredTokens = filteredTokens;

    this.provider = new ethers.providers.JsonRpcProvider(TEST_RPC_URL);
    this.UNISWAP_SWAP_ROUTER_ADDRESS = UNISWAP_SWAP_ROUTER_ADDRESS;
    this.UNISWAP_FACTORY_ADDRESS = UNISWAP_FACTORY_ADDRESS;

    // Methods
    this.getPoolAddress = this.getPoolAddress.bind(this);
    this.doSwap = this.doSwap.bind(this);
  }

  async getPoolAddress() {
    const factoryContract = new ethers.Contract(
      this.UNISWAP_FACTORY_ADDRESS,
      UniswapV3Factory,
      this.provider
    );
    const feesPool = [500, 3000, 10000];
    let resPoolContract = null;
    for (const fee of feesPool) {
      const poolAddress = await factoryContract.getPool(this.address0, this.address1, fee);
      if (fee === 10000 && poolAddress === '0x0000000000000000000000000000000000000000') return 405;
      if (poolAddress !== '0x0000000000000000000000000000000000000000') {
          const poolContract = new ethers.Contract(
            poolAddress,
            IUniswapV3PoolABI,
            this.provider
          );
          
          const liquidity = await poolContract.liquidity();
          if (parseInt(liquidity) === 0 && fee === 10000) return 406;
          else if (parseInt(liquidity) === 0) continue;
          else resPoolContract = poolContract;
        }
    }
    return resPoolContract;
  }

  async doSwap() {
    const provider = this.provider
    const poolContract = await this.getPoolAddress();

    if ([405, 406].includes(poolContract)) return poolContract;
            
    const immutables = await getPoolImmutables(poolContract)
    const state = await getPoolState(poolContract)

    const wallet = new ethers.Wallet(this.WALLET_SECRET)
    const connectedWallet = wallet.connect(provider)

    const swapRouterContract = new ethers.Contract(
      this.UNISWAP_SWAP_ROUTER_ADDRESS,
      SwapRouterABI,
      provider
    )

    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

    let amountIn = this.amountIn;
    const tokenContract0 = new ethers.Contract(
      this.address0,
      ERC20ABI,
      provider
    );
    const tokenOutBalance = await getTokenBalance(tokenContract0, connectedWallet);
    if (tokenOutBalance <= 0.01) return 404;

    if (tokenOutBalance && this.address0 !== WETH) amountIn = tokenOutBalance;
    const tokenOutDecimals = await getTokenDecimals(tokenContract0);

    const approvalResponse = await tokenContract0.connect(connectedWallet).approve(
      this.UNISWAP_SWAP_ROUTER_ADDRESS,
      ethers.utils.parseUnits(amountIn.toString(), tokenOutDecimals)
    )
    const params = {
      tokenIn: immutables.token1,
      tokenOut: immutables.token0,
      fee: immutables.fee,
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + (60 * 10),
      amountIn: ethers.utils.parseUnits(amountIn.toString(), tokenOutDecimals),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    }
  
    const transaction = swapRouterContract.connect(connectedWallet).exactInputSingle(
      params,
      {
        gasLimit: ethers.utils.hexlify(30000000)
      }
    ).then(transaction => {
      console.log(transaction)
    })

    return 1;
  }
}

module.exports = UniswapTrader;