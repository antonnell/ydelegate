import React, { useState, useEffect } from 'react';

import { Typography, Paper, TextField, InputAdornment, Grid, Tooltip } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import classes from './balances.module.css';
import BigNumber from 'bignumber.js';
import InfoIcon from '@material-ui/icons/Info';

import stores from '../../stores/index.js';
import { DELEGATE_BALANCES_RETURNED, ACCOUNT_CHANGED } from '../../stores/constants';

import { formatCurrency, formatAddress } from '../../utils';

function Balances() {

  const [aaveData, setAaveData] = useState(null);
  const [account, setAccount] = useState(null);

  useEffect(function () {
    const delegateReturned = () => {
      const aaveUserAccountData = stores.delegateStore.getStore('aaveUserAccountData')

      console.log(aaveUserAccountData)
      setAaveData(aaveUserAccountData)
    };

    const accountUpdated = () => {
      setAccount(stores.accountStore.getStore('account'))
    }

    setAccount(stores.accountStore.getStore('account'))

    stores.emitter.on(DELEGATE_BALANCES_RETURNED, delegateReturned);
    stores.emitter.on(ACCOUNT_CHANGED, accountUpdated);

    return () => {
      stores.emitter.removeListener(DELEGATE_BALANCES_RETURNED, delegateReturned);
      stores.emitter.removeListener(ACCOUNT_CHANGED, accountUpdated);
    };
  }, []);

  return (
    <Paper elevation={1} className={classes.overviewContainer}>
      { !(account && account.address && aaveData && aaveData.totalCollateralETH) &&
        <>
          <div className={classes.overviewCard}>
            <Typography variant="h2" className={classes.fillerContent}>
              yDelegate
            </Typography>
            <Typography className={classes.fillerText}>
              yDelegate takes your unused borrowable capital that is in Aave and delegates it to Yearn Vaults in order to maximize yield.
            </Typography>
          </div>
          <div className={classes.separator}></div>
          <div className={classes.overviewCard}>
            <Typography variant="h2" className={classes.fillerContent}>
              Aave
            </Typography>
            <Typography className={classes.fillerText}>
              Aave is a decentralized lending system that allows users to lend, borrow and earn interest on crypto assets, all without middlemen.
            </Typography>
          </div>
          <div className={classes.separator}></div>
          <div className={classes.overviewCard}>
            <Typography variant="h2" className={classes.fillerContent}>
              Yearn
            </Typography>
            <Typography className={classes.fillerText}>
              Yearn is a decentralized yield generation protocol. It is maintained by independant contributors and governed by YFI holders.
            </Typography>
          </div>
        </>
      }
      { (account && account.address && aaveData && aaveData.totalCollateralETH) &&
        <>
          <div className={classes.overviewCard}>
            <div>
              <Typography variant="h5">Aave Collateral
                <Tooltip title={'Aave Collateral: The value of the assets you have provided as collateral to Aave.'}>
                  <InfoIcon className={classes.infoIcon} />
                </Tooltip>
              </Typography>
              <Typography variant="h2">{ formatCurrency(aaveData ? aaveData.totalCollateralETH : 0, 4) } ETH</Typography>
            </div>
          </div>
          <div className={classes.separator}></div>
          <div className={classes.overviewCard}>
            <div>
              <Typography variant="h5">Aave Borrow Limit
                <Tooltip title={'Aave Borrow Limit: The maximum amount you can borrow from Aave.'}>
                  <InfoIcon className={classes.infoIcon} />
                </Tooltip>
              </Typography>
              <Typography variant="h2">{ formatCurrency(aaveData ? aaveData.availableBorrowsETH : 0, 4) } ETH</Typography>
            </div>
          </div>
          <div className={classes.separator}></div>
          <div className={classes.overviewCard}>
            <div>
              <Typography variant="h5">Aave Health Factor
                <Tooltip title={'Aave Health Factor: The health factor represents the safety of your loan derived from the proportion of collateral versus amount borrowed. Keep it above 1 to avoid liquidation.'}>
                  <InfoIcon className={classes.infoIcon} />
                </Tooltip>
              </Typography>
              <Typography variant="h2">{ BigNumber(aaveData?.healthFactor).div(1e18).gt(100) ? ">100" : BigNumber(aaveData?.healthFactor).div(1e18).toFixed(2) }</Typography>
            </div>
          </div>
        </>
      }
    </Paper>
  );
}

export default Balances;
