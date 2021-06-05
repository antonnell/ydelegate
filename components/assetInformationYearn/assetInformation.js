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
          {asset.symbol} in Yearn
        </Typography>
        <img
          src='/favicon.png'
          alt=""
          width={30}
          height={30}
          className={classes.cdpIcon}
        />
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Available To Deposit
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
          {formatCurrency(asset.availableToBorrow)} {asset.symbol}
        </Typography>
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Deposited Balance
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
           {formatCurrency(asset.yearnVaultMetadata?.balance, 4)} {asset.yearnVaultMetadata?.symbol}
        </Typography>
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Variable Growth Rate
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
          {formatCurrency(asset.yearnVaultMetadata?.apy, 4)}%
        </Typography>
      </div>
      <div className={classes.cdpInformationContainer}>
        <Typography color="textSecondary">
          Manage
        </Typography>
        <Typography variant="h5" className={classes.valueLineHeight}>
          <a href='https://yearn.fi/invest' target='_blank'>Manage {asset.symbol} vault on Yearn.fi</a>
        </Typography>
      </div>
    </Paper>
  );
}

export default withTheme(AssetInformation);
