import { Controller, Get } from '@nestjs/common';
import { FdbankService } from '../services/fdbank.service';

@Controller('fdbank')
export class FdbankController {
    constructor(private readonly fdbankService: FdbankService) { }

    @Get('test')
    async test() {
        return { status: 'FD Bank module is working!' };
    }
}