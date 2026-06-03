-- Append these two new active source nodes into your batches section:
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) VALUES 
(103, 'COCOA-GH-05', 'B-CC-GH-4041', 800.00, 'kg', 'Tema Port Export Zone') ON CONFLICT (id) DO NOTHING;
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) VALUES 
(104, 'MATCHA-KYOTO', 'B-MTC-KY-772', 150.00, 'kg', 'Kyoto Processing Plant') ON CONFLICT (id) DO NOTHING;

-- Append these initial 'sourced' ledger records to the logistics_events section:
INSERT INTO logistics_events (id, batch_id, event_type, facility, logged_by, metadata, timestamp) VALUES 
(14, 103, 'sourced', 'Tema Port Export Zone', 1, '{"origin": "Ghana Western Region Cooperative", "grade": "A", "fermentation_days": 6}', '2026-06-01 09:00:00+05'),
(15, 104, 'sourced', 'Kyoto Processing Plant', 1, '{"origin": "Uji Tea Farms, Kyoto", "harvest_season": "First Flush", "shade_grown_days": 21}', '2026-06-02 11:00:00+05')
ON CONFLICT (id) DO NOTHING;