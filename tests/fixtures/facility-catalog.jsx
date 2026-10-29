// Test-only harness: the retained API catalog has no production Map Studio tab.
import { BrowserRouter } from 'react-router-dom';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/pages/Admin/MapStudioFigma.jsx';
import Catalog from '../../src/pages/Admin/FacilityCatalogEditor.jsx';
import WorkspaceTabs from '../../src/components/WorkspaceTabs.jsx';

function Harness() {
  const [stage,setStage]=useState('scan');
  return <main className="ls-studio">
    <WorkspaceTabs active={stage} onSelect={setStage} items={[
      {id:'scan',label:'1. Quét'}, {id:'zone',label:'2. Vùng'}, {id:'endpoint',label:'3. Điểm đích'},
    ]}/>
    <Catalog stage={stage}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><Harness/></BrowserRouter>);
