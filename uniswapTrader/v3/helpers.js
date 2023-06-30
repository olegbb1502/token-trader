const { ethers } = require('ethers');

exports.getPoolImmutables = async (poolContract) => {
    const [token0, token1, fee] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee()
    ]);

    const immutables = {
        token0,
        token1,
        fee
    };

    return immutables;
}

exports.getPoolState = async (poolContract) => {
    const slot = await poolContract.slot0();

    const state = {
       sqrtPriceX96: slot[0] 
    };

    return state;
}

exports.getTokenBalance = async (tokenContract, wallet) => {
    const [balanceOf, demecials] = await Promise.all([
        tokenContract.balanceOf(wallet.address),
        tokenContract.decimals(),
    ]);

    return parseFloat(ethers.utils.formatUnits(balanceOf, demecials));
}

exports.getTokenDecimals = async (tokenContract) => {
    const decimals = await tokenContract.decimals();

    return decimals;
}