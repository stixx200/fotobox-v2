import { Args, Query, Resolver } from '@nestjs/graphql';
import { DirectoryBrowserService } from './directory-browser.service';
import { DirectoryListing } from './models/directory-listing.model';

@Resolver(() => DirectoryListing)
export class DirectoryBrowserResolver {
  constructor(private readonly directoryBrowser: DirectoryBrowserService) {}

  @Query(() => DirectoryListing, {
    description:
      'List the subfolders of a directory on the host (folder picker). Defaults to the home directory.',
  })
  browseDirectory(
    @Args('path', { type: () => String, nullable: true }) path?: string,
  ): DirectoryListing {
    return this.directoryBrowser.browse(path);
  }
}
