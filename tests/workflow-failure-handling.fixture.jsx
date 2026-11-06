import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorkflowFailurePanel from '../src/pages/Admin/liveOperations/WorkflowFailurePanel.jsx';
import '../src/pages/Admin/liveOperations/liveOperations.css';

function Fixture() {
  const [revision, setRevision] = useState(0), [message, setMessage] = useState(''), [recovery, setRecovery] = useState(false);
  const job = { jobId: 'fixture-job', status: 'RECOVERY_REQUIRED', beOrchestrated: true };
  return <main style={{ maxWidth: 740, margin: '24px auto' }}>
    <button onClick={() => setRevision(v => v + 1)}>Làm mới hồ sơ</button>
    <WorkflowFailurePanel job={job} refreshTick={revision} onSaved={value => { setMessage(value); setRevision(v => v + 1); }} onOpenRecovery={() => setRecovery(true)} />
    <p role="status">{message}</p>{recovery && <p>Xác minh bằng chứng dừng trước khi kết thúc job</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture /></React.StrictMode>);
