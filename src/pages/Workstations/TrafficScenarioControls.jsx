export default function TrafficScenarioControls({map,value,onChange,disabled}){
  const select=(key,type,label)=><label className="ls-field">{label}<select aria-label={label} disabled={disabled} value={value[key]||''} onChange={e=>onChange({...value,[key]:e.target.value})}><option value="">Không thử tình huống này</option>{map.zones.filter(z=>z.type===type&&z.enabled!==false).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>;
  const duration=(key,label,fallback)=><label className="ls-field">{label}<input aria-label={label} disabled={disabled} type="number" min="1" max="180" value={value[key]??fallback} onChange={e=>onChange({...value,[key]:e.target.value===''?'':Number(e.target.value)})}/></label>;
  return <section className="ls-panel" style={{marginTop:12}}><details><summary><strong>Tình huống thử nghiệm</strong></summary>
    <p>Chọn vùng đã lưu và một tuyến đi xuyên vùng. Chỉ thêm robot/vật cản ảo cho lần chạy này, không sửa bản đồ.</p>
    {select('singleRobotZoneId','SINGLE_ROBOT','Vùng do MAR-02 ảo giữ')}
    {value.singleRobotZoneId&&duration('singleRobotSeconds','Thời gian chờ robot ảo rời (giây)',8)}
    {select('obstacleZoneId','NO_REPLAN','Vùng có vật cản thử nghiệm')}
    {value.obstacleZoneId&&duration('obstacleSeconds','Thời gian vật cản tồn tại khi gặp (giây)',5)}
    <p>MAR-02 giữ vùng cho đến hết thời gian chờ kể từ khi MAR-01 đến. Đây là kịch bản nhường quyền, không mô phỏng toàn bộ chuyển động của đội robot.</p>
    <p>Vật cản rời trước thời hạn của vùng: đi tiếp tuyến cũ. Vật cản còn tồn tại: dừng và báo hết thời gian chờ. Chưa có lập lại đường theo cảm biến.</p>
  </details></section>;
}
