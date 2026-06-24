import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ShareService } from './share.service';
import { ShareLink } from './models/share-link.model';

@Resolver(() => ShareLink)
export class ShareResolver {
  constructor(private readonly shareService: ShareService) {}

  @Mutation(() => ShareLink, {
    description: 'Create a time-limited share link for a photo',
  })
  createShareLink(@Args('filename') filename: string): Promise<ShareLink> {
    return this.shareService.createShareLink(filename);
  }

  @Query(() => String, {
    description: 'Auto-detected LAN base URL for share links (settings preview)',
  })
  detectedShareBaseUrl(): string {
    return this.shareService.getDetectedShareBaseUrl();
  }
}
