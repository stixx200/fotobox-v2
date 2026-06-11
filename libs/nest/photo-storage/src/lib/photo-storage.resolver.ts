import {
  Resolver,
  Query,
  Mutation,
  Args,
  Field,
  ObjectType,
} from '@nestjs/graphql';
import { PhotoStorageProviderService } from './photo-storage-provider.service';
import { Logger } from '@nestjs/common';

@ObjectType()
export class PhotoInfo {
  @Field()
  id!: string;

  @Field()
  path!: string;

  @Field()
  timestamp!: string;
}

@Resolver('PhotoStorage')
export class PhotoStorageResolver {
  private readonly logger = new Logger(PhotoStorageResolver.name);

  constructor(private photoStorageService: PhotoStorageProviderService) {}

  @Query(() => String, { description: 'Get the current photo directory' })
  getPhotoDirectory(): string {
    return this.photoStorageService.getPhotoDirectory();
  }

  @Query(() => [PhotoInfo], {
    description: 'List all stored photos, newest first',
  })
  photos(): PhotoInfo[] {
    return this.photoStorageService.listPhotos();
  }

  @Mutation(() => String, { description: 'Set the photo directory' })
  setPhotoDirectory(@Args('directory') directory: string): string {
    this.photoStorageService.setPhotoDirectory(directory);
    return this.photoStorageService.getPhotoDirectory();
  }

  @Query(() => Boolean, { description: 'Check if a photo exists' })
  photoExists(@Args('photoId') photoId: string): boolean {
    return this.photoStorageService.photoExists(photoId);
  }

  @Mutation(() => Boolean, { description: 'Delete a photo' })
  deletePhoto(@Args('photoId') photoId: string): boolean {
    try {
      this.photoStorageService.deletePhoto(photoId);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting photo ${photoId}:`, error);
      return false;
    }
  }
}
