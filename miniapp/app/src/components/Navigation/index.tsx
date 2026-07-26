'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { Home } from 'iconoir-react';

/**
 * Single primary surface — remove dead Wallet/Profile tabs from the template.
 */
export const Navigation = () => {
  return (
    <Tabs value="home" onValueChange={() => undefined}>
      <TabItem value="home" icon={<Home />} label="Mandate" />
    </Tabs>
  );
};
