'use client';

import eruda from 'eruda';
import { useEffect } from 'react';

/** Leaf, not a wrapper: keeps the `ssr: false` bailout off the app tree. */
export const Eruda = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        eruda.init();
      } catch (error) {
        console.log('Eruda failed to initialize', error);
      }
    }
  }, []);

  return null;
};
