import { Module } from '@nestjs/common';
import { DateScalar } from './scalars/date.scalar';

@Module({
  controllers: [],
  providers: [DateScalar],
  exports: [DateScalar],
})
export class GraphqlModule {}
