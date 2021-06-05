import React, { useState, useEffect } from 'react';
import { Typography, Paper, Tabs, Tab, TextField, InputAdornment, Button, Grid, Slider, CircularProgress } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import BigNumber from 'bignumber.js';
import { useRouter } from 'next/router';

import classes from './yearnWithdraw.module.css';

import { formatCurrency } from '../../utils';

import { DELEGATE_WITHDRAW, DELEGATE_WITHDRAW_RETURNED, DELEGATE_APPROVE_WITHDRAW, DELEGATE_APPROVE_WITHDRAW_RETURNED, ERROR } from '../../stores/constants';
import stores from '../../stores';

export default function YearnWithdraw({ asset }) {

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAmountError, setWithdrawAmountError] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(function () {
    const withdrawReturned = () => {
      setLoading(false);
    };

    const approveReturned = () => {
      setLoading(false);
    };

    const errorReturned = () => {
      setLoading(false);
    };

    stores.emitter.on(DELEGATE_WITHDRAW_RETURNED, withdrawReturned);
    stores.emitter.on(DELEGATE_APPROVE_WITHDRAW_RETURNED, approveReturned);
    stores.emitter.on(ERROR, errorReturned);

    return () => {
      stores.emitter.removeListener(DELEGATE_WITHDRAW_RETURNED, withdrawReturned);
      stores.emitter.removeListener(DELEGATE_APPROVE_WITHDRAW_RETURNED, approveReturned);
      stores.emitter.removeListener(ERROR, errorReturned);
    };
  }, []);

  const onWithdrawAmountChanged = (event) => {
    setWithdrawAmountError(false);
    setWithdrawAmount(event.target.value);
  };

  const onWithdraw = () => {
    setWithdrawAmountError(false);

    setLoading(true);
    stores.dispatcher.dispatch({
      type: DELEGATE_WITHDRAW,
      content: {
        asset: asset,
        withdrawAmount: withdrawAmount,
      },
    });
  };

  const onApprove = () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0 || BigNumber(withdrawAmount).gt(asset.balance)) {
      setWithdrawAmountError(true);
      return false;
    }

    setLoading(true);
    stores.dispatcher.dispatch({
      type: DELEGATE_APPROVE_WITHDRAW,
      content: { asset: asset, amount: withdrawAmount },
    });
  };

  const onApproveMax = () => {
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0 || BigNumber(withdrawAmount).gt(asset.balance)) {
      setWithdrawAmountError(true);
      return false;
    }

    setLoading(true);
    stores.dispatcher.dispatch({
      type: DELEGATE_APPROVE_WITHDRAW,
      content: { asset: asset, amount: 'max' },
    });
  };

  const setWithdrawAmountPercent = (percent) => {
    if (loading) {
      return;
    }
    const amount = BigNumber(asset.balance).times(percent).div(100).toFixed(asset.decimals);
    setWithdrawAmount(amount);
  };

  return (
    <div className={classes.vaultActionContainer}>
      <div className={classes.textField}>
        <div className={classes.inputTitleContainer}>
          <div className={classes.inputTitle}>
            <Typography variant="h5" noWrap>
              Withdraw
            </Typography>
          </div>
          <div className={classes.balances}>
            <Typography
              variant="h5"
              onClick={() => {
                setWithdrawAmountPercent(100);
              }}
              className={classes.value}
              noWrap
            >
              Balance: {!asset.balance && asset.balance !== 0 ? <Skeleton /> : formatCurrency(asset.balance)}
            </Typography>
          </div>
        </div>
        <TextField
          variant="outlined"
          fullWidth
          placeholder=""
          value={withdrawAmount}
          error={withdrawAmountError}
          onChange={onWithdrawAmountChanged}
          InputProps={{
            endAdornment: <InputAdornment position="end">{asset.symbol}</InputAdornment>,
            startAdornment: (
              <InputAdornment position="start">
                <img src={asset.icon} alt="" width={30} height={30} />
              </InputAdornment>
            ),
          }}
        />
      </div>
      <div className={classes.actionButton}>
        {(withdrawAmount === '' || BigNumber(asset.allowance).gte(withdrawAmount)) && (
          <Button fullWidth disableElevation variant="contained" color="primary" size="large" onClick={onWithdraw} disabled={loading}>
            <Typography variant="h5">
              {loading ? <CircularProgress size={25} /> : 'Withdraw' }
            </Typography>
          </Button>
        )}
        {withdrawAmount !== '' &&
          BigNumber(withdrawAmount).gt(0) &&
          (!asset.allowance || BigNumber(asset.allowance).eq(0) || BigNumber(asset.allowance).lt(withdrawAmount)) && (
            <React.Fragment>
              <Button
                fullWidth
                disableElevation
                variant="contained"
                color="primary"
                size="large"
                onClick={onApprove}
                disabled={loading}
                className={classes.marginRight}
              >
                <Typography variant="h5">{loading ? <CircularProgress size={25} /> : 'Approve Exact'}</Typography>
              </Button>
              <Button
                fullWidth
                disableElevation
                variant="contained"
                color="primary"
                size="large"
                onClick={onApproveMax}
                disabled={loading}
                className={classes.marginLeft}
              >
                <Typography variant="h5">{loading ? <CircularProgress size={25} /> : 'Approve Max'}</Typography>
              </Button>
            </React.Fragment>
          )}
      </div>
    </div>
  );
}
