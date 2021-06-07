import React, { useState, useEffect } from 'react';
import { Typography, Paper, Tabs, Tab, TextField, InputAdornment, Button, Grid, Slider, CircularProgress, Stepper, Step, StepLabel, StepConnector } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import BigNumber from 'bignumber.js';
import { useRouter } from 'next/router';

import classes from './yearnWithdraw.module.css';

import { formatCurrency } from '../../utils';

import { DELEGATE_WITHDRAW, DELEGATE_WITHDRAW_RETURNED, DELEGATE_APPROVE_WITHDRAW, DELEGATE_APPROVE_WITHDRAW_RETURNED, ERROR } from '../../stores/constants';
import stores from '../../stores';

export default function YearnWithdraw({ asset }) {

  const [withdrawAmount, setWithdrawAmount] = useState('0');
  const [withdrawAmountError, setWithdrawAmountError] = useState(false);
  const [activeStep, setActiveStep] = useState( asset.yearnVaultMetadata?.allowance > 0 ? 1 : 0 );

  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  useEffect(function () {
    const withdrawReturned = () => {
      setWithdrawLoading(false);

      setWithdrawAmount('0')
    };
    const approveReturned = () => {
      setApproveLoading(false);
    };

    const errorReturned = () => {
      setWithdrawLoading(false);
      setApproveLoading(false);
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

    setWithdrawLoading(true);
    stores.dispatcher.dispatch({
      type: DELEGATE_WITHDRAW,
      content: {
        asset: asset,
        amount: withdrawAmount,
      },
    });
  };

  const onApproveMax = () => {
    setApproveLoading(true);

    stores.dispatcher.dispatch({
      type: DELEGATE_APPROVE_WITHDRAW,
      content: { asset: asset, amount: 'max' },
    });
  };

  const setWithdrawAmountPercent = (percent) => {
    if (withdrawLoading) {
      return;
    }

    const amount = BigNumber(asset.yearnVaultMetadata?.balance).times(percent).div(100).toFixed(asset.yearnVaultMetadata.decimals);
    setWithdrawAmount(amount);
  };

  const getSteps = () => {
    return ['Approval', 'Withdraw'];
  }

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
              Balance: {!asset.yearnVaultMetadata?.balance && asset.yearnVaultMetadata?.balance !== 0 ? <Skeleton /> : formatCurrency(asset.yearnVaultMetadata?.balance)}
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
            endAdornment: <InputAdornment position="end">{asset.yearnVaultMetadata?.symbol}</InputAdornment>,
            startAdornment: (
              <InputAdornment position="start">
                <img src={asset.icon} alt="" width={30} height={30} />
              </InputAdornment>
            ),
          }}
        />
      </div>
      <div>
        <Stepper alternativeLabel activeStep={activeStep} >
          {getSteps().map((label) => (
            <Step key={label}>
              <StepLabel >{}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </div>
      <div className={classes.actionButton}>
        <Button
          fullWidth
          disableElevation
          variant="contained"
          color="primary"
          size="large"
          onClick={onApproveMax}
          disabled={approveLoading || BigNumber(asset.yearnVaultMetadata?.allowance).gt(withdrawAmount)}
          className={ BigNumber(asset.yearnVaultMetadata?.allowance).gt(withdrawAmount) ? classes.approvedButton : null }
        >
          <Typography variant="h5">{approveLoading ? <CircularProgress size={15} /> : ( BigNumber(asset.yearnVaultMetadata?.allowance).gt(withdrawAmount) ? 'Approved' : 'Approve')}</Typography>
        </Button>
        <Button fullWidth disableElevation variant="contained" color="primary" size="large" onClick={onWithdraw} disabled={withdrawLoading || withdrawAmount === '' || BigNumber(withdrawAmount).lte(0)}>
          <Typography variant="h5">
            {withdrawLoading ? <CircularProgress size={15} /> : 'Withdraw' }
          </Typography>
        </Button>
      </div>
    </div>
  );
}
