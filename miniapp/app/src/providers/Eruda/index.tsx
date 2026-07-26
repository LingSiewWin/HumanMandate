'use client';

import dynamic from 'next/dynamic';

const Eruda = dynamic(() => import('./eruda-provider').then((c) => c.Eruda), {
  ssr: false,
});

export const ErudaProvider = () => {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    return null;
  }
  return <Eruda />;
};
