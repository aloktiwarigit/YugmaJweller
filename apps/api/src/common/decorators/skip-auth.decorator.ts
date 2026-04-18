import { SetMetadata } from '@nestjs/common';

export const SKIP_AUTH = 'skip-auth';
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const SkipAuth = () => SetMetadata(SKIP_AUTH, true);
