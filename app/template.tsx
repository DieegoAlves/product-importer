'use client';

import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { Toaster } from 'react-hot-toast';

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider i18n={enTranslations}>
      <Toaster position="top-right" />
      {children}
    </AppProvider>
  );
}
