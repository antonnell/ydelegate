import async from 'async';
import {
  MAX_UINT256,
  ERROR,
  TX_SUBMITTED,
  STORE_UPDATED,
  DELEGATE_UPDATED,
  CONFIGURE_DELEGATE,
  DELEGATE_CONFIGURED,
  GET_ASSETS,
  ASSETS_RETURNED,
  DELEGATE_GET_BALANCES,
  DELEGATE_BALANCES_RETURNED,
  Y_DELEGATE_ADDRESS,
  AAVE_LENDING_POOL_ADDRESS,
  AAVE_ORACLE_ADDRESS
} from './constants';

import { ERC20_ABI, Y_DELEGATE_ABI, VARIABLE_DEBIT_TOKEN_ABI, YEARN_VAULT_ABI, AAVE_LENDING_POOL_ABI, AAVE_ORACLE_ABI } from './abis';

import * as moment from 'moment';

import stores from './';
import { bnDec } from '../utils';
import BigNumber from 'bignumber.js';
import delegateData from './configurations/delegate';

const fetch = require('node-fetch');

class Store {
  constructor(dispatcher, emitter) {
    this.dispatcher = dispatcher;
    this.emitter = emitter;

    this.store = {
      configured: false,
      assets: delegateData,
    };

    dispatcher.register(
      function (payload) {
        switch (payload.type) {
          case CONFIGURE_DELEGATE:
            this.configure(payload);
            break;
          case GET_ASSETS:
            this.getAssets(payload);
            break;
          case DELEGATE_GET_BALANCES:
            this.getBalances(payload);
            break;
          default: {
          }
        }
      }.bind(this),
    );
  }

  getStore = (index) => {
    return this.store[index];
  };

  setStore = (obj) => {
    this.store = { ...this.store, ...obj };
    console.log(this.store);
    return this.emitter.emit(STORE_UPDATED);
  };

  configure = async (payload) => {
    const assets = this.getStore('assets');

    // get vault APYs
    const vaultsApiResult = await fetch('https://vaults.finance/all');
    const vaults = await vaultsApiResult.json();

    async.map(
      assets,
      (asset, callback) => {
        this._getAssetsData(asset, vaults, callback);
      },
      (err, data) => {
        if (err) {
          this.emitter.emit(ERROR, err);
          return;
        }
        console.log(data);
        this.setStore({ assets: data, configured: true });

        this.dispatcher.dispatch({ type: DELEGATE_GET_BALANCES });
        this.emitter.emit(DELEGATE_CONFIGURED);
      },
    );
  };

  _getAssetsData = async (asset, vaults, callback) => {
    try {
      const web3 = await stores.accountStore.getWeb3Provider();
      if (!web3) {
        return null;
      }

      const yDelegateContract = new web3.eth.Contract(Y_DELEGATE_ABI, Y_DELEGATE_ADDRESS);

      const aaveVaultAddress = await yDelegateContract.methods.approval(asset.address).call();
      const yearnVaultAddress = await yDelegateContract.methods.vault(asset.address).call();

      const aaveLendingPoolContract = new web3.eth.Contract(AAVE_LENDING_POOL_ABI, AAVE_LENDING_POOL_ADDRESS);

      const reserveData = await aaveLendingPoolContract.methods.getReserveData(asset.address).call();

      // GET AAVE VAULT INFO
      const variableDebtContract = new web3.eth.Contract(VARIABLE_DEBIT_TOKEN_ABI, aaveVaultAddress);

      const aaveVaultMetadata = {
        address: aaveVaultAddress,
        symbol: await variableDebtContract.methods.symbol().call(),
        decimals: parseInt(await variableDebtContract.methods.decimals().call()),
        borrowRate: BigNumber(reserveData.currentVariableBorrowRate).div(1e25).toFixed(25),
      };

      asset.aaveVaultMetadata = aaveVaultMetadata;

      // GET YEARN VAULT INFO
      let theVault = null;
      const yearnVault = vaults.filter((vault) => {
        if (!vault.address) {
          return false;
        }

        return vault.address.toLowerCase() === yearnVaultAddress.toLowerCase();
      });

      if (yearnVault && yearnVault.length > 0) {
        theVault = yearnVault[0];
      }

      const yearnVaultContract = new web3.eth.Contract(YEARN_VAULT_ABI, yearnVaultAddress);

      const yearnVaultMetadata = {
        address: yearnVaultAddress,
        symbol: await yearnVaultContract.methods.symbol().call(),
        decimals: parseInt(await yearnVaultContract.methods.decimals().call()),
        apy: BigNumber(theVault?.apy.recommended).times(100).toFixed(4),
        pricePerShare: BigNumber(theVault?.tvl.price).toFixed(4),
      };

      asset.yearnVaultMetadata = yearnVaultMetadata;

      if (callback) {
        return callback(null, asset);
      } else {
        return asset;
      }
    } catch (ex) {
      console.log(asset);
      console.log(ex);
      callback(ex);
    }
  };

  getAssets = async (payload) => {
    const assets = await this._getAssets();

    this.emitter.emit(ASSETS_RETURNED, assets);
  };

  _getAssets = async () => {
    // for now just return stored projects
    return this.getStore('assets');
  };

  getBalances = async (payload) => {
    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return null;
    }

    const account = await stores.accountStore.getStore('account');
    if (!account) {
      return null;
    }

    const assets = await this._getAssets();

    //get all asset balances
    const assetBalancesPromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {
        const erc20Contract = new web3.eth.Contract(ERC20_ABI, asset.address);

        resolve(erc20Contract.methods.balanceOf(account.address).call());
      });
    });
    const assetBalances = await Promise.all(assetBalancesPromise);

    //get all aave balances
    const aaveVaultBalancesPromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {
        const variableDebtContract = new web3.eth.Contract(VARIABLE_DEBIT_TOKEN_ABI, asset.aaveVaultMetadata.address);

        resolve(variableDebtContract.methods.balanceOf(account.address).call());
      });
    });
    const aaveVaultBalances = await Promise.all(aaveVaultBalancesPromise);

    //get all aave allowances
    const aaveVaultAllowancePromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {
        const erc20Contract = new web3.eth.Contract(ERC20_ABI, asset.address);

        resolve(erc20Contract.methods.allowance(account.address, asset.aaveVaultMetadata.address).call());
      });
    });
    const aaveVaultAllowances = await Promise.all(aaveVaultAllowancePromise);

    //get all yearn balances
    const yearnVaultBalancesPromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {
        const yearnVaultContract = new web3.eth.Contract(YEARN_VAULT_ABI, asset.yearnVaultMetadata.address);

        resolve(yearnVaultContract.methods.balanceOf(account.address).call());
      });
    });
    const yearnVaultBalances = await Promise.all(yearnVaultBalancesPromise);

    //get all yearn allowances
    const yearnVaultAllowancePromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {
        const erc20Contract = new web3.eth.Contract(ERC20_ABI, asset.address);

        resolve(erc20Contract.methods.allowance(account.address, asset.yearnVaultMetadata.address).call());
      });
    });
    const yearnVaultAllowances = await Promise.all(yearnVaultAllowancePromise);


    //get aave asset prices
    const aaveOracleContract = new web3.eth.Contract(AAVE_ORACLE_ABI, AAVE_ORACLE_ADDRESS);
    const aaveOraclePricesPromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {
        resolve(aaveOracleContract.methods.getAssetPrice(asset.address).call());
      });
    });
    const aaveOraclePrices = await Promise.all(aaveOraclePricesPromise);

    //little bit hacky, get 1/(USDC/ETH) price to get price per ETH.. for dollar conversion
    const ethPriceUSDC = await aaveOracleContract.methods.getAssetPrice('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48').call()
    const ethPriceDAI = await aaveOracleContract.methods.getAssetPrice('0x6b175474e89094c44da98b954eedeac495271d0f').call()
    const ethPriceUSDT = await aaveOracleContract.methods.getAssetPrice('0xdac17f958d2ee523a2206206994597c13d831ec7').call()
    const ethPrice = BigNumber(1).div(BigNumber(ethPriceUSDC).plus(ethPriceDAI).plus(ethPriceUSDT).div(3).div(1e18).toNumber()).toFixed(18)



    //GET AAVE OVERVIEW
    const aaveLendingPoolContract = new web3.eth.Contract(AAVE_LENDING_POOL_ABI, AAVE_LENDING_POOL_ADDRESS);
    const aaveUserAccountData = await aaveLendingPoolContract.methods.getUserAccountData(account.address).call();

    aaveUserAccountData.totalCollateralETH = BigNumber(aaveUserAccountData.totalCollateralETH).div(1e18).toFixed(18);
    aaveUserAccountData.availableBorrowsETH = BigNumber(aaveUserAccountData.availableBorrowsETH).div(1e18).toFixed(18);
    aaveUserAccountData.totalDebtETH = BigNumber(aaveUserAccountData.totalDebtETH).div(1e18).toFixed(18);

    aaveUserAccountData.totalCollateralUSD = BigNumber(aaveUserAccountData.totalCollateralETH).times(ethPrice).toFixed(18);
    aaveUserAccountData.availableBorrowsUSD = BigNumber(aaveUserAccountData.availableBorrowsETH).times(ethPrice).toFixed(18);
    aaveUserAccountData.totalDebtUSD = BigNumber(aaveUserAccountData.totalDebtETH).times(ethPrice).toFixed(18);

    this.setStore({ aaveUserAccountData: aaveUserAccountData });


    for (let i = 0; i < assets.length; i++) {
      assets[i].balance = BigNumber(assetBalances[i])
        .div(10 ** assets[i].decimals)
        .toFixed(assets[i].decimals);

      assets[i].aaveVaultMetadata.balance = BigNumber(aaveVaultBalances[i])
        .div(10 ** assets[i].aaveVaultMetadata.decimals)
        .toFixed(assets[i].aaveVaultMetadata.decimals);

      assets[i].aaveVaultMetadata.allowance = BigNumber(aaveVaultAllowances[i])
        .div(10 ** assets[i].aaveVaultMetadata.decimals)
        .toFixed(assets[i].aaveVaultMetadata.decimals);

      assets[i].yearnVaultMetadata.balance = BigNumber(yearnVaultBalances[i])
        .div(10 ** assets[i].yearnVaultMetadata.decimals)
        .toFixed(assets[i].yearnVaultMetadata.decimals);

      assets[i].yearnVaultMetadata.allowance = BigNumber(yearnVaultAllowances[i])
        .div(10 ** assets[i].yearnVaultMetadata.decimals)
        .toFixed(assets[i].yearnVaultMetadata.decimals);

      assets[i].oraclePriceETH = BigNumber(aaveOraclePrices[i])
        .div(1e18)
        .toFixed(18);

      assets[i].oraclePriceUSD = BigNumber(aaveOraclePrices[i])
        .times(ethPrice)
        .div(1e18)
        .toFixed(18);

      assets[i].availableToBorrow = BigNumber(aaveUserAccountData.availableBorrowsETH).div(assets[i].oraclePriceETH).toFixed(18)

    }
    this.setStore({ assets: assets });

    this.emitter.emit(DELEGATE_BALANCES_RETURNED, assets);
  };

  _callContract = (web3, contract, method, params, account, gasPrice, dispatchEvent, dispatchEventPayload, callback) => {
    const context = this;
    contract.methods[method](...params)
      .send({
        from: account.address,
        gasPrice: web3.utils.toWei(gasPrice, 'gwei'),
      })
      .on('transactionHash', function (hash) {
        context.emitter.emit(TX_SUBMITTED, hash);
        callback(null, hash);
      })
      .on('confirmation', function (confirmationNumber, receipt) {
        if (dispatchEvent && confirmationNumber == 0) {
          context.dispatcher.dispatch({ type: dispatchEvent, content: dispatchEventPayload });
        }
      })
      .on('error', function (error) {
        if (!error.toString().includes('-32601')) {
          if (error.message) {
            return callback(error.message);
          }
          callback(error);
        }
      })
      .catch((error) => {
        if (!error.toString().includes('-32601')) {
          if (error.message) {
            return callback(error.message);
          }
          callback(error);
        }
      });
  };

  _callContractWait = (web3, contract, method, params, account, gasPrice, dispatchEvent, dispatchEventPayload, callback) => {
    const context = this;
    contract.methods[method](...params)
      .send({
        from: account.address,
        gasPrice: web3.utils.toWei(gasPrice, 'gwei'),
      })
      .on('transactionHash', function (hash) {
        context.emitter.emit(TX_SUBMITTED, hash);
      })
      .on('receipt', function (receipt) {
        callback(null, receipt.transactionHash);

        if (dispatchEvent) {
          context.dispatcher.dispatch({ type: dispatchEvent, content: dispatchEventPayload });
        }
      })
      // .on('confirmation', function (confirmationNumber, receipt) {
      //   console.log(receipt)
      //   console.log(confirmationNumber)
      //   if(confirmationNumber === 0) {
      //     callback(null, hash);
      //
      //     if (dispatchEvent) {
      //       context.dispatcher.dispatch({ type: dispatchEvent, content: dispatchEventPayload });
      //     }
      //   }
      //
      // })
      .on('error', function (error) {
        if (!error.toString().includes('-32601')) {
          if (error.message) {
            return callback(error.message);
          }
          callback(error);
        }
      })
      .catch((error) => {
        if (!error.toString().includes('-32601')) {
          if (error.message) {
            return callback(error.message);
          }
          callback(error);
        }
      });
  };
}

export default Store;
