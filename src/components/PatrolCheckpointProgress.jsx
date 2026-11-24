import { patrolJobCheckpoints } from '../features/patrol/patrolModel.js';

/** Present one checkpoint while preserving the exact server steps for diagnosis. */
export default function PatrolCheckpointProgress({ detail, catalog = {} }) {
  const checkpoints = patrolJobCheckpoints(detail, catalog);
  if (!checkpoints.length) return null;
  return <ol className="lo-steps patrol-checkpoint-progress" aria-label="Tiến độ các điểm tuần tra">
    {checkpoints.map(checkpoint => <li key={checkpoint.index} className={`lo-step ${checkpoint.current ? 'is-current' : ''}`}>
      <span className="lo-step-number">{checkpoint.index}</span><div><strong>Điểm {checkpoint.index} · {checkpoint.label}</strong><p>{checkpoint.phase}</p>
        {!!checkpoint.technical.length && <details><summary>Chi tiết kỹ thuật ({checkpoint.technical.length} lượt bước)</summary><ol>{checkpoint.technical.map(step => <li key={step.jobStepId || `${step.stepCodeSnapshot}-${step.executionSequenceNo}`}><code>{step.stepCodeSnapshot}</code> · {step.stepTypeSnapshot} · {step.status}{step.errorCode ? ` · ${step.errorCode}` : ''}</li>)}</ol></details>}
      </div>
    </li>)}
  </ol>;
}
