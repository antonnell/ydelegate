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
  AAVE_ORACLE_ADDRESS,
  DELEGATE_APPROVE_DEPOSIT,
  DELEGATE_APPROVE_DEPOSIT_RETURNED,
  DELEGATE_DEPOSIT,
  DELEGATE_DEPOSIT_RETURNED,
  DELEGATE_WITHDRAW,
  DELEGATE_WITHDRAW_RETURNED,
  DELEGATE_APPROVE_WITHDRAW,
  DELEGATE_APPROVE_WITHDRAW_RETURNED
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
          case DELEGATE_APPROVE_DEPOSIT:
            this.approveDeposit(payload);
            break;
          case DELEGATE_DEPOSIT:
            this.deposit(payload);
            break;
          case DELEGATE_APPROVE_WITHDRAW:
            this.approveWithdraw(payload);
            break;
          case DELEGATE_WITHDRAW:
            this.withdraw(payload);
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

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return null;
    }

    const assets = await this._getAssets(web3)

    // get vault APYs
    const vaultsApiResult = await fetch('https://vaults.finance/all');
    const vaults = await vaultsApiResult.json();

    const yDelegateContract = new web3.eth.Contract(Y_DELEGATE_ABI, Y_DELEGATE_ADDRESS);
    const aaveLendingPoolContract = new web3.eth.Contract(AAVE_LENDING_POOL_ABI, AAVE_LENDING_POOL_ADDRESS);

    async.map(
      assets,
      (asset, callback) => {
        this._getAssetsData(asset, vaults, yDelegateContract, aaveLendingPoolContract, web3, callback);
      },
      (err, data) => {
        if (err) {
          this.emitter.emit(ERROR, err);
          return;
        }
        data = data.filter((d) => {
          return d != null
        })

        console.log(data);
        this.setStore({ assets: data, configured: true });

        this.dispatcher.dispatch({ type: DELEGATE_GET_BALANCES });
        this.emitter.emit(DELEGATE_CONFIGURED);
      },
    );
  };

  _getAssetsData = async (asset, vaults, yDelegateContract, aaveLendingPoolContract, web3, callback) => {
    try {

      let aaveVaultAddress = null
      let yearnVaultAddress = null
      try {
        aaveVaultAddress = await yDelegateContract.methods.approvalVariable(asset.address).call();
        yearnVaultAddress = await yDelegateContract.methods.vault(asset.address).call();

      } catch(ex) {
        //we expect these to fail, if the asset isn't supported by yearn, it throws an exception. yay
        callback(null, null)
        return
      }

      console.log(yearnVaultAddress)
      if(!yearnVaultAddress) {
        callback(null, null)
        return
      }

      const erc20Contract = new web3.eth.Contract(ERC20_ABI, asset.address);
      const symbol = await erc20Contract.methods.symbol().call()
      const decimals = parseInt(await erc20Contract.methods.decimals().call())

      asset.symbol = symbol
      asset.decimals = decimals

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
    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return null;
    }

    const assets = await this._getAssets(web3);

    this.emitter.emit(ASSETS_RETURNED, assets);
  };

  _getAssets = async (web3) => {

    const lendingPoolContract = new web3.eth.Contract(AAVE_LENDING_POOL_ABI, AAVE_LENDING_POOL_ADDRESS);
    const reservesList = await lendingPoolContract.methods.getReservesList().call()

    return reservesList.map((reserveAddress) => {
      return {
        address: reserveAddress,
        icon: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${web3.utils.toChecksumAddress(reserveAddress)}/logo.png`
      }
    })
  }

  getBalances = async (payload) => {
    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return null;
    }

    const account = await stores.accountStore.getStore('account');
    if (!account) {
      return null;
    }

    const assets = this.getStore('assets');

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
        const erc20Contract = new web3.eth.Contract(YEARN_VAULT_ABI, asset.yearnVaultMetadata.address);

        resolve(erc20Contract.methods.allowance(account.address, Y_DELEGATE_ADDRESS).call());
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



    const yDelegateContract = new web3.eth.Contract(Y_DELEGATE_ABI, Y_DELEGATE_ADDRESS);

    //get all aave allowances
    const aaveVaultAllowancePromise = assets.map((asset) => {
      return new Promise((resolve, reject) => {

        resolve(yDelegateContract.methods.availableVariable(account.address, asset.address).call());
      });
    });
    const aaveVaultAllowances = await Promise.all(aaveVaultAllowancePromise);

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

  approveDeposit = async (payload) => {
    const account = stores.accountStore.getStore('account');
    if (!account) {
      return false;
    }

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return false;
    }

    const { asset, amount, gasSpeed } = payload.content;

    this._callApproveDeposit(web3, asset, account, amount, gasSpeed, (err, approveResult) => {
      if (err) {
        return this.emitter.emit(ERROR, err);
      }

      return this.emitter.emit(DELEGATE_APPROVE_DEPOSIT_RETURNED, approveResult);
    });
  };

  _callApproveDeposit = async (web3, asset, account, amount, gasSpeed, callback) => {
    const tokenContract = new web3.eth.Contract(VARIABLE_DEBIT_TOKEN_ABI, asset.aaveVaultMetadata.address);

    let amountToSend = '0';
    if (amount === 'max') {
      amountToSend = MAX_UINT256;
    } else {
      amountToSend = BigNumber(amount)
        .times(10 ** asset.aaveVaultMetadata.decimals)
        .toFixed(0);
    }

    const gasPrice = await stores.accountStore.getGasPrice(gasSpeed);

    this._callContractWait(web3, tokenContract, 'approveDelegation', [Y_DELEGATE_ADDRESS, amountToSend], account, gasPrice, DELEGATE_GET_BALANCES, {}, callback);
  };

  approveWithdraw = async (payload) => {
    const account = stores.accountStore.getStore('account');
    if (!account) {
      return false;
    }

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return false;
    }

    const { asset, amount, gasSpeed } = payload.content;

    this._callApproveWithdraw(web3, asset, account, amount, gasSpeed, (err, approveResult) => {
      if (err) {
        return this.emitter.emit(ERROR, err);
      }

      return this.emitter.emit(DELEGATE_APPROVE_WITHDRAW_RETURNED, approveResult);
    });
  };

  _callApproveWithdraw = async (web3, asset, account, amount, gasSpeed, callback) => {
    const tokenContract = new web3.eth.Contract(YEARN_VAULT_ABI, asset.yearnVaultMetadata.address);

    let amountToSend = '0';
    if (amount === 'max') {
      amountToSend = MAX_UINT256;
    } else {
      amountToSend = BigNumber(amount)
        .times(10 ** asset.yearnVaultMetadata.decimals)
        .toFixed(0);
    }

    const gasPrice = await stores.accountStore.getGasPrice(gasSpeed);

    this._callContractWait(web3, tokenContract, 'approve', [Y_DELEGATE_ADDRESS, amountToSend], account, gasPrice, DELEGATE_GET_BALANCES, {}, callback);
  };

  deposit = async (payload) => {
    const account = stores.accountStore.getStore('account');
    if (!account) {
      return false;
    }

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return false;
    }

    const { asset, amount, gasSpeed } = payload.content;

    this._callDeposit(web3, asset, account, amount, gasSpeed, (err, depositResult) => {
      if (err) {
        return this.emitter.emit(ERROR, err);
      }

      return this.emitter.emit(DELEGATE_DEPOSIT_RETURNED, depositResult);
    });
  };

  _callDeposit = async (web3, asset, account, amount, gasSpeed, callback) => {

    const yDelegateContract = new web3.eth.Contract(Y_DELEGATE_ABI, Y_DELEGATE_ADDRESS);

    const amountToSend = BigNumber(amount)
      .times(10 ** asset.decimals)
      .toFixed(0);

    const gasPrice = await stores.accountStore.getGasPrice(gasSpeed);

    this._callContractWait(web3, yDelegateContract, 'deposit', [asset.address, amountToSend, 2], account, gasPrice, DELEGATE_GET_BALANCES, {}, callback);
  };

  withdraw = async (payload) => {
    const account = stores.accountStore.getStore('account');
    if (!account) {
      return false;
    }

    const web3 = await stores.accountStore.getWeb3Provider();
    if (!web3) {
      return false;
    }

    const { asset, amount, gasSpeed } = payload.content;

    this._callwithdraw(web3, asset, account, amount, gasSpeed, (err, withdrawResult) => {
      if (err) {
        return this.emitter.emit(ERROR, err);
      }

      return this.emitter.emit(DELEGATE_WITHDRAW_RETURNED, withdrawResult);
    });
  };

  _callwithdraw = async (web3, asset, account, amount, gasSpeed, callback) => {
    const yDelegateContract = new web3.eth.Contract(Y_DELEGATE_ABI, Y_DELEGATE_ADDRESS);

    const amountToSend = BigNumber(amount)
      .times(10 ** asset.yearnVaultMetadata.decimals)
      .toFixed(0);

    const maxLoss = BigNumber(amount)
      .times(0.03)
      .times(10 ** asset.yearnVaultMetadata.decimals)
      .toFixed(0);

    const gasPrice = await stores.accountStore.getGasPrice(gasSpeed);

    this._callContractWait(web3, yDelegateContract, 'withdraw', [asset.address, amountToSend, maxLoss, 2], account, gasPrice, DELEGATE_GET_BALANCES, {}, callback);
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
      // .on('receipt', function (receipt) {
      //   callback(null, receipt.transactionHash);
      //
      //   if (dispatchEvent) {
      //     context.dispatcher.dispatch({ type: dispatchEvent, content: dispatchEventPayload });
      //   }
      // })
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
        console.log(hash)
        // context.emitter.emit(TX_SUBMITTED, hash);
      })
      .on('receipt', function (receipt) {
        context.emitter.emit(TX_SUBMITTED, receipt.transactionHash);
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
