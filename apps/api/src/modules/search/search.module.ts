import { Module } from '@nestjs/common';
import { SearchController, GlobalSearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController, GlobalSearchController],
  providers: [SearchService],
})
export class SearchModule {}
