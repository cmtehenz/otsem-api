import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import fdbankConfig from './fdbank.config';
import { FdbankService } from './services/fdbank.service';
import { FdbankCustomerService } from './services/fdbank-customer.service';
import { FdbankPixTransferService } from './services/fdbank-pix-transfer.service';
import { FdbankController } from './controllers/fdbank.controller';
import { FdbankCustomerController } from './controllers/fdbank-customer.controller';
import { FdbankPixContactController } from './controllers/fdbank-pix-contact.controller';
import { FdbankPixContactService } from './services/fdbank-pix-contact.service';
import { FdbankBankAccountService } from './services/fdbank-bank-account.service';
import { FdbankBankAccountController } from './controllers/fdbank-bank-account.controller';
import { FdbankPixKeyService } from './services/fdbank-pix-key.service';
import { FdbankPixKeyController } from './controllers/fdbank-pix-key.controller';
import { FdbankPixTransferController } from './controllers/fdbank-pix-transfer.controller';

@Module({
    imports: [ConfigModule.forFeature(fdbankConfig)],
    providers: [FdbankService, FdbankBankAccountService, FdbankPixKeyService, FdbankCustomerService, FdbankPixContactService, FdbankPixTransferService],
    controllers: [FdbankController, FdbankPixKeyController, FdbankBankAccountController, FdbankCustomerController, FdbankPixContactController, FdbankPixTransferController],
    exports: [FdbankService, FdbankBankAccountService, FdbankCustomerService, FdbankPixContactService, FdbankPixTransferService],
})
export class FdbankModule { }