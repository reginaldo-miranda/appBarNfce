import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Leaflet cannot be imported during SSR because it accesses 'window'
// We will import it dynamically only when component mounts on client

const MapView = (props: any) => {
    const { initialRegion, style, children } = props;
    const [LeafletMap, setLeafletMap] = useState<any>(null);

    useEffect(() => {
        // Dynamic import to avoid SSR 'window is not defined'
        (async () => {
             if (typeof window !== 'undefined') {
                 try {
                     const L = (await import('leaflet')).default;
                     const { MapContainer, TileLayer, Marker, Polyline, Popup } = await import('react-leaflet');

                     // Fix Icons
                     const icon = L.icon({
                        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        tooltipAnchor: [16, -28],
                        shadowSize: [41, 41],
                     });

                     setLeafletMap({
                         L,
                         MapContainer,
                         TileLayer,
                         Marker,
                         Polyline,
                         Popup,
                         icon
                     });
                 } catch (e) {
                     console.error("Failed to load Leaflet", e);
                 }
             }
        })();
    }, []);

    if (!LeafletMap) {
        return (
             <View style={[style, { backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' }]}>
                 <Text>Carregando mapa...</Text>
             </View>
        );
    }

    const { MapContainer, TileLayer, Marker, Polyline, Popup, icon } = LeafletMap;

    const center: [number, number] = initialRegion 
        ? [initialRegion.latitude, initialRegion.longitude]
        : [-23.55052, -46.633309];

    const zoom = 13;

    // We must clone children to pass the Leaflet components down if they are Markers/Polylines
    // But since our children are React Nodes defined in DeliveryDetailsModal using *this* file exports
    // We need to re-think how we export Marker/Polyline. 
    // The previous static export won't work if library isn't loaded.
    
    // Better strategy: The Marker/Polyline exports should be "shells" that just return null
    // And we pass the data via props to MapView, OR we render them here if they are passed as data.
    
    // However, to keep api compatibility with <MapView><Marker /><Polyline /></MapView>:
    // The children passed to MapView are already instantiated React Elements.
    // If we export "Marker", it needs to run immediately. 
    
    // Quick Fix: We can render the children, but the children components themselves must check for context or be safe.
    // But react-leaflet components MUST be children of MapContainer.
    
    return (
        <View style={[style, { overflow: 'hidden' }]}>
             {/* @ts-ignore */}
            <div style={{ height: '100%', width: '100%' }}>
                <MapContainer 
                    center={center} 
                    zoom={zoom} 
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {/* Render children. If they are our custom Marker/Polyline wrappers, they need access to the libs. 
                        We can solve this by passing the libs via Context, or just passing 'ready' prop?
                        Actually, simplest way for this specific use case (Marker/Polyline are simple wrappers):
                        We can assume children are just standard React children.
                        BUT, the exported Marker component below needs to render <LeafletMap.Marker>.
                        It can't access 'LeafletMap' state from here.
                    */}
                    {React.Children.map(children, child => {
                        if (React.isValidElement(child)) {
                             // Inject the dynamically loaded components into the children props
                             return React.cloneElement(child as any, { leafletLib: LeafletMap });
                        }
                        return child;
                    })}
                </MapContainer>
            </div>
        </View>
    );
};

export const Marker = (props: any) => {
    const { coordinate, title, description, leafletLib } = props;
    if (!leafletLib || !coordinate) return null;
    
    const { Marker: LMarker, Popup, icon } = leafletLib;

    return (
        <LMarker position={[coordinate.latitude, coordinate.longitude]} icon={icon}>
            {(title || description) && (
                <Popup>
                    <strong>{title}</strong><br/>
                    {description}
                </Popup>
            )}
        </LMarker>
    );
};

export const Polyline = (props: any) => {
    const { coordinates, strokeColor, strokeWidth, leafletLib } = props;
    if (!leafletLib || !coordinates || coordinates.length < 2) return null;
    
    const { Polyline: LPolyline } = leafletLib;
    
    const positions = coordinates.map((c: any) => [c.latitude, c.longitude]);
    
    return (
        <LPolyline 
            positions={positions} 
            pathOptions={{ color: strokeColor || 'blue', weight: strokeWidth || 3 }} 
        />
    );
};

export default MapView;
