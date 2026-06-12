import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppMetadata } from './models/app-metadata.model';
import { LogList } from './models/log-entry.model';
import { GenericMutationResult } from '@fotobox/nest-graphql';
import { clearLogBuffer, getLogger, getRecentLogs } from '@fotobox/logging';

const logger = getLogger('AppResolver');

@Resolver(() => AppMetadata)
export class AppResolver {
  @Query(() => AppMetadata, { 
    description: 'Get application metadata including version, name, and platform' 
  })
  appMetadata(): AppMetadata {
    logger.debug('Fetching app metadata');
    
    // Get version from package.json
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../../../../../package.json');
    
    return {
      version: packageJson.version || '0.0.0',
      name: packageJson.name || 'fotobox',
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Query(() => String, { 
    description: 'Get application version' 
  })
  appVersion(): string {
    logger.debug('Fetching app version');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../../../../../package.json');
    return packageJson.version || '0.0.0';
  }

  @Query(() => LogList, {
    description: 'Recent server log entries (newest last)',
  })
  recentLogs(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 200 })
    limit: number,
  ): LogList {
    const entries = getRecentLogs(limit);
    return { entries, total: entries.length };
  }

  @Mutation(() => GenericMutationResult, {
    description: 'Clear the in-memory server log buffer',
  })
  clearLogs(): GenericMutationResult {
    clearLogBuffer();
    logger.info('In-memory log buffer cleared');
    return { success: true, message: 'Log buffer cleared' };
  }
}
