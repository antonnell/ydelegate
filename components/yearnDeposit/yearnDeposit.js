import React, { useState, useEffect } from 'react';
import { Typography, Paper, Tabs, Tab, TextField, InputAdornment, Button, Grid, Slider, CircularProgress, Stepper, Step, StepLabel, StepConnector } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import BigNumber from 'bignumber.js';
import { useRouter } from 'next/router';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Check from '@material-ui/icons/Check';

import classes from './yearnDeposit.module.css';

import { formatCurrency } from '../../utils';

import { DELEGATE_DEPOSIT, DELEGATE_DEPOSIT_RETURNED, DELEGATE_APPROVE_DEPOSIT, DELEGATE_APPROVE_DEPOSIT_RETURNED, ERROR } from '../../stores/constants';
import stores from '../../stores';

const useStepIconStyles = makeStyles({
  root: {
    display: 'flex',
    height: 22,
    alignItems: 'center',
  },
  active: {
    color: '#16C784',
  },
  completed: {
    color: '#16C784',
    zIndex: 1,
    fontSize: 18,
  },
});

const StyledConnector = withStyles({
  alternativeLabel: {
    top: 10,
    left: 'calc(-50% + 16px)',
    right: 'calc(50% + 16px)',
  },
  active: {
    '& $line': {
      borderColor: '#784af4',
    },
  },
  completed: {
    '& $line': {
      borderColor: '#784af4',
    },
  },
  line: {
    borderColor: '#eaeaf0',
    borderTopWidth: 3,
    borderRadius: 1,
  },
})(StepConnector);

function StyledStepIcon(props) {
  const classes = useStepIconStyles();
  const { active, completed } = props;

  return (
    <div
      className={clsx(classes.root, {
        [classes.active]: active,
      })}
    >
      {completed ? <Check className={classes.completed} /> : <div className={classes.circle} />}
    </div>
  );
}

export default function YearnDeposit({ asset }) {

  const [depositAmount, setDepositAmount] = useState('0');
  const [depositAmountError, setDepositAmountError] = useState(false);
  const [activeStep, setActiveStep] = useState( asset.aaveVaultMetadata?.allowance > 0 ? 1 : 0 );

  const [approveLoading, setApproveLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);

  useEffect(function () {
    const depositReturned = () => {
      setApproveLoading(false);
      setDepositLoading(false);
    };

    const approveReturned = () => {
      setApproveLoading(false);
      setDepositLoading(false);
    };

    const errorReturned = () => {
      setApproveLoading(false);
      setDepositLoading(false);
    };

    stores.emitter.on(DELEGATE_DEPOSIT_RETURNED, depositReturned);
    stores.emitter.on(DELEGATE_APPROVE_DEPOSIT_RETURNED, approveReturned);
    stores.emitter.on(ERROR, errorReturned);

    return () => {
      stores.emitter.removeListener(DELEGATE_DEPOSIT_RETURNED, depositReturned);
      stores.emitter.removeListener(DELEGATE_APPROVE_DEPOSIT_RETURNED, approveReturned);
      stores.emitter.removeListener(ERROR, errorReturned);
    };
  }, []);

  const onDepositAmountChanged = (event) => {
    setDepositAmountError(false);
    setDepositAmount(event.target.value);
  };

  const onDeposit = () => {
    setDepositAmountError(false);

    setDepositLoading(true);
    stores.dispatcher.dispatch({
      type: DELEGATE_DEPOSIT,
      content: {
        asset: asset,
        depositAmount: depositAmount,
      },
    });
  };

  const onApproveMax = () => {
    setApproveLoading(true);

    stores.dispatcher.dispatch({
      type: DELEGATE_APPROVE_DEPOSIT,
      content: { asset: asset, amount: 'max' },
    });
  };

  const setDepositAmountPercent = (percent) => {
    if (depositLoading || approveLoading) {
      return;
    }
    const amount = BigNumber(asset.balance).times(percent).div(100).toFixed(asset.decimals);
    setDepositAmount(amount);
  };

  const getSteps = () => {
    return ['Approval', 'Deposit'];
  }

  return (
    <div className={classes.vaultActionContainer}>
      <div className={classes.textField}>
        <div className={classes.inputTitleContainer}>
          <div className={classes.inputTitle}>
            <Typography variant="h5" noWrap>
              Deposit
            </Typography>
          </div>
          <div className={classes.balances}>
            <Typography
              variant="h5"
              onClick={() => {
                setDepositAmountPercent(100);
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
          value={depositAmount}
          error={depositAmountError}
          onChange={onDepositAmountChanged}
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
          disabled={approveLoading}
          className={ BigNumber(asset.aaveVaultMetadata?.allowance).gte(depositAmount) ? classes.approvedButton : null }
        >
          <Typography variant="h5">{approveLoading ? <CircularProgress size={15} /> : ( BigNumber(asset.aaveVaultMetadata?.allowance).gte(depositAmount) ? 'Approved' : 'Approve')}</Typography>
        </Button>
        <Button fullWidth disableElevation variant="contained" color="primary" size="large" onClick={onDeposit} disabled={depositLoading || depositAmount === '' || BigNumber(depositAmount).lte(0)}>
          <Typography variant="h5">
            {depositLoading ? <CircularProgress size={15} /> : 'Deposit' }
          </Typography>
        </Button>
      </div>
    </div>
  );
}
