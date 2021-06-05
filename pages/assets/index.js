import React, { useState, useEffect } from 'react';

import { Typography, Paper, Button, CircularProgress } from '@material-ui/core';
import Skeleton from '@material-ui/lab/Skeleton';
import { withTheme } from '@material-ui/core/styles';

import Layout from '../../components/layout/layout.js';
import Header from '../../components/header';
import AssetTable from '../../components/assetTable';
import Balances from '../../components/balances'

import classes from './assets.module.css';

import stores from '../../stores/index.js';
import { ERROR, GET_ASSETS, ASSETS_RETURNED, DELEGATE_CONFIGURED, DELEGATE_BALANCES_RETURNED } from '../../stores/constants';

import { formatCurrency, formatAddress } from '../../utils';

function Assets({ changeTheme, theme }) {

  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState(null);

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

    stores.emitter.on(ASSETS_RETURNED, assetsReturned);
    stores.emitter.on(DELEGATE_CONFIGURED, delegateReturned);
    stores.emitter.on(DELEGATE_BALANCES_RETURNED, delegateReturned);

    setLoading(true);
    stores.dispatcher.dispatch({ type: GET_ASSETS, content: {} });

    return () => {
      stores.emitter.removeListener(ASSETS_RETURNED, assetsReturned);
      stores.emitter.removeListener(DELEGATE_CONFIGURED, delegateReturned);
      stores.emitter.removeListener(DELEGATE_BALANCES_RETURNED, delegateReturned);
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
          {loading && (
            <div className={classes.projectsLoading}>
              <Typography variant="h5" className={classes.projectsLoadingSpace}>
                We are loading the assets
              </Typography>
              <CircularProgress size={15} />
            </div>
          )}
          {!loading && <div className={classes.tableContainer}>{assets && assets.length > 0 && <AssetTable assets={assets} />}</div>}
        </div>
      </div>
    </Layout>
  );
}

export default withTheme(Assets);
