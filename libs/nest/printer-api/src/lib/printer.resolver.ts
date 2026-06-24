import { Query, Resolver } from '@nestjs/graphql';
import { PrinterService } from './printer.service';
import { PrinterInfo, PrinterList } from './models/printer.model';
import { getLogger } from '@fotobox/logging';

const logger = getLogger('PrinterResolver');

@Resolver(() => PrinterInfo)
export class PrinterResolver {
  constructor(private readonly printerService: PrinterService) {}

  @Query(() => PrinterList, { description: 'Get list of available printers' })
  async availablePrinters(): Promise<PrinterList> {
    logger.debug('Fetching available printers');
    const items = await this.printerService.getAvailablePrinters();
    return {
      items,
      count: items.length,
    };
  }
}
