import React, { useState, useEffect } from "react";
import { Typography, Tooltip, Paper } from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";
import { withTheme } from "@material-ui/core/styles";
import BigNumber from "bignumber.js";
import InfoIcon from "@material-ui/icons/Info";

import classes from "./assetInformation.module.css";

import { formatCurrency } from "../../utils";

function AssetInformation({ asset, theme }) {
  return (
    <Paper
      elevation={0}
      className={
        theme.palette.type === "dark"
          ? classes.vaultActionContainerDark
          : classes.vaultActionContainer
      }
    >
      <div className={classes.cdpTitleContainer}>
        <Typography variant="h2">
          {asset.symbol} in AAVE
        </Typography>
        <img
          src='/aave.svg'
          alt=""
          width={30}
          height={30}
          className={classes.cdpIcon}
        />
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Available to Borrow
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
          {formatCurrency(asset.availableToBorrow)} {asset.symbol}
        </Typography>
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Price
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
           $ {formatCurrency(asset.oraclePriceUSD, 4)}
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
           {formatCurrency(asset.oraclePriceETH, 4)} ETH
        </Typography>
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Variable Borrow Rate
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
          {formatCurrency(asset.aaveVaultMetadata?.borrowRate, 4)}%
        </Typography>
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Deposit
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
          <a href='https://app.aave.com/deposit' target='_blank'>Deposit {asset.symbol} on AAVE</a>
        </Typography>
      </div>
    </Paper>
  );
}

export default withTheme(AssetInformation);
