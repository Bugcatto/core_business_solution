import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosTerminal, Branch } from '../database/entities/index';
import { PosTerminalsService } from './pos-terminals.service';
import { PosTerminalsController } from './pos-terminals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PosTerminal, Branch])],
  providers: [PosTerminalsService],
  controllers: [PosTerminalsController],
  exports: [PosTerminalsService],
})
export class PosTerminalsModule {}
