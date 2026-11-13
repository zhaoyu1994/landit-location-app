
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

export interface LocationItem {
  id: number;
  name: string;
  category: string;
  lat: number;
  long: number;
  address: string;
  distanceKm?: number;
}

interface MapViewProps {
  locations: LocationItem[];
  center?: [number, number];
  selectedLocationId?: number | null;
  onMarkerClick?: (location: LocationItem) => void;
  onMapCenterChange?: (lat: number, lng: number) => void;
}

// 通常のマーカーアイコンを定義する
const markerIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: #2563eb;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 5px rgba(0,0,0,0.4);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// 選択状態のマーカーアイコンを定義する
const selectedMarkerIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: #f97316;
      border: 4px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 8px rgba(0,0,0,0.5);
    "></div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// 選択された地点に合わせて地図を移動する
// 選択された地点に合わせて地図を移動する
function MapController({
  selectedLocation,
}: {
  selectedLocation?: LocationItem;
}) {
  const map = useMap();

  const selectedId = selectedLocation?.id;
  const selectedLat = selectedLocation?.lat;
  const selectedLng = selectedLocation?.long;

  useEffect(() => {
    if (
      selectedId === undefined ||
      selectedLat === undefined ||
      selectedLng === undefined
    ) {
      return;
    }

    const currentCenter = map.getCenter();

    // 地図がすでに対象地点を中心にしている場合は移動しない
    if (
      Math.abs(currentCenter.lat - selectedLat) < 0.000001 &&
      Math.abs(currentCenter.lng - selectedLng) < 0.000001
    ) {
      return;
    }

    map.setView(
      [selectedLat, selectedLng],
      map.getZoom(),
      { animate: true },
    );
  }, [selectedId, selectedLat, selectedLng, map]);

  return null;
}


// 地図の移動終了イベントを監視する
function MapEvents({
  onCenterChanged,
  onMapCenterChange,
}: {
  onCenterChanged: (lat: number, lng: number) => void;
  onMapCenterChange?: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  // 最新のコールバックを保持する
  const onCenterChangedRef = useRef(onCenterChanged);
  const onMapCenterChangeRef = useRef(onMapCenterChange);

  useEffect(() => {
    onCenterChangedRef.current = onCenterChanged;
    onMapCenterChangeRef.current = onMapCenterChange;
  }, [onCenterChanged, onMapCenterChange]);

  // 地図のイベントを登録する
  useEffect(() => {
    const handleMoveEnd = () => {
      const center = map.getCenter();

      // 中心地点の住所を取得する
      onCenterChangedRef.current(center.lat, center.lng);

      // 親コンポーネントに地図の中心座標を通知する
      onMapCenterChangeRef.current?.(center.lat, center.lng);
    };

    map.on('moveend', handleMoveEnd);

    // 初期表示時にも中心地点の情報を通知する
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map]);

  return null;
}


export default function MapView({
  locations,
  center = [35.681236, 139.767125],
  selectedLocationId,
  onMarkerClick,
  onMapCenterChange,
}: MapViewProps) {
  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
  );

  const [centerAddress, setCenterAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');

  // 住所検索のキャッシュを保持する
  const addressCache = useRef(new Map<string, string>());

  // リクエストの実行時刻とタイマーを管理する
  const lastRequestTime = useRef(0);
  const lastRequestedKey = useRef('');
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequence = useRef(0);

  // 地図の中心座標から住所を取得する
  const handleCenterChanged = useCallback((lat: number, lng: number) => {
    // 小数点以下4桁に丸めて、微小な座標変化を無視する
    const roundedLat = Number(lat.toFixed(4));
    const roundedLng = Number(lng.toFixed(4));
    const cacheKey = `${roundedLat},${roundedLng}`;

    // 前回と同じ座標なら処理しない
    if (cacheKey === lastRequestedKey.current) {
      return;
    }

    // 前回のタイマーをキャンセルする
    if (requestTimer.current) {
      clearTimeout(requestTimer.current);
    }

    // 古いリクエストの結果を無効にする
    const currentSequence = ++requestSequence.current;

    // キャッシュに住所があればAPIを呼び出さない
    const cachedAddress = addressCache.current.get(cacheKey);

    if (cachedAddress) {
      lastRequestedKey.current = cacheKey;
      setCenterAddress(cachedAddress);
      setGeocodingError('');
      setIsGeocoding(false);
      return;
    }

    setIsGeocoding(true);
    setGeocodingError('');

    // 最後のリクエストから1秒以上空ける
    const elapsed = Date.now() - lastRequestTime.current;
    const waitTime = Math.max(0, 1200 - elapsed);

    // 地図の移動終了後、少し待ってから住所を検索する
    requestTimer.current = setTimeout(async () => {
      try {
        lastRequestTime.current = Date.now();
        lastRequestedKey.current = cacheKey;

        const params = new URLSearchParams({
          format: 'jsonv2',
          lat: String(roundedLat),
          lon: String(roundedLng),
          'accept-language': 'ja',
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error('住所情報の取得に失敗しました。');
        }

        const data = await response.json();

        if (!data.display_name) {
          throw new Error('住所が見つかりませんでした。');
        }

        // 取得した住所をキャッシュに保存する
        addressCache.current.set(cacheKey, data.display_name);

        // 最新のリクエスト結果だけを画面に反映する
        if (currentSequence === requestSequence.current) {
          setCenterAddress(data.display_name);
          setGeocodingError('');
        }
      } catch (error) {
        console.error(error);

        if (currentSequence === requestSequence.current) {
          setGeocodingError('住所情報を取得できませんでした。');
          lastRequestedKey.current = '';
        }
      } finally {
        if (currentSequence === requestSequence.current) {
          setIsGeocoding(false);
        }
      }
    }, 700 + waitTime);
  }, []);

  // コンポーネント終了時にタイマーを解除する
  useEffect(() => {
    return () => {
      if (requestTimer.current) {
        clearTimeout(requestTimer.current);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController selectedLocation={selectedLocation} />

        <MapEvents
          onCenterChanged={handleCenterChanged}
          onMapCenterChange={onMapCenterChange}
        />

        {locations.map((location) => {
          const isSelected = location.id === selectedLocationId;

          return (
            <Marker
              key={location.id}
              position={[location.lat, location.long]}
              icon={isSelected ? selectedMarkerIcon : markerIcon}
              eventHandlers={{
                click: () => onMarkerClick?.(location),
              }}
            >
              <Popup>
                <strong>{location.name}</strong>
                <br />
                {location.category}
                <br />
                {location.address}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* 地図の中心地点の住所を表示する */}
      <div className="absolute left-3 top-3 z-[1000] max-w-[85%] rounded-lg bg-white p-3 shadow-lg">
        <p className="mb-1 text-xs font-semibold text-gray-500">
          現在の地図中心地
        </p>

        {isGeocoding ? (
          <p className="text-sm text-blue-600">
            住所を検索しています...
          </p>
        ) : geocodingError ? (
          <p className="text-sm text-red-600">
            {geocodingError}
          </p>
        ) : (
          <p className="text-sm text-gray-800">
            {centerAddress || '住所情報がありません。'}
          </p>
        )}
        <p className="mt-2 text-[10px] text-gray-400">
          Geocoding: © OpenStreetMap contributors
        </p>
      </div>
    </div>
  );
}
