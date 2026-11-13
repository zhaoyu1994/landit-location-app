import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { Location } from './location.entity';

interface CsvLocationRecord {
  name: string;
  category: string;
  lat: string;
  long: string;
  address: string;
}

@Injectable()
export class LocationsService implements OnModuleInit {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedFromCsv();
  }

  private async seedFromCsv(): Promise<void> {
    // 1. データベースに登録済みのデータがあるか確認する
    const count = await this.locationRepository.count();

    if (count > 0) {
      this.logger.log(
        `Database already contains ${count} locations. Skipping import.`,
      );
      return;
    }

    // 2. CSVファイルのパスを取得して読み込む
    const csvPath = join(
      process.cwd(),
      'data',
      'landit_coding_test_seed.csv',
    );

    const content = await readFile(csvPath, 'utf-8');

    // 3. CSVの内容をオブジェクトの配列に変換する
    const records = parse(content, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvLocationRecord[];

    // 4. データの型変換と入力値の検証を行う
    const locations = records.map((record) => {
      const lat = Number(record.lat);
      const longitude = Number(record.long);

      if (
        !record.name ||
        !record.category ||
        !record.address ||
        !Number.isFinite(lat) ||
        !Number.isFinite(longitude) ||
        lat < -90 ||
        lat > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error(
          `Invalid CSV record: ${JSON.stringify(record)}`,
        );
      }

      return this.locationRepository.create({
        name: record.name,
        category: record.category,
        lat,
        long: longitude,
        address: record.address,
      });
    });

    // 5. データベースにデータを一括登録する
    await this.locationRepository.save(locations);

    this.logger.log(
      `Successfully imported ${locations.length} locations from CSV.`,
    );
  }


  // 指定した中心座標と半径から周辺の地点を検索する
  async findNearby(
    centerLat: number,
    centerLong: number,
    radiusKm: number,
  ) {
    const locations = await this.locationRepository.find();

    // 地点間の距離を計算する
    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number => {
      const earthRadius = 6371;
      const toRadians = (degrees: number) =>
        (degrees * Math.PI) / 180;

      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
          Math.cos(toRadians(lat2)) *
          Math.sin(dLon / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return earthRadius * c;
    };

    // 指定した半径内の地点だけを抽出する
    return locations
      .map((location) => ({
        ...location,
        distanceKm: calculateDistance(
          centerLat,
          centerLong,
          location.lat,
          location.long,
        ),
      }))
      .filter((location) => location.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
}
