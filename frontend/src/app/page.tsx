
'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LocationItem } from './components/MapView';

// Leafletはブラウザ環境でのみ動作するため、SSRを無効化する
const MapView = dynamic(() => import('./components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      地図を読み込んでいます...
    </div>
  ),
});

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function Home() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 地図の中心座標を管理する
  const [searchCenter, setSearchCenter] = useState<[number, number]>([
    35.681236,
    139.767125,
  ]);

  // 検索半径を管理する
  const [radiusKm, setRadiusKm] = useState(5);

  // 地点情報をAPIから取得する
  const fetchLocations = useCallback(
    async (signal: AbortSignal) => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          lat: String(searchCenter[0]),
          long: String(searchCenter[1]),
          radius: String(radiusKm),
        });

        const response = await fetch(
          `${API_URL}/locations?${params.toString()}`,
          { signal },
        );

        if (!response.ok) {
          throw new Error('地点情報の取得に失敗しました。');
        }

        const data: LocationItem[] = await response.json();

        setLocations(data);

        // 検索結果に存在しない選択状態を解除する
        setSelectedLocationId((currentId) => {
          if (currentId === null) return null;

          return data.some((location) => location.id === currentId)
            ? currentId
            : null;
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error(err);
        setError('地点情報を取得できませんでした。');
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [searchCenter, radiusKm],
  );

  // 中心座標または検索半径が変更されたら再検索する
  useEffect(() => {
    const controller = new AbortController();

    fetchLocations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchLocations]);

  // 👇 在这里添加 handleMapCenterChange
  const handleMapCenterChange = useCallback(
    (lat: number, lng: number) => {
      setSearchCenter((current) => {
        if (
          Math.abs(current[0] - lat) < 0.000001 &&
          Math.abs(current[1] - lng) < 0.000001
        ) {
          return current;
        }

        return [lat, lng];
      });
    },
    [],
  );

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Location Explorer
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          地図から周辺の地点情報を探索できます。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* 地点一覧 */}
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            周辺の地点
          </h2>
          {/* 検索半径を設定する */}
          <div className="mb-5 rounded-lg bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="radius"
                className="text-sm font-medium text-gray-700"
              >
                検索半径
              </label>

              <span className="text-sm font-semibold text-blue-600">
                {radiusKm} km
              </span>
            </div>

            <input
              id="radius"
              type="range"
              min="1"
              max="20"
              step="1"
              value={radiusKm}
              onChange={(event) => {
                setRadiusKm(Number(event.target.value));
              }}
              className="w-full cursor-pointer accent-blue-600"
            />

            <div className="flex justify-between text-xs text-gray-400">
              <span>1 km</span>
              <span>20 km</span>
            </div>
          </div>
          {loading && (
            <p className="text-sm text-gray-500">
              地点情報を読み込んでいます...
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && locations.length === 0 && (
            <p className="text-sm text-gray-500">
              周辺に地点が見つかりませんでした。
            </p>
          )}

          <p className="mb-3 text-sm text-gray-500">
            {locations.length} 件の地点が見つかりました
          </p>

          <div className="max-h-[600px] space-y-3 overflow-y-auto">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => setSelectedLocationId(location.id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selectedLocationId === location.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <h3 className="font-medium text-gray-800">
                  {location.name}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {location.category}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {location.address}
                </p>
                {location.distanceKm !== undefined && (
                  <p className="mt-2 text-xs text-blue-600">
                    距離：{location.distanceKm.toFixed(2)} km
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 地図 */}
        <section className="overflow-hidden rounded-lg bg-white p-2 shadow-sm">
          <div className="h-[600px] w-full">
            <MapView
              locations={locations}
              center={searchCenter}
              selectedLocationId={selectedLocationId}
              onMarkerClick={(location) => {
                setSelectedLocationId(location.id);
              }}
              onMapCenterChange={handleMapCenterChange}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
