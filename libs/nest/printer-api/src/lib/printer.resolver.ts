import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  PhotoStorageProviderService,
  resolvePhotoPath,
} from '@fotobox/nest-photo-storage';
import { getLogger } from '@fotobox/logging';
import { PrinterService } from './printer.service';
import {
  PrinterInfo,
  PrinterList,
  PrintPhotoInput,
  PrintResult,
} from './models/printer.model';

const logger = getLogger('PrinterResolver');

@Resolver(() => PrinterInfo)
export class PrinterResolver {
  constructor(
    private readonly printerService: PrinterService,
    private readonly photoStorage: PhotoStorageProviderService,
  ) {}

  @Query(() => PrinterList, { description: 'Get list of available printers' })
  async availablePrinters(): Promise<PrinterList> {
    logger.debug('Fetching available printers');
    const items = await this.printerService.getAvailablePrinters();
    return {
      items,
      count: items.length,
    };
  }

  @Mutation(() => PrintResult, {
    description: 'Print a stored photo on the host without a print dialog',
  })
  async printPhoto(
    @Args('input') input: PrintPhotoInput,
  ): Promise<PrintResult> {
    // Throws NotFound for anything outside the photo directory.
    const filePath = resolvePhotoPath(
      this.photoStorage.getPhotoDirectory(),
      input.filename,
    );
    try {
      await this.printerService.printImage(filePath, {
        printerName: input.printerName,
        landscape: input.landscape ?? true,
      });
      return { success: true };
    } catch (error) {
      logger.error('Photo print failed', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
