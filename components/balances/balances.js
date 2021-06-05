import React, { useState, useEffect } from 'react';

import { Typography, Paper, TextField, InputAdornment, Grid } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import classes from './balances.module.css';
import BigNumber from 'bignumber.js';

import stores from '../../stores/index.js';
import { DELEGATE_BALANCES_RETURNED } from '../../stores/constants';

import { formatCurrency, formatAddress } from '../../utils';

function Balances() {

  const [aaveData, setAaveData] = useState(null);

  useEffect(function () {
    const delegateReturned = () => {
      const aaveUserAccountData = stores.delegateStore.getStore('aaveUserAccountData')

      console.log(aaveUserAccountData)
      setAaveData(aaveUserAccountData)
    };

    stores.emitter.on(DELEGATE_BALANCES_RETURNED, delegateReturned);

    return () => {
      stores.emitter.removeListener(DELEGATE_BALANCES_RETURNED, delegateReturned);
    };
  }, []);

  return (
    <Paper elevation={1} className={classes.overviewContainer}>
      <div className={classes.overviewCard}>
        <div>
          <Typography variant="h5">Aave Collateral</Typography>
          <Typography variant="h2">{ formatCurrency(aaveData ? aaveData.totalCollateralETH : 0, 4) } ETH</Typography>
        </div>
      </div>
      <div className={classes.separator}></div>
      <div className={classes.overviewCard}>
        <div>
          <Typography variant="h5">Aave Borrow Limit</Typography>
          <Typography variant="h2">{ formatCurrency(aaveData ? aaveData.availableBorrowsETH : 0, 4) } ETH</Typography>
        </div>
      </div>
      <div className={classes.separator}></div>
      <div className={classes.overviewCard}>
        <div>
          <Typography variant="h5">Aave Health Factor</Typography>
          <Typography variant="h2">{ aaveData?.healthFactor > 100 ? "Safe" : aaveData?.healthFactor }</Typography>
        </div>
      </div>
    </Paper>
  );
}

export default Balances;
