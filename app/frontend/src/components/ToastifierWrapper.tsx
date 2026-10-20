'use client';

import dynamic from 'next/dynamic';

const Toastifier = dynamic(() => import('@/components/Toastifier'), {
  ssr: false,
});

export default function ToastifierWrapper() {
  return <Toastifier />;
}
