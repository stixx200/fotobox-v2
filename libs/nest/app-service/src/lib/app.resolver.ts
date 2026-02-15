import { Query, Resolver } from '@nestjs/graphql';
import { AppMetadata } from './models/app-metadata.model';
import { getLogger } from '@fotobox/logging';

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
}
