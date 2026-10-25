import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GazeboPanel from '../src/pages/Admin/GazeboPanel.jsx';
import LidarMap from '../src/pages/Admin/LidarMap.jsx';
import { createDraft } from '../src/pages/Admin/mapStudioModel.js';
import { gazeboManifest } from '../src/features/gazebo/gazeboModel.js';
import '../src/pages/Admin/patrol.css';
import '../src/pages/Admin/MapStudioFigma.jsx'; // Shared map styles are registered by this module.

if (location.port !== '5175') throw Error('Fixture requires isolated origin 5175');
const map = { ...createDraft(), name: 'Bản đồ bệnh viện · Kiểm thử', scan: { status: 'complete', progress: 100 }, endpoints: [{ id: 'a', name: 'Điểm A', x: 580, y: 330 }, { id: 'b', name: 'Điểm B', x: 720, y: 330 }] };
const plan = { valid: true, points: map.endpoints.map(endpoint => ({ endpoint, step: { paramsJson: { max_speed_mps: .3 } } })) };
window.gazeboTestManifest = await gazeboManifest(map);
function Fixture() {
  const [visible, setVisible] = useState(true);
  return <main className="patrol-workspace" style={{ maxWidth: 1100, margin: 'auto', padding: 20, fontFamily: 'Arial' }}>
    <h1>Gazebo — kiểm thử kết nối</h1>
    <button onClick={() => setVisible(!visible)}>Rời màn hình</button>
    {visible && <GazeboPanel map={map} plan={plan} />}
    <details><summary>Bản đồ 2D khôi phục</summary><LidarMap draft={map} stage="endpoint" /></details>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
