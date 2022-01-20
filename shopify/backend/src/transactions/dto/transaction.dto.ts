import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TransactionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}
