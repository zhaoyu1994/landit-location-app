import {
  Controller,
  Get,
  Query,
  ParseFloatPipe,
} from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(
    private readonly locationsService: LocationsService,
  ) {}

  // 指定した座標と半径から周辺の地点を取得する
  @Get()
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('long', ParseFloatPipe) long: number,
    @Query('radius', ParseFloatPipe) radius: number,
  ) {
    return this.locationsService.findNearby(lat, long, radius);
  }
}
