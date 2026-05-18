// apps/customer-web/app/sign-in/page.tsx
//
// Server component shell — reads searchParams as props (no Suspense needed)
// and passes rawReturnTo to SignInPageClient which handles the OTP flow.
import React from 'react';
import { SignInPageClient } from './sign-in-page-client';

export default function SignInPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): JSX.Element {
  const rawReturnTo = typeof searchParams.returnTo === 'string'
    ? searchParams.returnTo
    : null;
  return <SignInPageClient rawReturnTo={rawReturnTo} />;
}
