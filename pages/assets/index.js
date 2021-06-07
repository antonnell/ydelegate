import React, { useState, useEffect } from 'react';

import { Typography, Paper, Button, CircularProgress } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import { withTheme } from '@material-ui/core/styles';

import Layout from '../../components/layout/layout.js';
import Header from '../../components/header';
import Footer from '../../components/footer';
import AssetTable from '../../components/assetTable';
import Balances from '../../components/balances'

import AddIcon from '@material-ui/icons/Add';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';

import classes from './assets.module.css';

import stores from '../../stores/index.js';
import { ERROR, GET_ASSETS, ASSETS_RETURNED, DELEGATE_CONFIGURED, DELEGATE_BALANCES_RETURNED, ACCOUNT_CHANGED, CONNECT_WALLET } from '../../stores/constants';

import { formatCurrency, formatAddress } from '../../utils';

function Assets({ changeTheme, theme }) {

  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState(null);
  const [account, setAccount] = useState(null);

  const onConnectWallet = () => {
    stores.emitter.emit(CONNECT_WALLET);
  };

  useEffect(function () {
    const assetsReturned = () => {
      const storeAssets = stores.delegateStore.getStore('assets')
      setAssets(storeAssets);
      setLoading(false);
      forceUpdate()
    };

    const delegateReturned = (assets) => {
      stores.dispatcher.dispatch({ type: GET_ASSETS, content: {} });
    };

    const accountChanged = () => {
      setAccount(stores.accountStore.getStore('account'))
    }

    setAccount(stores.accountStore.getStore('account'))

    stores.emitter.on(ASSETS_RETURNED, assetsReturned);
    stores.emitter.on(DELEGATE_CONFIGURED, delegateReturned);
    stores.emitter.on(DELEGATE_BALANCES_RETURNED, delegateReturned);
    stores.emitter.on(ACCOUNT_CHANGED, accountChanged);

    setLoading(true);
    stores.dispatcher.dispatch({ type: GET_ASSETS, content: {} });

    return () => {
      stores.emitter.removeListener(ASSETS_RETURNED, assetsReturned);
      stores.emitter.removeListener(DELEGATE_CONFIGURED, delegateReturned);
      stores.emitter.removeListener(DELEGATE_BALANCES_RETURNED, delegateReturned);
      stores.emitter.removeListener(ACCOUNT_CHANGED, accountChanged);
    };
  }, []);

  return (
    <Layout changeTheme={changeTheme}>
      <div className={theme.palette.type === 'dark' ? classes.containerDark : classes.container}>
        <div className={theme.palette.type === 'dark' ? classes.listContainerDark : classes.listContainer}>
          <div className={theme.palette.type === 'dark' ? classes.headerContainerDark : classes.headerContainer}>
            <Header changeTheme={changeTheme} />
          </div>
          <div>
            <Balances />
          </div>
          {
            !account &&
            <div className={ classes.marketing}>
              <div>
                <Typography variant='h1' className={ classes.blueText }>yDelegate</Typography>
                <Typography variant='h2' className={ classes.helperText }>Maximizing your profits using the power of Yearn vaults</Typography>
                <Typography className={ classes.helperText }>yDelegate puts your idle Aave capital to work. Making use of Yearn's Vaults, your funds will generate consistant yield without any additional management from you.</Typography>
                <Button
                  size='large'
                  color='primary'
                  variant='contained'
                  onClick={onConnectWallet}
                  disabled={loading}
                  endIcon={<AddIcon />}>
                  <Typography variant="h5">Connect Wallet</Typography>
                </Button>
              </div>
              <div className={ classes.protocols }>
                <img src='/aave.svg' alt='Aave logo' width={120} height={120} className={ classes.protocolIcon } />
                <ArrowForwardIcon />
                <img src='/favicon.png' alt='YFI logo' width={120} height={120} className={ classes.protocolIcon } />
              </div>
            </div>
          }
          { account && account.address && <div className={classes.tableContainer}>{<AssetTable assets={assets} />}</div>}
          <Footer />
        </div>
      </div>
    </Layout>
  );
}

export default withTheme(Assets);
